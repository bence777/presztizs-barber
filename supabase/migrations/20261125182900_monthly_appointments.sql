-- Monthly rules have no end date. Occurrences are real appointments, generated
-- transactionally for every requested range and before any competing write.
create table private.booking_monthly_series (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references public.booking_staff(id),
  service_id text not null references public.booking_services(id),
  first_date date not null,
  local_time time not null,
  duration_minutes integer not null check(duration_minutes between 15 and 240),
  price_huf integer not null check(price_huf>=0),
  user_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text,
  guest_phone text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.booking_monthly_series enable row level security;
revoke all on private.booking_monthly_series from public,anon,authenticated,service_role;
create index booking_monthly_staff_idx on private.booking_monthly_series(staff_id) where active;
create index booking_monthly_user_idx on private.booking_monthly_series(user_id) where active and user_id is not null;
create index booking_monthly_service_idx on private.booking_monthly_series(service_id);

alter table public.booking_appointments
  add column monthly_series_id uuid references private.booking_monthly_series(id),
  add column monthly_date date,
  add constraint booking_monthly_pair check((monthly_series_id is null)=(monthly_date is null)),
  add constraint booking_monthly_unique unique(monthly_series_id,monthly_date);

-- Keep a tombstone when an individual occurrence is deleted or moved. A range
-- refresh must never recreate an occurrence that the admin deliberately removed.
create table private.booking_monthly_exceptions (
  series_id uuid not null references private.booking_monthly_series(id) on delete cascade,
  occurrence_date date not null,
  primary key(series_id,occurrence_date)
);
alter table private.booking_monthly_exceptions enable row level security;
revoke all on private.booking_monthly_exceptions from public,anon,authenticated,service_role;

create function private.monthly_day(first_date date,month_date date) returns date
language sql immutable set search_path='' as $$
  select date_trunc('month',month_date)::date +
    (least(extract(day from first_date)::int,extract(day from date_trunc('month',month_date)+interval '1 month - 1 day')::int)-1)
$$;
revoke all on function private.monthly_day(date,date) from public,anon,authenticated,service_role;

create function private.is_monthly_occurrence(a public.booking_appointments) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.booking_monthly_series s
    where s.id=a.monthly_series_id and a.monthly_date>s.first_date
      and a.monthly_date=private.monthly_day(s.first_date,a.monthly_date)
      and a.staff_id=s.staff_id and a.service_id=s.service_id
      and a.starts_at=(a.monthly_date+s.local_time) at time zone 'Europe/Budapest'
      and a.ends_at=a.starts_at+make_interval(mins=>s.duration_minutes))
$$;
revoke all on function private.is_monthly_occurrence(public.booking_appointments) from public,anon,authenticated,service_role;

create function private.materialize_monthly(p_from date,p_to date,p_staff text default null) returns void
language plpgsql security definer set search_path='' as $$
declare s private.booking_monthly_series; m date; d date; start_time timestamptz; staff_key text;
begin
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>1462 then
    raise exception using errcode='22023',message='Hibás ismétlődési időszak.';
  end if;
  -- The same lock is used by booking/absence guards. Acquire in staff order.
  for staff_key in select distinct staff_id from private.booking_monthly_series
    where active and (p_staff is null or staff_id=p_staff) and first_date<p_to order by staff_id
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  for s in select * from private.booking_monthly_series
    where active and (p_staff is null or staff_id=p_staff) and first_date<p_to order by staff_id,id
  loop
    for m in select generate_series(date_trunc('month',greatest(p_from,s.first_date)),date_trunc('month',p_to-1),interval '1 month')::date
    loop
      d:=private.monthly_day(s.first_date,m);
      if d<p_from or d<s.first_date or d>=p_to then continue; end if;
      if exists(select 1 from public.booking_appointments a where a.monthly_series_id=s.id and a.monthly_date=d)
        or exists(select 1 from private.booking_monthly_exceptions e where e.series_id=s.id and e.occurrence_date=d) then continue; end if;
      start_time:=(d+s.local_time) at time zone 'Europe/Budapest';
      insert into public.booking_appointments(staff_id,service_id,starts_at,ends_at,price_huf,status,user_id,guest_name,guest_email,guest_phone,is_manual,monthly_series_id,monthly_date)
      values(s.staff_id,s.service_id,start_time,start_time+make_interval(mins=>s.duration_minutes),s.price_huf,'confirmed',coalesce(s.user_id,(select a.user_id from public.booking_appointments a where a.guest_email=s.guest_email and a.user_id is not null limit 1)),s.guest_name,s.guest_email,s.guest_phone,true,s.id,d);
    end loop;
  end loop;
end;
$$;
revoke all on function private.materialize_monthly(date,date,text) from public,anon,authenticated,service_role;

-- Only our server can generate a range; callers never receive contact data.
create function public.booking_materialize_monthly(p_from date,p_to date,p_staff text default null) returns void
language sql security definer set search_path='' as $$
  select private.materialize_monthly(p_from,p_to,p_staff)
$$;
revoke all on function public.booking_materialize_monthly(date,date,text) from public,anon,authenticated;
grant execute on function public.booking_materialize_monthly(date,date,text) to service_role;

-- Check unmaterialized reservations as well, including the same signed-in
-- guest's other barber. Edited/cancelled/deleted occurrences are exceptions.
create function private.check_monthly_conflicts(a public.booking_appointments) returns void
language plpgsql security definer set search_path='' as $$
declare s private.booking_monthly_series; m date; d date; t timestamptz;
begin
  if a.status='cancelled' then return; end if;
  for s in select * from private.booking_monthly_series where active
    and id is distinct from a.monthly_series_id
    and (staff_id=a.staff_id or (a.user_id is not null and (user_id=a.user_id or (user_id is null and exists(select 1 from public.booking_appointments b where b.guest_email=booking_monthly_series.guest_email and b.user_id=a.user_id)))))
    and first_date<=(a.ends_at at time zone 'Europe/Budapest')::date
  loop
    for m in select generate_series(date_trunc('month',a.starts_at at time zone 'Europe/Budapest'),
      date_trunc('month',a.ends_at at time zone 'Europe/Budapest'),interval '1 month')::date
    loop
      d:=private.monthly_day(s.first_date,m);
      if d<s.first_date or exists(select 1 from public.booking_appointments b where b.monthly_series_id=s.id and b.monthly_date=d)
        or exists(select 1 from private.booking_monthly_exceptions e where e.series_id=s.id and e.occurrence_date=d) then continue; end if;
      t:=(d+s.local_time) at time zone 'Europe/Budapest';
      if t<a.ends_at and t+make_interval(mins=>s.duration_minutes)>a.starts_at then
        raise exception using errcode='23P01',message='Az időpont havonta ismétlődő foglalással ütközik.';
      end if;
    end loop;
  end loop;
end;
$$;
revoke all on function private.check_monthly_conflicts(public.booking_appointments) from public,anon,authenticated,service_role;

create function private.monthly_before_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare staff_key text;
begin
  for staff_key in select distinct x from unnest(array[new.staff_id,case when TG_OP='UPDATE' then old.staff_id else new.staff_id end]) x order by x
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  if (select auth.uid()) is not null and (new.staff_id not in (select private.managed_booking_staff()) or (TG_OP='UPDATE' and old.staff_id not in (select private.managed_booking_staff()))) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
  end if;
  if TG_OP='UPDATE' then
    if (new.monthly_series_id,new.monthly_date) is distinct from (old.monthly_series_id,old.monthly_date) then
      raise exception using errcode='42501',message='Az ismétlődés azonosítója nem módosítható.';
    end if;
    if (new.staff_id,new.service_id,new.starts_at,new.ends_at,new.status) is not distinct from
       (old.staff_id,old.service_id,old.starts_at,old.ends_at,old.status) then return new; end if;
  elsif new.monthly_series_id is not null then
    if not exists(select 1 from private.booking_monthly_series s where s.id=new.monthly_series_id and s.active
      and s.staff_id=new.staff_id and s.service_id=new.service_id and new.monthly_date>=s.first_date
      and new.monthly_date=private.monthly_day(s.first_date,new.monthly_date)
      and new.starts_at=(new.monthly_date+s.local_time) at time zone 'Europe/Budapest'
      and new.ends_at=new.starts_at+make_interval(mins=>s.duration_minutes)
      and not exists(select 1 from private.booking_monthly_exceptions e where e.series_id=s.id and e.occurrence_date=new.monthly_date)) then
      raise exception using errcode='42501',message='Hibás ismétlődési hivatkozás.';
    end if;
    perform private.check_monthly_conflicts(new);
    return new;
  end if;
  if new.status<>'cancelled' then
    perform private.materialize_monthly((new.starts_at at time zone 'Europe/Budapest')::date,
      (new.ends_at at time zone 'Europe/Budapest')::date+1,new.staff_id);
  end if;
  perform private.check_monthly_conflicts(new);
  return new;
end;
$$;
revoke all on function private.monthly_before_booking() from public,anon,authenticated,service_role;
create trigger a_monthly_before_booking before insert or update on public.booking_appointments
for each row execute function private.monthly_before_booking();

create function private.monthly_before_absence() returns trigger
language plpgsql security definer set search_path='' as $$
declare staff_key text;
begin
  for staff_key in select distinct x from unnest(array[new.staff_id,case when TG_OP='UPDATE' then old.staff_id else new.staff_id end]) x order by x
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  if new.ends_at<=new.starts_at or new.ends_at-new.starts_at>interval '368 days' then
    raise exception using errcode='P0001',message='A távollét legfeljebb egy év lehet.';
  end if;
  perform private.materialize_monthly((new.starts_at at time zone 'Europe/Budapest')::date,
    (new.ends_at at time zone 'Europe/Budapest')::date+1,new.staff_id);
  return new;
end;
$$;
revoke all on function private.monthly_before_absence() from public,anon,authenticated,service_role;
create trigger a_monthly_before_absence before insert or update on public.booking_time_off
for each row execute function private.monthly_before_absence();

create function private.monthly_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.monthly_series_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||old.staff_id,0));
    insert into private.booking_monthly_exceptions values(old.monthly_series_id,old.monthly_date) on conflict do nothing;
  end if;
  return old;
end;
$$;
revoke all on function private.monthly_deleted() from public,anon,authenticated,service_role;
create trigger monthly_deleted before delete on public.booking_appointments
for each row execute function private.monthly_deleted();

create function public.booking_create_monthly(p_booking jsonb) returns setof public.booking_appointments
language plpgsql security definer set search_path='' as $$
declare a public.booking_appointments; s private.booking_monthly_series; r record; from_day date; to_day date;
begin
  a:=jsonb_populate_record(null::public.booking_appointments,p_booking);
  if (select auth.uid()) is null or a.staff_id not in (select private.managed_booking_staff()) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a fodrászhoz.';
  end if;
  if a.status is distinct from 'confirmed' or not coalesce(a.is_manual,false) or length(trim(a.guest_name))<2 or coalesce(a.guest_phone,'')='' then
    raise exception using errcode='22023',message='Havi ismétléshez megerősített, teljes foglalás szükséges.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('demeters-monthly-series',0));
  perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||a.staff_id,0));
  insert into private.booking_monthly_series(staff_id,service_id,first_date,local_time,duration_minutes,price_huf,user_id,guest_name,guest_email,guest_phone)
  values(a.staff_id,a.service_id,(a.starts_at at time zone 'Europe/Budapest')::date,(a.starts_at at time zone 'Europe/Budapest')::time,
    extract(epoch from a.ends_at-a.starts_at)::int/60,a.price_huf,a.user_id,a.guest_name,a.guest_email,a.guest_phone) returning * into s;
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
revoke all on function public.booking_create_monthly(jsonb) from public,anon,service_role;
grant execute on function public.booking_create_monthly(jsonb) to authenticated;

create function public.booking_stop_monthly(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.booking_appointments; staff_key text;
begin
  select * into a from public.booking_appointments where id=p_id;
  if a.id is null or (select auth.uid()) is null or a.staff_id not in (select private.managed_booking_staff()) then
    raise exception using errcode='42501',message='Nincs jogosultságod ehhez a foglaláshoz.';
  end if;
  if exists(select 1 from private.booking_monthly_series s where s.id=a.monthly_series_id and s.staff_id not in (select private.managed_booking_staff())) then
    raise exception using errcode='42501',message='Nincs jogosultságod az ismétlődéshez.';
  end if;
  if a.monthly_series_id is null then raise exception using errcode='22023',message='Ez a foglalás nem ismétlődik.'; end if;
  for staff_key in select distinct staff_id from public.booking_appointments where monthly_series_id=a.monthly_series_id order by staff_id
  loop perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0)); end loop;
  update private.booking_monthly_series set active=false where id=a.monthly_series_id;
  delete from public.booking_appointments where monthly_series_id=a.monthly_series_id and starts_at>now() and status='confirmed';
end;
$$;
revoke all on function public.booking_stop_monthly(uuid) from public,anon,service_role;
grant execute on function public.booking_stop_monthly(uuid) to authenticated;

-- Future monthly reservations retain the agreed local time, even on closed days.
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
    if not private.is_monthly_occurrence(new) then
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
