-- DEMETERS: additive upgrade of the existing booking model. No bookings/accounts removed.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter table public.booking_services add column if not exists counts_as_haircut boolean not null default false;
-- Explicitly classified existing service IDs; future services must be classified deliberately.
update public.booking_services set counts_as_haircut=true
where id in ('hajvagas','gepi-hajvagas','haj-es-szakall','ferfi-hajvagas','skin-fade');
alter table public.booking_appointments add column if not exists completed_at timestamptz;
-- Preserve old online contacts as booking snapshots; staff APIs no longer read global guest profiles.
update public.booking_appointments a set guest_name=coalesce(a.guest_name,p.full_name),
  guest_phone=coalesce(a.guest_phone,p.phone)
from public.guest_profiles p where a.user_id=p.user_id and (a.guest_name is null or a.guest_phone is null);
alter table public.booking_time_off
  add column if not exists all_day boolean not null default false,
  add column if not exists daily_start time,
  add column if not exists daily_end time,
  add column if not exists kind text not null default 'leave';
alter table public.booking_time_off add constraint booking_time_off_daily_check
  check ((daily_start is null and daily_end is null) or
    (not all_day and daily_start is not null and daily_end is not null and daily_end>daily_start));
alter table public.booking_time_off add constraint booking_time_off_kind_check check(kind in ('leave','break'));
create index if not exists booking_staff_month_idx on public.booking_appointments(staff_id,starts_at) where status<>'cancelled';
create index if not exists booking_time_off_staff_idx on public.booking_time_off(staff_id,starts_at,ends_at);
create index if not exists booking_managers_staff_idx on public.booking_managers(staff_id) where active;

-- RLS identity comes from the verified auth.users row, never mutable user_metadata/JWT email.
-- A non-exposed, tightly scoped SECURITY DEFINER lookup avoids granting access to auth.users/managers.
create or replace function private.managed_booking_staff() returns setof text
language sql stable security definer set search_path=''
as $$
  select s.id from public.booking_staff s
  where (select auth.uid()) is not null and exists (
    select 1 from public.booking_managers m join auth.users u on lower(u.email)=m.email
    where u.id=(select auth.uid()) and u.email_confirmed_at is not null and m.active
      and (m.role='owner' or (m.role='barber' and m.staff_id=s.id))
  ) and exists (
    -- A guest JWT for the same email is NOT an admin login. Require the separate,
    -- server-forwarded HttpOnly admin device credential; revocation is immediate.
    select 1 from public.trusted_devices d
    where d.user_id=(select auth.uid()) and d.scope='admin' and d.expires_at>now()
      and d.credential_hash=encode(sha256(convert_to(
        nullif(current_setting('request.headers',true),'')::jsonb->>'x-demeters-admin-device','UTF8')),'hex')
  );
$$;
revoke all on function private.managed_booking_staff() from public,anon;
grant execute on function private.managed_booking_staff() to authenticated,service_role;

alter table public.booking_appointments enable row level security;
alter table public.booking_time_off enable row level security;
-- Guest operations continue through the device-verified server; direct JWT access is staff scoped.
drop policy if exists "Guests see own bookings" on public.booking_appointments;
create policy "Managers read own calendar" on public.booking_appointments for select to authenticated
  using(staff_id in (select private.managed_booking_staff()));
create policy "Managers create own bookings" on public.booking_appointments for insert to authenticated
  with check(staff_id in (select private.managed_booking_staff()));
create policy "Managers edit own bookings" on public.booking_appointments for update to authenticated
  using(staff_id in (select private.managed_booking_staff()))
  with check(staff_id in (select private.managed_booking_staff()));
create policy "Managers delete own bookings" on public.booking_appointments for delete to authenticated
  using(staff_id in (select private.managed_booking_staff()));
create policy "Managers manage own absence" on public.booking_time_off for all to authenticated
  using(staff_id in (select private.managed_booking_staff()))
  with check(staff_id in (select private.managed_booking_staff()));
revoke all on public.booking_appointments,public.booking_time_off from public,anon,authenticated;
grant select,insert,update,delete on public.booking_appointments,public.booking_time_off to authenticated;
grant all on public.booking_appointments,public.booking_time_off to service_role;

-- A partial absence repeats at the same Budapest local times on every selected date.
-- Rows predating this migration (daily_* NULL) retain their continuous interval semantics.
create or replace function private.absence_overlaps(o public.booking_time_off,a timestamptz,b timestamptz)
returns boolean language sql stable set search_path=''
as $$
 select case when o.daily_start is null then tstzrange(o.starts_at,o.ends_at,'[)') && tstzrange(a,b,'[)')
 else exists (
   select 1 from generate_series(0,((o.ends_at at time zone 'Europe/Budapest')::date-
       (o.starts_at at time zone 'Europe/Budapest')::date)) n
   where tstzrange((((o.starts_at at time zone 'Europe/Budapest')::date+n)+o.daily_start) at time zone 'Europe/Budapest',
     (((o.starts_at at time zone 'Europe/Budapest')::date+n)+o.daily_end) at time zone 'Europe/Budapest','[)') && tstzrange(a,b,'[)')
 ) end;
$$;
revoke all on function private.absence_overlaps(public.booking_time_off,timestamptz,timestamptz) from public,anon,authenticated;

-- Shared transaction locks serialize online/manual bookings AND absences for each staff member.
-- Triggers are private and cannot be invoked via RPC. Checks also cover service_role writes.
create or replace function private.guard_booking_schedule() returns trigger
language plpgsql security definer set search_path=''
as $$
declare local_start timestamp; local_end timestamp; scheduling boolean; staff_key text;
begin
  for staff_key in select distinct x from unnest(array[new.staff_id,case when TG_OP='UPDATE' then old.staff_id else new.staff_id end]) x order by x
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  if (select auth.uid()) is not null and
    (new.staff_id not in (select private.managed_booking_staff()) or
      (TG_OP='UPDATE' and old.staff_id not in (select private.managed_booking_staff()))) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
  end if;
  scheduling := TG_OP='INSERT';
  if TG_OP='UPDATE' then
    scheduling := (new.staff_id,new.service_id,new.starts_at,new.ends_at) is distinct from
      (old.staff_id,old.service_id,old.starts_at,old.ends_at) or (old.status='cancelled' and new.status<>'cancelled');
  end if;
  if new.status in ('completed','no_show') and new.starts_at>now() then
    raise exception using errcode='P0001',message='Jövőbeli foglalás még nem zárható le.';
  end if;
  if new.status='completed' then
    new.completed_at := case when TG_OP='UPDATE' and old.status='completed' then old.completed_at else now() end;
  else new.completed_at := null; end if;
  if new.status='cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at,now());
  else new.cancelled_at := null; end if;
  if new.status<>'cancelled' and scheduling then
    if not exists(select 1 from public.booking_staff s where s.id=new.staff_id and s.active) or
       not exists(select 1 from public.booking_services s where s.id=new.service_id and s.active) then
      raise exception using errcode='P0001',message='A szolgáltatás vagy a fodrász inaktív.';
    end if;
    if not exists(select 1 from public.booking_services s where s.id=new.service_id and
        new.ends_at=new.starts_at+make_interval(mins=>s.duration_minutes)) then
      raise exception using errcode='P0001',message='Hibás szolgáltatási időtartam.';
    end if;
    local_start := new.starts_at at time zone 'Europe/Budapest';
    local_end := new.ends_at at time zone 'Europe/Budapest';
    if local_start::date<>local_end::date or not exists (
      select 1 from public.booking_hours h where h.staff_id=new.staff_id and h.weekday=extract(dow from local_start)
        and h.opens<=local_start::time and h.closes>=local_end::time
    ) then raise exception using errcode='P0001',message='Az időpont munkaidőn kívülre vagy szünetre esik.'; end if;
    if exists(select 1 from public.booking_time_off o where o.staff_id=new.staff_id
       and o.starts_at<new.ends_at and o.ends_at>new.starts_at and private.absence_overlaps(o,new.starts_at,new.ends_at)) then
      raise exception using errcode='P0001',message='Az időpont szabadsággal vagy távolléttel ütközik.';
    end if;
    if exists(select 1 from public.booking_appointments a where a.staff_id=new.staff_id and a.id<>new.id
       and a.status<>'cancelled' and a.starts_at<new.ends_at and a.ends_at>new.starts_at) then
      raise exception using errcode='23P01',message='Az időpont meglévő foglalással ütközik.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_schedule() from public,anon,authenticated,service_role;
create trigger guard_booking_schedule before insert or update on public.booking_appointments
for each row execute function private.guard_booking_schedule();

create or replace function private.guard_booking_absence() returns trigger
language plpgsql security definer set search_path=''
as $$
declare staff_key text;
begin
  for staff_key in select distinct x from unnest(array[new.staff_id,case when TG_OP='UPDATE' then old.staff_id else new.staff_id end]) x order by x
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  if (select auth.uid()) is not null and
    (new.staff_id not in (select private.managed_booking_staff()) or
      (TG_OP='UPDATE' and old.staff_id not in (select private.managed_booking_staff()))) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
  end if;
  if (new.ends_at at time zone 'Europe/Budapest')::date-(new.starts_at at time zone 'Europe/Budapest')::date>366 then
    raise exception using errcode='P0001',message='A távollét legfeljebb egy év lehet.';
  end if;
  if exists(select 1 from public.booking_appointments a where a.staff_id=new.staff_id and a.status<>'cancelled'
    and a.starts_at<new.ends_at and a.ends_at>new.starts_at and private.absence_overlaps(new,a.starts_at,a.ends_at)) then
    raise exception using errcode='P0001',message='A távollét meglévő foglalással ütközik. Előbb egyeztesd a vendégek időpontját; a foglalások megmaradtak.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_absence() from public,anon,authenticated,service_role;
create trigger guard_booking_absence before insert or update on public.booking_time_off
for each row execute function private.guard_booking_absence();

-- Aggregates are computed in Postgres, independently of calendar pagination/search.
-- SECURITY INVOKER preserves the caller's RLS scope; today uses Budapest even over DST.
create or replace function public.booking_statistics(p_month date,p_staff text default null)
returns jsonb language sql stable security invoker set search_path=''
as $$
 with bounds as (
   select date_trunc('month',p_month)::date as month_start,
     (date_trunc('month',p_month)+interval '1 month')::date as month_end,
     (now() at time zone 'Europe/Budapest')::date as today
 ), scoped as (
   select a.*,s.counts_as_haircut from public.booking_appointments a cross join bounds b
   join public.booking_services s on s.id=a.service_id
   where a.status<>'cancelled' and not a.is_demo and (p_staff is null or a.staff_id=p_staff)
     and ((a.starts_at>=b.month_start::timestamp at time zone 'Europe/Budapest'
       and a.starts_at<b.month_end::timestamp at time zone 'Europe/Budapest')
       or (a.starts_at>=b.today::timestamp at time zone 'Europe/Budapest'
       and a.starts_at<(b.today+1)::timestamp at time zone 'Europe/Budapest'))
 ), counts as (
   select count(*) filter(where a.starts_at>=b.month_start::timestamp at time zone 'Europe/Budapest'
     and a.starts_at<b.month_end::timestamp at time zone 'Europe/Budapest') as total,
   count(*) filter(where a.status='completed' and a.counts_as_haircut
     and a.starts_at>=b.month_start::timestamp at time zone 'Europe/Budapest'
     and a.starts_at<b.month_end::timestamp at time zone 'Europe/Budapest') as haircuts,
   count(*) filter(where a.starts_at>=b.today::timestamp at time zone 'Europe/Budapest'
     and a.starts_at<(b.today+1)::timestamp at time zone 'Europe/Budapest') as today
   from scoped a cross join bounds b
 ) select jsonb_build_object('total',total,'haircuts',haircuts,'today',today,'month',to_char(p_month,'YYYY-MM')) from counts;
$$;
-- Only non-personal catalog fields needed by the invoker aggregate are exposed to managers.
create policy "Managers read services" on public.booking_services for select to authenticated
 using(exists(select 1 from private.managed_booking_staff()));
grant select on public.booking_services to authenticated;
revoke all on function public.booking_statistics(date,text) from public,anon;
grant execute on function public.booking_statistics(date,text) to authenticated,service_role;

-- Existing platform event-trigger helper is not a public RPC.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
   revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
