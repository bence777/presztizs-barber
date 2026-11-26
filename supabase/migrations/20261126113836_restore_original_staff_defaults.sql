-- Restore the original catalog independently for each active barber.
-- Keep the two originally hidden services inactive and preserve existing IDs/history.
begin;

do $$
declare
  staff record;
  template record;
  service_id text;
  matches integer;
begin
  -- Use the same lock order as booking and weekly-hours changes.
  for staff in select id from public.booking_staff where active order by id loop
    perform pg_advisory_xact_lock(hashtextextended('demeters-schedule:' || staff.id, 0));
  end loop;
  lock table public.booking_staff, public.booking_services, public.booking_hours
    in share row exclusive mode;

  for staff in select id from public.booking_staff where active order by id loop
    -- Refuse to overwrite a custom schedule accidentally. The verified original
    -- schedule has one interval per weekday, Monday through Friday.
    if exists (
      select 1 from public.booking_hours h where h.staff_id = staff.id
        and (h.weekday not between 1 and 5 or h.opens <> time '09:00' or h.closes <> time '17:00')
    ) then
      raise exception 'Custom working hours found for %; review before restoring defaults', staff.id;
    end if;

    for template in
      select * from (values
        ('Férfi hajvágás', 30, 5000, false, 1, true),
        ('Gépi hajvágás', 30, 5500, true, 1, true),
        ('Haj és szakáll', 60, 8000, true, 2, true),
        ('Szakálligazítás', 15, 3000, false, 2, false),
        ('Hajvágás', 30, 6000, true, 3, true)
      ) as defaults(name, duration_minutes, price_huf, active, sort_order, counts_as_haircut)
    loop
      select count(*), min(s.id) into matches, service_id
      from public.booking_services s
      where s.staff_id = staff.id and s.archived_at is null
        and lower(btrim(s.name)) = lower(template.name);
      if matches > 1 then
        raise exception 'Duplicate service % for %; review before restoring defaults', template.name, staff.id;
      end if;

      if matches = 0 then
        insert into public.booking_services
          (id, staff_id, name, description, duration_minutes, price_huf, active, sort_order, counts_as_haircut)
        values ('sv-' || gen_random_uuid()::text, staff.id, template.name, '',
          template.duration_minutes, template.price_huf, template.active,
          template.sort_order, template.counts_as_haircut);
      else
        update public.booking_services s set
          name = template.name, duration_minutes = template.duration_minutes,
          price_huf = template.price_huf, active = template.active,
          sort_order = template.sort_order, counts_as_haircut = template.counts_as_haircut
        where s.id = service_id and
          (s.name, s.duration_minutes, s.price_huf, s.active, s.sort_order, s.counts_as_haircut)
          is distinct from
          (template.name, template.duration_minutes, template.price_huf,
            template.active, template.sort_order, template.counts_as_haircut);
      end if;
    end loop;

    insert into public.booking_hours(staff_id, weekday, opens, closes)
      select staff.id, weekday, time '09:00', time '17:00'
      from generate_series(1, 5) weekday
      on conflict (staff_id, weekday, opens, closes) do nothing;

    select s.id into strict service_id from public.booking_services s
      where s.staff_id = staff.id and s.name = 'Gépi hajvágás'
        and s.active and s.archived_at is null;
    update public.booking_staff s set default_manual_service_id = service_id
      where s.id = staff.id and s.default_manual_service_id is distinct from service_id;
  end loop;
end;
$$;

commit;
