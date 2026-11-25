-- Keep privileged implementations outside the exposed API schema. Both private
-- implementations verify auth.uid(), manager scope and the separate admin device.
alter function public.booking_create_monthly(jsonb) set schema private;
alter function public.booking_stop_monthly(uuid) set schema private;

create function public.booking_create_monthly(p_booking jsonb) returns setof public.booking_appointments
language sql security invoker set search_path='' as $$
  select * from private.booking_create_monthly(p_booking)
$$;
create function public.booking_stop_monthly(p_id uuid) returns void
language sql security invoker set search_path='' as $$
  select private.booking_stop_monthly(p_id)
$$;
revoke all on function public.booking_create_monthly(jsonb),public.booking_stop_monthly(uuid) from public,anon,service_role;
grant execute on function public.booking_create_monthly(jsonb),public.booking_stop_monthly(uuid) to authenticated;
