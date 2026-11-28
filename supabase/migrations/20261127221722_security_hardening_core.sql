begin;
create table if not exists private.security_settings (
 singleton boolean primary key default true check(singleton),
 max_future_bookings integer not null default 3 check(max_future_bookings between 1 and 100),
 require_staff_mfa boolean not null default false,
 admin_absolute_seconds integer not null default 86400 check(admin_absolute_seconds between 3600 and 604800),
 admin_idle_seconds integer not null default 1800 check(admin_idle_seconds between 300 and 43200)
);
insert into private.security_settings(singleton) values(true) on conflict do nothing;
alter table private.security_settings enable row level security;
revoke all on private.security_settings from public,anon,authenticated,service_role;
create or replace function public.booking_security_settings() returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(s)-'singleton' from private.security_settings s where singleton
$$;
revoke all on function public.booking_security_settings() from public,anon,authenticated;
grant execute on function public.booking_security_settings() to service_role;

create table if not exists private.rate_limits (
 key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
 hits integer not null, window_end timestamptz not null
);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public,anon,authenticated,service_role;
create index if not exists rate_limits_expiry_idx on private.rate_limits(window_end);
create or replace function public.booking_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; until_at timestamptz; t timestamptz:=clock_timestamp();
begin
 if p_key !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 10000 or p_seconds not between 1 and 86400 then raise exception 'invalid_rate_limit'; end if;
 insert into private.rate_limits as r(key_hash,hits,window_end) values(p_key,1,t+make_interval(secs=>p_seconds))
 on conflict(key_hash) do update set hits=case when r.window_end<=t then 1 else least(r.hits+1,1000000) end,
 window_end=case when r.window_end<=t then excluded.window_end else r.window_end end
 returning hits,window_end into n,until_at;
 return jsonb_build_object('allowed',n<=p_limit,'hits',n,'retry_after',greatest(1,ceil(extract(epoch from until_at-t))::int));
end $$;
revoke all on function public.booking_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.booking_rate_limit(text,integer,integer) to service_role;

-- Failed attempts have a separate source+identity backoff; success is not
-- delayed by a victim's email being attacked from another source.
create function public.booking_login_backoff(p_key text,p_failure boolean) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_key !~ '^[a-f0-9]{64}$' or p_failure is null then raise exception 'invalid_backoff';end if;
 if p_failure then
  insert into private.rate_limits as r(key_hash,hits,window_end) values(p_key,1,now()+interval '10 minutes')
  on conflict(key_hash) do update set hits=case when r.window_end<=now() then 1 else least(r.hits+1,20) end,
   window_end=case when r.window_end<=now() then excluded.window_end else r.window_end end returning hits into n;
 else select hits into n from private.rate_limits where key_hash=p_key and window_end>now();end if;
 return case when coalesce(n,0)<2 then 0 else least(1500,(100*power(2,least(n-2,4)))::int) end;
end $$;
revoke all on function public.booking_login_backoff(text,boolean) from public,anon,authenticated;
grant execute on function public.booking_login_backoff(text,boolean) to service_role;

-- Serializes all quota-affecting online writes for one guest, even across staff.
create or replace function private.guard_guest_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare cap integer;
begin
 if new.is_manual or new.status<>'confirmed' or new.starts_at<=now() then return new; end if;
 if new.user_id is null then
  if TG_OP='UPDATE' and old.user_id is not null then return new;end if;
  raise exception using errcode='23514',message='guest_required';
 end if;
 if TG_OP='UPDATE' and new.user_id is not distinct from old.user_id and old.status='confirmed' and old.starts_at>now() then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('demeters-quota:'||new.user_id::text,0));
 select max_future_bookings into cap from private.security_settings where singleton;
 if (select count(*) from public.booking_appointments where user_id=new.user_id and status='confirmed' and starts_at>now() and id<>new.id)>=cap then
  raise exception using errcode='P0001',message='booking_quota';
 end if;
 return new;
end $$;
revoke all on function private.guard_guest_quota() from public,anon,authenticated,service_role;
create trigger a0_guard_guest_quota before insert or update on public.booking_appointments for each row execute function private.guard_guest_quota();
create index if not exists booking_guest_future_idx on public.booking_appointments(user_id,starts_at) where status='confirmed';

-- Revisions are generated by the database, never chosen by a client.
create or replace function private.bump_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1;return new;end $$;
revoke all on function private.bump_revision() from public,anon,authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['booking_appointments','booking_staff','booking_services','booking_time_off','booking_managers'] loop
  execute format('alter table public.%I add column if not exists revision bigint not null default 1',t);
  execute format('create trigger z_bump_revision before update on public.%I for each row execute function private.bump_revision()',t);
 end loop;
end $$;

create table if not exists private.booking_idempotency (
 user_id uuid not null references auth.users(id) on delete cascade,
 key uuid not null, request_hash text not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id,key)
);
alter table private.booking_idempotency enable row level security;
revoke all on private.booking_idempotency from public,anon,authenticated,service_role;
create index if not exists booking_idempotency_expiry_idx on private.booking_idempotency(created_at);
create or replace function public.booking_idempotency_result(p_user uuid,p_key uuid,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare found private.booking_idempotency;
begin
 select * into found from private.booking_idempotency where user_id=p_user and key=p_key;
 if found.key is null then return null; end if;
 if found.request_hash<>p_hash then raise exception using errcode='P0001',message='idempotency_conflict'; end if;
 return found.result;
end $$;
create or replace function public.booking_create_idempotent(p_user uuid,p_key uuid,p_hash text,p_booking jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; a public.booking_appointments;
begin
 if p_user is null or p_key is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_idempotency'; end if;
 perform pg_advisory_xact_lock(hashtextextended('demeters-idempotency:'||p_user::text||':'||p_key::text,0));
 result:=public.booking_idempotency_result(p_user,p_key,p_hash);
 if result is not null then return result; end if;
 insert into public.booking_appointments(user_id,staff_id,service_id,starts_at,ends_at,price_huf,service_name_snapshot,duration_minutes_snapshot,guest_email,guest_name,guest_phone,status,is_manual)
 values(p_user,p_booking->>'staff_id',p_booking->>'service_id',(p_booking->>'starts_at')::timestamptz,(p_booking->>'ends_at')::timestamptz,(p_booking->>'price_huf')::integer,p_booking->>'service_name_snapshot',(p_booking->>'duration_minutes_snapshot')::integer,p_booking->>'guest_email',p_booking->>'guest_name',p_booking->>'guest_phone','confirmed',false) returning * into a;
 result:=(to_jsonb(a)-array['guest_email','guest_name','guest_phone','user_id'])||jsonb_build_object('staff_name',(select name from public.booking_staff where id=a.staff_id),'service_name',a.service_name_snapshot,'local_date',to_char(a.starts_at at time zone 'Europe/Budapest','YYYY-MM-DD'),'local_time',to_char(a.starts_at at time zone 'Europe/Budapest','HH24:MI'));
 insert into private.booking_idempotency(user_id,key,request_hash,result) values(p_user,p_key,p_hash,result);
 return result;
end $$;
revoke all on function public.booking_idempotency_result(uuid,uuid,text),public.booking_create_idempotent(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.booking_idempotency_result(uuid,uuid,text),public.booking_create_idempotent(uuid,uuid,text,jsonb) to service_role;

-- Deleting an Auth identity preserves booking history but removes contact data.
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.booking_appointments'::regclass and confrelid='auth.users'::regclass loop
  execute format('alter table public.booking_appointments drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.booking_appointments add constraint booking_appointments_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;
create or replace function private.anonymize_deleted_guest() returns trigger language plpgsql security definer set search_path='' as $$
declare previous_claims text:=current_setting('request.jwt.claims',true);
begin
 perform set_config('request.jwt.claims','{}',true);
 delete from public.trusted_devices where user_id=old.id;
 update public.booking_appointments set user_id=null,guest_email=null,guest_phone=null,guest_name='Törölt vendég' where user_id=old.id;
 update private.booking_monthly_series set guest_email=null,guest_phone='',guest_name='Törölt vendég',active=false where user_id=old.id;
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 return old;
end $$;
revoke all on function private.anonymize_deleted_guest() from public,anon,authenticated,service_role;
create trigger anonymize_deleted_guest before delete on auth.users for each row execute function private.anonymize_deleted_guest();
commit;
