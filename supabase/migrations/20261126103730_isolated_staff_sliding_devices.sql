-- Staff access stays bound to the verified account + its separate admin device.
-- Only owners can manage other profiles; inactive staff have no staff privileges.
begin;
create or replace function private.managed_booking_staff() returns setof text
language sql stable security definer set search_path=''
as $$
 select s.id from public.booking_staff s
 where (select auth.uid()) is not null and exists (
  select 1 from public.booking_managers m join auth.users u on lower(u.email)=m.email
  where u.id=(select auth.uid()) and u.email_confirmed_at is not null and m.active
   and (m.role='owner' or (m.role='barber' and m.staff_id=s.id and s.active))
 ) and exists (
  select 1 from public.trusted_devices d
  where d.user_id=(select auth.uid()) and d.scope='admin' and d.expires_at>now()
   and d.credential_hash=encode(sha256(convert_to(
    nullif(current_setting('request.headers',true),'')::jsonb->>'x-demeters-admin-device','UTF8')),'hex')
 );
$$;
revoke all on function private.managed_booking_staff() from public,anon;
grant execute on function private.managed_booking_staff() to authenticated,service_role;

-- Server-only atomic touch. No browser JWT may renew, recreate or inspect a device.
-- Call only AFTER Supabase verifies the user matches the signed app session.
create function public.booking_touch_trusted_device(p_user uuid,p_scope text,p_hash text,p_extend boolean)
returns table(id uuid,user_id uuid,scope text,last_seen_at timestamptz,expires_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare touched_at timestamptz:=clock_timestamp();
begin
 if p_scope not in ('admin','guest') or p_hash !~ '^[a-f0-9]{64}$' or p_extend is null then
  return;
 end if;
 return query update public.trusted_devices d
 set last_seen_at=greatest(d.last_seen_at,touched_at),
  expires_at=case when p_extend then greatest(d.expires_at,touched_at+
   case when p_scope='admin' then interval '7 days' else interval '60 days' end)
   else d.expires_at end
 where d.user_id=p_user and d.scope=p_scope and d.credential_hash=p_hash and d.expires_at>touched_at
 returning d.id,d.user_id,d.scope,d.last_seen_at,d.expires_at;
end $$;
revoke all on function public.booking_touch_trusted_device(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.booking_touch_trusted_device(uuid,text,text,boolean) to service_role;
commit;
