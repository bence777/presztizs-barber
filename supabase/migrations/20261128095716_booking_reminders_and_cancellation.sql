begin;
alter table private.notification_outbox drop constraint notification_outbox_kind_check;
alter table private.notification_outbox add constraint notification_outbox_kind_check check(kind in ('receipt','update','change','removed','admin_otp','reminder'));
create function private.queue_appointment_reminder() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.booking_appointments;
begin
 if TG_OP='DELETE' then a:=old;else a:=new;end if;
 if TG_OP='UPDATE' and (new.starts_at,new.status,new.guest_email,new.service_id,new.staff_id) is not distinct from (old.starts_at,old.status,old.guest_email,old.service_id,old.staff_id) then return null;end if;
 update private.notification_outbox set status='failed',last_error='booking_changed',lease_token=null,lease_until=null
 where kind='reminder' and payload->'booking'->>'id'=a.id::text and status in ('pending','processing');
 if TG_OP<>'DELETE' and a.status='confirmed' and a.guest_email is not null and a.starts_at>=now()+interval '4 hours' then
 insert into private.notification_outbox(dedup_key,kind,audience,payload,available_at)
 values('reminder:'||a.id::text||':'||a.revision::text,'reminder','guest',jsonb_build_object('booking',to_jsonb(a)||jsonb_build_object('staff_name',(select name from public.booking_staff where id=a.staff_id),'service_name',a.service_name_snapshot),'staff_email',null),a.starts_at-interval '4 hours') on conflict do nothing;
 end if;
 return null;
end $$;
revoke all on function private.queue_appointment_reminder() from public,anon,authenticated,service_role;
create trigger appointment_reminder after insert or update or delete on public.booking_appointments for each row execute function private.queue_appointment_reminder();
-- Seed future existing bookings; past reminders are never sent retroactively.
insert into private.notification_outbox(dedup_key,kind,audience,payload,available_at)
select 'reminder:'||a.id::text||':'||a.revision::text,'reminder','guest',jsonb_build_object('booking',to_jsonb(a)||jsonb_build_object('staff_name',s.name,'service_name',a.service_name_snapshot),'staff_email',null),a.starts_at-interval '4 hours'
from public.booking_appointments a join public.booking_staff s on s.id=a.staff_id where a.status='confirmed' and a.guest_email is not null and a.starts_at>=now()+interval '4 hours' on conflict do nothing;
create or replace function public.booking_claim_outbox(p_limit integer default 10)
returns table(id uuid,kind text,audience text,payload jsonb,lease_token uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 -- Explicit scalar columns keep the RPC independent of private-schema types.
 update private.notification_outbox o set status='failed',last_error='lease_exhausted',lease_token=null,lease_until=null
 where (o.status='processing' and o.lease_until<now() and o.attempts>=o.max_attempts)
 or (o.status in ('pending','processing') and (case when o.kind='reminder' then (o.payload->'booking'->>'starts_at')::timestamptz-interval '4 hours' else o.created_at end)<now()-interval '23 hours');
 return query with jobs as (
 select r.id from private.notification_outbox r
 where ((r.status='pending' and r.available_at<=now()) or (r.status='processing' and r.lease_until<now())) and r.attempts<r.max_attempts
 order by r.available_at,r.id for update skip locked limit least(greatest(p_limit,1),25))
 update private.notification_outbox o set status='processing',attempts=o.attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
 from jobs where o.id=jobs.id returning o.id,o.kind,o.audience,o.payload,o.lease_token,o.created_at;
end $$;
create or replace function public.booking_security_maintenance() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 delete from private.rate_limits where window_end<now()-interval '1 hour';
 delete from private.booking_idempotency where created_at<now()-interval '7 days';
 delete from public.trusted_devices where expires_at<=now();
 -- Retain payloads briefly, operational failure metadata for 90 days.
 update private.notification_outbox set payload='{}' where kind<>'admin_otp' and ((status='sent' and sent_at<now()-interval '7 days') or (status in ('sent','failed') and created_at<now()-interval '30 days'));
 delete from private.notification_outbox where kind='admin_otp' and created_at<now()-interval '15 minutes' and status<>'processing';
 delete from private.notification_outbox where created_at<now()-interval '90 days' and status in ('sent','failed');
 delete from private.security_audit_log where occurred_at<now()-interval '365 days';
 perform private.materialize_monthly((now() at time zone 'Europe/Budapest')::date,((now() at time zone 'Europe/Budapest')::date+92),null);
 return jsonb_build_object('failed',(select count(*) from private.notification_outbox where status='failed'),'pending',(select count(*) from private.notification_outbox where status='pending'),'oldest_pending',(select min(created_at) from private.notification_outbox where status='pending'));
end $$;
create function public.booking_cancel_guest(p_id uuid,p_user uuid,p_revision bigint) returns setof public.booking_appointments
language sql security invoker set search_path='' as $$
 update public.booking_appointments set status='cancelled',cancelled_at=clock_timestamp()
 where id=p_id and user_id=p_user and revision=p_revision and status='confirmed' and starts_at>=clock_timestamp()+interval '4 hours' returning *
$$;
revoke all on function public.booking_cancel_guest(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.booking_cancel_guest(uuid,uuid,bigint) to service_role;
commit;
