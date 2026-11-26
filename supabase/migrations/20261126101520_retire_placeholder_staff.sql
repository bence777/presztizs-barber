-- Retire only the three verified legacy placeholder profiles. Keep all history.
-- Safe to repeat; a profile renamed to a real person is never matched by ID alone.
begin;
create temporary table retired_placeholder_staff on commit drop as
select s.id from public.booking_staff s
join (values ('barber-1','Első Barber'),('barber-2','Második Barber'),('barber-3','Harmadik Barber')) as legacy(id,name)
 on s.id=legacy.id and lower(trim(s.name))=lower(legacy.name);
-- Do not hide an upcoming real appointment without first resolving it explicitly.
do $$ declare staff_key text; begin
 for staff_key in select id from retired_placeholder_staff order by id loop
  perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:'||staff_key,0));
 end loop;
 if exists(select 1 from public.booking_appointments a
   where a.staff_id in (select id from retired_placeholder_staff)
     and a.status<>'cancelled' and not a.is_demo and a.starts_at>now())
 or exists(select 1 from private.booking_monthly_series m
   where m.staff_id in (select id from retired_placeholder_staff) and m.active) then
  raise exception 'A mintaprofilhoz jövőbeli valós foglalás vagy aktív havi ismétlés tartozik; a művelet nem történt meg.';
 end if;
end $$;
update public.booking_services set active=false,archived_at=coalesce(archived_at,now())
 where staff_id in (select id from retired_placeholder_staff) and (active or archived_at is null);
update public.booking_managers set active=false
 where role='barber' and staff_id in (select id from retired_placeholder_staff) and active;
update public.booking_staff set active=false,default_manual_service_id=null
 where id in (select id from retired_placeholder_staff);
commit;
