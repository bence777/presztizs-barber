-- Narrow compatibility repair for PGRST202 on public booking endpoints.
-- No appointment, profile, Auth, MFA or outbox changes.
-- Also safe after security_hardening_core: retain existing counters.
begin;
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

notify pgrst, 'reload schema';
commit;
