-- Additive upgrade. Run after the existing monthly migrations, in one transaction.
begin;
lock table public.booking_services, public.booking_staff, public.booking_appointments,
  private.booking_monthly_series in share row exclusive mode;
alter table public.booking_services
  add column staff_id text references public.booking_staff(id),
  add column archived_at timestamptz;
alter table public.booking_services drop constraint booking_services_duration_minutes_check;
alter table public.booking_services add constraint booking_services_duration_positive check(duration_minutes>0);
alter table public.booking_staff
  add column public_phone text,
  add column booking_step_minutes integer not null default 15 check(booking_step_minutes between 1 and 1440),
  add column default_manual_service_id text references public.booking_services(id);
alter table public.booking_appointments
  add column service_name_snapshot text,
  add column duration_minutes_snapshot integer;
alter table private.booking_monthly_series add column service_name_snapshot text;
alter table private.booking_monthly_series alter column guest_phone drop not null;
alter table private.booking_monthly_series drop constraint booking_monthly_series_duration_minutes_check;
alter table private.booking_monthly_series add constraint monthly_duration_positive check(duration_minutes>0);
-- Suspend only application triggers while remapping references; constraints stay enabled.
alter table public.booking_appointments disable trigger user;
update public.booking_appointments a set service_name_snapshot=s.name,
  duration_minutes_snapshot=extract(epoch from a.ends_at-a.starts_at)::integer/60
from public.booking_services s where a.service_id=s.id;
update private.booking_monthly_series m set service_name_snapshot=s.name
from public.booking_services s where m.service_id=s.id;
-- The old catalog was universally available: copy the existing real catalog for each
-- existing staff member. Do not seed example services, prices or new staff.
create temporary table service_migration_map on commit drop as
select s.id old_id,b.id staff_id,'sv-'||gen_random_uuid()::text new_id
from public.booking_services s cross join public.booking_staff b;
insert into public.booking_services(id,staff_id,name,description,duration_minutes,price_huf,active,sort_order,counts_as_haircut)
select m.new_id,m.staff_id,s.name,s.description,s.duration_minutes,s.price_huf,s.active,s.sort_order,s.counts_as_haircut
from service_migration_map m join public.booking_services s on s.id=m.old_id;
update public.booking_appointments a set service_id=m.new_id
from service_migration_map m where a.service_id=m.old_id and a.staff_id=m.staff_id;
update private.booking_monthly_series s set service_id=m.new_id
from service_migration_map m where s.service_id=m.old_id and s.staff_id=m.staff_id;
update public.booking_services set active=false,archived_at=now() where staff_id is null;
update public.booking_staff b set default_manual_service_id=(select s.id from public.booking_services s
  where s.staff_id=b.id and s.active and s.archived_at is null order by s.sort_order,s.name,s.id limit 1);
alter table public.booking_appointments enable trigger user;
alter table public.booking_services add constraint service_owner_required check(staff_id is not null or archived_at is not null);
alter table public.booking_services add constraint archived_service_inactive check(archived_at is null or not active);
alter table public.booking_services add constraint service_staff_unique unique(id,staff_id);
alter table public.booking_appointments add constraint appointment_service_owner
  foreign key(service_id,staff_id) references public.booking_services(id,staff_id);
alter table public.booking_appointments alter column service_name_snapshot set not null;
alter table public.booking_appointments alter column duration_minutes_snapshot set not null;
create index booking_services_staff_catalog_idx on public.booking_services(staff_id,sort_order,name) where archived_at is null;

-- Existing admin-device identity remains the sole manager authority.
drop policy if exists "Managers read services" on public.booking_services;
create policy "Managers manage own services" on public.booking_services for all to authenticated
 using(staff_id in (select private.managed_booking_staff()))
 with check(staff_id in (select private.managed_booking_staff()));
alter table public.booking_staff enable row level security;
alter table public.booking_hours enable row level security;
create policy "Managers read own profile" on public.booking_staff for select to authenticated
 using(id in (select private.managed_booking_staff()));
create policy "Managers edit own profile" on public.booking_staff for update to authenticated
 using(id in (select private.managed_booking_staff())) with check(id in (select private.managed_booking_staff()));
create policy "Managers manage own hours" on public.booking_hours for all to authenticated
 using(staff_id in (select private.managed_booking_staff())) with check(staff_id in (select private.managed_booking_staff()));
revoke all on public.booking_services,public.booking_staff,public.booking_hours from public,anon,authenticated;
-- Archive instead of DELETE, so historical service references always survive.
grant select,insert,update on public.booking_services to authenticated;
grant select on public.booking_staff to authenticated;
grant update(name,image_url,public_phone,booking_step_minutes,default_manual_service_id) on public.booking_staff to authenticated;
grant select,insert,update,delete on public.booking_hours to authenticated;
grant usage,select on sequence public.booking_hours_id_seq to authenticated;

create function private.guard_service_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.staff_id is distinct from old.staff_id then
  raise exception using errcode='42501',message='A szolgáltatás tulajdonosa nem módosítható.';
 end if;
 return new;
end $$;
revoke all on function private.guard_service_owner() from public,anon,authenticated,service_role;
create trigger guard_service_owner before update on public.booking_services for each row execute function private.guard_service_owner();
create function private.guard_staff_default() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.default_manual_service_id is not null and not exists(select 1 from public.booking_services s
  where s.id=new.default_manual_service_id and s.staff_id=new.id and s.active and s.archived_at is null) then
  raise exception using errcode='P0001',message='Az alapértelmezett szolgáltatás legyen saját és aktív.';
 end if;
 return new;
end $$;
revoke all on function private.guard_staff_default() from public,anon,authenticated,service_role;
create trigger guard_staff_default before update on public.booking_staff for each row execute function private.guard_staff_default();

-- An archived or disabled default must never block later profile edits.
create function private.clear_inactive_default() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not new.active or new.archived_at is not null then
  update public.booking_staff set default_manual_service_id=null where default_manual_service_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.clear_inactive_default() from public,anon,authenticated,service_role;
create trigger clear_inactive_default after update of active,archived_at on public.booking_services
for each row execute function private.clear_inactive_default();

-- Replace a full weekly schedule atomically; the invoker retains staff RLS.
create function public.booking_save_hours(p_staff text,p_hours jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null or p_staff not in (select private.managed_booking_staff()) then
  raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
 end if;
 if jsonb_typeof(p_hours)<>'array' or jsonb_array_length(p_hours)>56 then
  raise exception using errcode='22023',message='Hibás munkaidő.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||p_staff,0));
 delete from public.booking_hours where staff_id=p_staff;
 insert into public.booking_hours(staff_id,weekday,opens,closes)
 select p_staff,h.weekday,h.opens,h.closes from jsonb_to_recordset(p_hours) as h(weekday smallint,opens time,closes time);
end $$;
revoke all on function public.booking_save_hours(text,jsonb) from public,anon,service_role;
grant execute on function public.booking_save_hours(text,jsonb) to authenticated;

create or replace function private.guard_booking_schedule() returns trigger
language plpgsql security definer set search_path=''
as $$
declare local_start timestamp; local_end timestamp; scheduling boolean; staff_key text; svc public.booking_services; series private.booking_monthly_series; same_service boolean; keep_snapshot boolean;
begin
  for staff_key in select distinct x from unnest(array[new.staff_id,case when TG_OP='UPDATE' then old.staff_id else new.staff_id end]) x order by x
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  if (select auth.uid()) is not null and
    (new.staff_id not in (select private.managed_booking_staff()) or
      (TG_OP='UPDATE' and old.staff_id not in (select private.managed_booking_staff()))) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
  end if;
  select * into svc from public.booking_services where id=new.service_id;
  same_service := false; keep_snapshot := false;
  if TG_OP='UPDATE' then
    same_service := (new.staff_id,new.service_id) is not distinct from (old.staff_id,old.service_id);
    keep_snapshot := same_service;
  end if;
  if svc.id is null or svc.staff_id is distinct from new.staff_id then
    raise exception using errcode='P0001',message='A szolgáltatás nem ehhez a fodrászhoz tartozik.';
  end if;
  if TG_OP='INSERT' and new.monthly_series_id is not null then
    select * into series from private.booking_monthly_series where id=new.monthly_series_id;
  end if;
  if keep_snapshot then
    new.service_name_snapshot := old.service_name_snapshot;
    new.price_huf := old.price_huf;
  else
    new.service_name_snapshot := coalesce(series.service_name_snapshot,svc.name);
    new.price_huf := coalesce(series.price_huf,svc.price_huf);
  end if;
  if extract(epoch from new.ends_at-new.starts_at)<=0 or mod(extract(epoch from new.ends_at-new.starts_at),60)<>0 then
    raise exception using errcode='P0001',message='Az időtartam pozitív egész perc legyen.';
  end if;
  new.duration_minutes_snapshot := extract(epoch from new.ends_at-new.starts_at)::integer/60;
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
    if not private.is_monthly_occurrence(new) then
    if not exists(select 1 from public.booking_staff s where s.id=new.staff_id and s.active) or
       not exists(select 1 from public.booking_services s where s.id=new.service_id and ((s.active and s.archived_at is null) or same_service)) then
      raise exception using errcode='P0001',message='A szolgáltatás vagy a fodrász inaktív.';
    end if;
    if not new.is_manual and not (TG_OP='UPDATE' and same_service and new.ends_at-new.starts_at=old.ends_at-old.starts_at)
      and new.ends_at<>new.starts_at+make_interval(mins=>svc.duration_minutes) then
      raise exception using errcode='P0001',message='Hibás szolgáltatási időtartam.';
    end if;
    local_start := new.starts_at at time zone 'Europe/Budapest';
    local_end := new.ends_at at time zone 'Europe/Budapest';
    if local_start::date<>local_end::date or not exists (
      select 1 from public.booking_hours h where h.staff_id=new.staff_id and h.weekday=extract(dow from local_start)
        and h.opens<=local_start::time and h.closes>=local_end::time
    ) then raise exception using errcode='P0001',message='Az időpont munkaidőn kívülre vagy szünetre esik.'; end if;
    end if; -- Existing monthly reservations keep their original time and duration.
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

create or replace function private.booking_create_monthly(p_booking jsonb) returns setof public.booking_appointments
language plpgsql security definer set search_path='' as $$
declare a public.booking_appointments; s private.booking_monthly_series; r record; from_day date; to_day date; svc public.booking_services;
begin
  a:=jsonb_populate_record(null::public.booking_appointments,p_booking);
  if (select auth.uid()) is null or a.staff_id not in (select private.managed_booking_staff()) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
  end if;
  if a.status is distinct from 'confirmed' or not coalesce(a.is_manual,false) or coalesce(length(trim(a.guest_name)),0)<1 then
    raise exception using errcode='22023',message='Havi ismétléshez megerősített, teljes foglalás szükséges.';
  end if;
  select * into svc from public.booking_services where id=a.service_id and staff_id=a.staff_id and active and archived_at is null;
  if svc.id is null or a.ends_at<=a.starts_at or mod(extract(epoch from a.ends_at-a.starts_at),60)<>0 then
    raise exception using errcode='22023',message='Hibás szolgáltatás vagy időtartam.';
  end if;
  a.price_huf:=svc.price_huf;
  perform pg_advisory_xact_lock(hashtextextended('demeters-monthly-series',0));
  perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||a.staff_id,0));
  insert into private.booking_monthly_series(staff_id,service_id,first_date,local_time,duration_minutes,price_huf,user_id,guest_name,guest_email,guest_phone,service_name_snapshot)
  values(a.staff_id,a.service_id,(a.starts_at at time zone 'Europe/Budapest')::date,(a.starts_at at time zone 'Europe/Budapest')::time,
    extract(epoch from a.ends_at-a.starts_at)::int/60,a.price_huf,a.user_id,a.guest_name,a.guest_email,a.guest_phone,svc.name) returning * into s;
  -- The seed still passes the ordinary working-hours and absence checks.
  perform private.materialize_monthly(s.first_date,s.first_date+1,s.staff_id);
  -- Validate every existing future appointment/absence, including distant ones.
  for r in select starts_at,ends_at from public.booking_appointments
      where (staff_id=s.staff_id or (s.user_id is not null and user_id=s.user_id)) and status<>'cancelled' and starts_at>=a.starts_at and monthly_series_id is distinct from s.id
      union all select starts_at,ends_at from public.booking_time_off where staff_id=s.staff_id and ends_at>=a.starts_at
  loop
    from_day:=(r.starts_at at time zone 'Europe/Budapest')::date;
    to_day:=(r.ends_at at time zone 'Europe/Budapest')::date+1;
    perform private.materialize_monthly(from_day,to_day,s.staff_id);
  end loop;
  -- Four years cover leap/non-leap February collisions between monthly rules.
  for r in select greatest(s.first_date,first_date) d from private.booking_monthly_series
    where active and id<>s.id and (staff_id=s.staff_id or (s.user_id is not null and user_id=s.user_id)) order by staff_id,id
  loop perform private.materialize_monthly(r.d,(r.d+interval '4 years')::date,s.staff_id); end loop;
  perform private.materialize_monthly(s.first_date,(s.first_date+interval '13 months')::date,s.staff_id);
  return query select * from public.booking_appointments where monthly_series_id=s.id and monthly_date=s.first_date;
end;
$$;

revoke all on function private.booking_create_monthly(jsonb) from public,anon,service_role;
grant execute on function private.booking_create_monthly(jsonb) to authenticated;
commit;
