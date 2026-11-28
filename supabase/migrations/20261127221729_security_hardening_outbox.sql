begin;
create table private.security_audit_log (
 id bigint generated always as identity primary key,
 actor_id uuid, action text not null, record_type text not null, record_id text,
 request_id uuid not null, occurred_at timestamptz not null default clock_timestamp(),
 changed_fields text[] not null default '{}'
);
alter table private.security_audit_log enable row level security;
revoke all on private.security_audit_log from public,anon,authenticated,service_role;
create index security_audit_log_time_idx on private.security_audit_log(occurred_at);
create index security_audit_log_record_idx on private.security_audit_log(record_type,record_id,occurred_at);
create or replace function private.audit_mutation() returns trigger language plpgsql security definer set search_path='' as $$
declare h jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'); before_row jsonb; after_row jsonb; actor uuid;
begin
 if TG_TABLE_NAME='trusted_devices' and TG_OP='UPDATE' and (to_jsonb(new)-array['last_seen_at','expires_at'])=(to_jsonb(old)-array['last_seen_at','expires_at']) then return null;end if;
 if TG_OP<>'INSERT' then before_row:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then after_row:=to_jsonb(new); end if;
 actor:=(select auth.uid());
 if actor is null and h->>'x-demeters-actor' ~ '^[0-9a-f-]{36}$' then actor:=(h->>'x-demeters-actor')::uuid; end if;
 insert into private.security_audit_log(actor_id,action,record_type,record_id,request_id,changed_fields)
 values(actor,TG_OP,TG_TABLE_NAME,coalesce(after_row->>'id',before_row->>'id',after_row->>'staff_id',before_row->>'staff_id'),
 coalesce(case when h->>'x-request-id' ~ '^[0-9a-f-]{36}$' then (h->>'x-request-id')::uuid end,gen_random_uuid()),
 array(select key from jsonb_object_keys(coalesce(after_row,before_row)) key where (before_row->key) is distinct from (after_row->key)
 and key not in ('credential_hash','guest_email','guest_name','guest_phone','email','user_id')));
 return null;
end $$;
revoke all on function private.audit_mutation() from public,anon,authenticated,service_role;
do $$ declare t text;begin
 foreach t in array array['booking_appointments','booking_managers','booking_staff','booking_services','booking_hours','booking_time_off','trusted_devices'] loop
 execute format('create trigger security_audit after insert or update or delete on public.%I for each row execute function private.audit_mutation()',t);
 end loop;
end $$;
create trigger security_audit_settings after update on private.security_settings for each row execute function private.audit_mutation();

create table private.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 dedup_key text not null unique, kind text not null check(kind in ('receipt','update','change','removed','admin_otp')),
 audience text not null check(audience in ('guest','staff','auth')),
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0, max_attempts integer not null default 8,
 available_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid,
 last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
alter table private.notification_outbox enable row level security;
revoke all on private.notification_outbox from public,anon,authenticated,service_role;
create index notification_outbox_ready_idx on private.notification_outbox(available_at) where status in ('pending','processing');
create index notification_outbox_retention_idx on private.notification_outbox(created_at);
create or replace function private.queue_booking_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.booking_appointments; k text; data jsonb; h jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
begin
 if TG_OP='DELETE' then a:=old;k:='removed';else a:=new;k:=case when TG_OP='INSERT' then 'receipt' when new.status is distinct from old.status then 'change' else 'update' end;end if;
 -- Materialization and profile linking must not mail customers again.
 if TG_OP='INSERT' and a.monthly_series_id is not null then return null; end if;
 if a.is_manual and coalesce(h->>'x-demeters-notify','false')<>'true' then return null; end if;
 if TG_OP='UPDATE' and (to_jsonb(new)-array['revision','user_id'])=(to_jsonb(old)-array['revision','user_id']) then return null; end if;
 data:=to_jsonb(a)||jsonb_build_object('staff_name',(select name from public.booking_staff where id=a.staff_id),'service_name',coalesce(a.service_name_snapshot,(select name from public.booking_services where id=a.service_id)));
 insert into private.notification_outbox(dedup_key,kind,audience,payload)
 select a.id::text||':'||a.revision::text||':'||k||':'||aud,k,aud,jsonb_build_object('booking',data,'staff_email',coalesce((select trim(email) from public.booking_staff where id=a.staff_id and trim(email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),'bencebalogh7777@gmail.com'))
 from unnest(array['guest','staff']) aud where aud='staff' or a.guest_email is not null
 on conflict(dedup_key) do nothing;
 return null;
end $$;
revoke all on function private.queue_booking_notification() from public,anon,authenticated,service_role;
create trigger transactional_notification after insert or update or delete on public.booking_appointments for each row execute function private.queue_booking_notification();

-- Every syntactically valid admin OTP request enqueues the same job, irrespective
-- of manager membership. Only the worker examines membership, after HTTP return.
create or replace function public.booking_queue_admin_otp(p_email text,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email';end if;
 insert into private.notification_outbox(dedup_key,kind,audience,payload,max_attempts)
 values('otp:'||p_request::text,'admin_otp','auth',jsonb_build_object('email',p_email),1) on conflict do nothing;
end $$;
create or replace function public.booking_claim_outbox(p_limit integer default 10)
returns table(id uuid,kind text,audience text,payload jsonb,lease_token uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 -- Explicit scalar columns keep the RPC independent of private-schema types.
 update private.notification_outbox o set status='failed',last_error='lease_exhausted',lease_token=null,lease_until=null
 where (o.status='processing' and o.lease_until<now() and o.attempts>=o.max_attempts)
 or (o.status in ('pending','processing') and o.created_at<now()-interval '23 hours');
 return query with jobs as (
 select r.id from private.notification_outbox r
 where ((r.status='pending' and r.available_at<=now()) or (r.status='processing' and r.lease_until<now())) and r.attempts<r.max_attempts
 order by r.available_at,r.id for update skip locked limit least(greatest(p_limit,1),25))
 update private.notification_outbox o set status='processing',attempts=o.attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
 from jobs where o.id=jobs.id returning o.id,o.kind,o.audience,o.payload,o.lease_token,o.created_at;
end $$;
create or replace function public.booking_finish_outbox(p_id uuid,p_lease uuid,p_success boolean,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update private.notification_outbox set status=case when p_success then 'sent' when attempts>=max_attempts then 'failed' else 'pending' end,
 sent_at=case when p_success then now() end,
 available_at=now()+make_interval(secs=>least(21600,30*power(2,least(attempts,10))::int)+floor(random()*15)::int),
 last_error=case when p_success then null else left(p_error,80) end,lease_until=null,lease_token=null
 where id=p_id and lease_token=p_lease and status='processing' and lease_until>now();
 get diagnostics n=row_count;return n=1;
end $$;
revoke all on function public.booking_queue_admin_otp(text,uuid),public.booking_claim_outbox(integer),public.booking_finish_outbox(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.booking_queue_admin_otp(text,uuid),public.booking_claim_outbox(integer),public.booking_finish_outbox(uuid,uuid,boolean,text) to service_role;

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
revoke all on function public.booking_security_maintenance() from public,anon,authenticated;
grant execute on function public.booking_security_maintenance() to service_role;
-- Auth deletion also purges queued and cached personal contact snapshots.
create or replace function private.anonymize_deleted_guest() returns trigger language plpgsql security definer set search_path='' as $$
declare previous_claims text:=current_setting('request.jwt.claims',true);
begin
 perform set_config('request.jwt.claims','{}',true);
 delete from public.trusted_devices where user_id=old.id;
 delete from private.booking_idempotency where user_id=old.id;
 update private.notification_outbox set payload='{}',status='failed',last_error='identity_deleted',lease_token=null,lease_until=null
 where payload->'booking'->>'user_id'=old.id::text or (kind='admin_otp' and payload->>'email'=lower(old.email));
 update public.booking_appointments set user_id=null,guest_email=null,guest_phone=null,guest_name='Törölt vendég' where user_id=old.id;
 update private.booking_monthly_series set guest_email=null,guest_phone='',guest_name='Törölt vendég',active=false where user_id=old.id;
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 return old;
end $$;

-- Read-only fallback for a delayed materialization job. No public GET writes rows.
create function public.booking_monthly_blocks(p_from date,p_to date,p_staff text) returns table(staff_id text,starts_at timestamptz,ends_at timestamptz)
language sql stable security definer set search_path='' as $$
 select s.staff_id,(d.occurrence_day+s.local_time) at time zone 'Europe/Budapest',((d.occurrence_day+s.local_time) at time zone 'Europe/Budapest')+make_interval(mins=>s.duration_minutes)
 from private.booking_monthly_series s
 cross join lateral generate_series(date_trunc('month',p_from),date_trunc('month',p_to-1),interval '1 month') m
 cross join lateral (select private.monthly_day(s.first_date,m::date) as occurrence_day) d
 where p_to>p_from and p_to-p_from<=93 and s.active and s.staff_id=p_staff and d.occurrence_day>=greatest(p_from,s.first_date) and d.occurrence_day<p_to
 and not exists(select 1 from public.booking_appointments a where a.monthly_series_id=s.id and a.monthly_date=d.occurrence_day)
 and not exists(select 1 from private.booking_monthly_exceptions e where e.series_id=s.id and e.occurrence_date=d.occurrence_day)
$$;
revoke all on function public.booking_monthly_blocks(date,date,text) from public,anon,authenticated;
grant execute on function public.booking_monthly_blocks(date,date,text) to service_role;

create function public.booking_session_active(p_user uuid,p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_user)
$$;
revoke all on function public.booking_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.booking_session_active(uuid,uuid) to service_role;

create function public.booking_save_hours(p_staff text,p_hours jsonb,p_revision bigint) returns void
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_revision is null then raise exception using errcode='40001',message='revision_required';end if;
 update public.booking_staff set name=name where id=p_staff and revision=p_revision;
 get diagnostics n=row_count;
 if n<>1 then raise exception using errcode='40001',message='revision_conflict';end if;
 perform public.booking_save_hours(p_staff,p_hours);
end $$;
revoke all on function public.booking_save_hours(text,jsonb,bigint) from public,anon,service_role;
grant execute on function public.booking_save_hours(text,jsonb,bigint) to authenticated;

create function public.booking_stop_monthly(p_id uuid,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_revision is null then raise exception using errcode='40001',message='revision_required';end if;
 update public.booking_appointments set revision=revision where id=p_id and revision=p_revision;
 get diagnostics n=row_count;if n<>1 then raise exception using errcode='40001',message='revision_conflict';end if;
 perform public.booking_stop_monthly(p_id);
end $$;
revoke all on function public.booking_stop_monthly(uuid,bigint) from public,anon,service_role;
grant execute on function public.booking_stop_monthly(uuid,bigint) to authenticated;

-- Finalize profile + manager mapping together after Auth provisioning. Auth itself
-- cannot join this transaction; an interrupted setup keeps its mapping inactive.
create function public.booking_save_staff_account(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare staff public.booking_staff; account public.booking_managers; old_account public.booking_managers; target public.booking_managers;
 target_email text:=p_data->>'email'; previous text:=nullif(p_data->>'previousEmail','');
begin
 select * into staff from public.booking_staff where id=p_data->>'staffId' for update;
 if staff.id is null or staff.revision<>(p_data->>'staffRevision')::bigint or p_data->>'staffRevision' is null then raise exception using errcode='40001',message='staff_revision_conflict';end if;
 select * into old_account from public.booking_managers where booking_managers.email=coalesce(previous,target_email) for update;
 if old_account.role is distinct from 'barber' or old_account.staff_id<>staff.id or old_account.revision<>(p_data->>'revision')::bigint or p_data->>'revision' is null then raise exception using errcode='40001',message='account_revision_conflict';end if;
 if previous is not null then
  if old_account.active or previous not like '%@pending.demeters.invalid' then raise exception using errcode='42501',message='invalid_placeholder';end if;
  select * into target from public.booking_managers where booking_managers.email=target_email for update;
  if target.email is not null then
   if target.role<>'barber' or target.staff_id<>staff.id or target.revision<>(p_data->>'targetRevision')::bigint or p_data->>'targetRevision' is null then raise exception using errcode='40001',message='target_revision_conflict';end if;
   update public.booking_managers set active=(p_data->>'active')::boolean where booking_managers.email=target_email returning * into account;
   delete from public.booking_managers where booking_managers.email=previous;
  else update public.booking_managers set email=p_data->>'email',active=(p_data->>'active')::boolean where booking_managers.email=previous returning * into account;
  end if;
 else update public.booking_managers set active=(p_data->>'active')::boolean where booking_managers.email=target_email returning * into account;
 end if;
 update public.booking_staff set name=p_data->>'name',active=case when coalesce((p_data->>'createStaff')::boolean,false) then true else active end where id=staff.id;
 return to_jsonb(account);
end $$;
revoke all on function public.booking_save_staff_account(jsonb) from public,anon,authenticated;
grant execute on function public.booking_save_staff_account(jsonb) to service_role;
commit;
