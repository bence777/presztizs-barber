begin;
alter table public.trusted_devices add column if not exists auth_session_id uuid;
create index if not exists trusted_devices_auth_session_idx on public.trusted_devices(auth_session_id);
-- Old credentials have no session binding: deployment requires a fresh sign-in.
create or replace function private.admin_session_allowed(p_user uuid,p_session uuid,p_aal text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.booking_managers m join auth.users u on lower(u.email)=m.email
 cross join private.security_settings s
 where u.id=p_user and u.email_confirmed_at is not null and m.active
 and (m.role='owner' or exists(select 1 from public.booking_staff b where b.id=m.staff_id and b.active))
 and exists(select 1 from auth.sessions a where a.id=p_session and a.user_id=p_user)
 and (p_aal='aal2' or (m.role='barber' and not s.require_staff_mfa
   and not exists(select 1 from auth.mfa_factors f where f.user_id=p_user and f.status='verified'))))
$$;
revoke all on function private.admin_session_allowed(uuid,uuid,text) from public,anon,authenticated,service_role;
create or replace function private.managed_booking_staff() returns setof text
language sql stable security definer set search_path='' as $$
 select s.id from public.booking_staff s
 where (select auth.uid()) is not null
 and private.admin_session_allowed((select auth.uid()),nullif((select auth.jwt())->>'session_id','')::uuid,(select auth.jwt())->>'aal')
 and exists(select 1 from public.booking_managers m join auth.users u on lower(u.email)=m.email
  where u.id=(select auth.uid()) and m.active and (m.role='owner' or (m.role='barber' and m.staff_id=s.id and s.active)))
 and exists(select 1 from public.trusted_devices d cross join private.security_settings cfg
  where d.user_id=(select auth.uid()) and d.scope='admin' and d.expires_at>now()
  and d.created_at+make_interval(secs=>cfg.admin_absolute_seconds)>now()
  and d.last_seen_at+make_interval(secs=>cfg.admin_idle_seconds)>now()
  and d.auth_session_id=nullif((select auth.jwt())->>'session_id','')::uuid
  and d.credential_hash=encode(sha256(convert_to(nullif(current_setting('request.headers',true),'')::jsonb->>'x-demeters-admin-device','UTF8')),'hex'))
$$;
-- Existing grants are retained; only the authorization predicate becomes stricter.
create or replace function public.booking_touch_trusted_device(p_user uuid,p_scope text,p_hash text,p_extend boolean)
returns table(id uuid,user_id uuid,scope text,last_seen_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); cfg private.security_settings;
begin
 if p_scope not in ('admin','guest') or p_hash !~ '^[a-f0-9]{64}$' or p_extend is null then return; end if;
 select * into cfg from private.security_settings where singleton;
 return query update public.trusted_devices d
 set last_seen_at=greatest(d.last_seen_at,t),
 expires_at=case when p_scope='admin' then least(d.created_at+make_interval(secs=>cfg.admin_absolute_seconds),d.expires_at)
  when p_extend then greatest(d.expires_at,t+interval '60 days') else d.expires_at end
 where d.user_id=p_user and d.scope=p_scope and d.credential_hash=p_hash and d.expires_at>t
 and (p_scope='guest' or (
  d.created_at+make_interval(secs=>cfg.admin_absolute_seconds)>t and d.last_seen_at+make_interval(secs=>cfg.admin_idle_seconds)>t
  and exists(select 1 from auth.sessions s where s.id=d.auth_session_id and s.user_id=p_user)
  and exists(select 1 from public.booking_managers m join auth.users u on lower(u.email)=m.email
   where u.id=p_user and m.active and (m.role='owner' or exists(select 1 from public.booking_staff b where b.id=m.staff_id and b.active)))))
 returning d.id,d.user_id,d.scope,d.last_seen_at,d.expires_at;
end $$;
revoke all on function public.booking_touch_trusted_device(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.booking_touch_trusted_device(uuid,text,text,boolean) to service_role;

create or replace function private.revoke_disabled_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='booking_managers' then
  if not new.active or new.role is distinct from old.role or new.staff_id is distinct from old.staff_id or new.email is distinct from old.email then
   delete from public.trusted_devices d using auth.users u where d.user_id=u.id and d.scope='admin' and lower(u.email)=old.email;
  end if;
 elsif not new.active and old.active then
  delete from public.trusted_devices d using auth.users u,public.booking_managers m
  where d.user_id=u.id and d.scope='admin' and lower(u.email)=m.email and m.staff_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.revoke_disabled_admin() from public,anon,authenticated,service_role;
create trigger revoke_disabled_admin after update on public.booking_managers for each row execute function private.revoke_disabled_admin();
create trigger revoke_disabled_staff after update on public.booking_staff for each row execute function private.revoke_disabled_admin();

create or replace function private.fresh_admin_mfa() returns boolean language sql stable set search_path='' as $$
 select coalesce((select auth.jwt())->>'aal'='aal2' and exists(select 1 from jsonb_array_elements(coalesce((select auth.jwt())->'amr','[]')) m
 where m->>'method'='totp' and (m->>'timestamp')::numeric between extract(epoch from now())-300 and extract(epoch from now())+30),false)
$$;
revoke all on function private.fresh_admin_mfa() from public,anon;
grant execute on function private.fresh_admin_mfa() to authenticated;
-- Direct SQL/REST deletion obeys the same step-up requirement as the API.
create policy "Fresh MFA for permanent deletion" on public.booking_appointments as restrictive for delete to authenticated using(private.fresh_admin_mfa());
commit;
