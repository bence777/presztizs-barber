-- PRESZTÍZS BARBER / valós foglalási adatmodell
-- Az összekapcsolt Supabase-projekten ez a migráció már lefutott.
-- Új adatbázisban egyszer futtasd; a constraint-ek ismételt létrehozása hibázik.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;

create table if not exists public.booking_services (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 15 and 240 and duration_minutes % 15 = 0),
  price_huf integer not null check (price_huf >= 0),
  active boolean not null default false,
  sort_order integer not null default 0
);
create table if not exists public.booking_staff (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text not null check (char_length(name) between 2 and 100),
  role text not null default 'Barber',
  image_url text,
  active boolean not null default false,
  sort_order integer not null default 0
);
create table if not exists public.booking_hours (
  id bigint generated always as identity primary key,
  staff_id text not null references public.booking_staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  check (closes > opens),
  unique(staff_id, weekday, opens, closes)
);
create table if not exists public.booking_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references public.booking_staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);
create table if not exists public.booking_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_id text not null references public.booking_staff(id),
  service_id text not null references public.booking_services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_huf integer not null check (price_huf >= 0),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at)
);
create index if not exists booking_appointments_future_idx
  on public.booking_appointments(starts_at) where status = 'confirmed';
create index if not exists booking_time_off_times_idx
  on public.booking_time_off(starts_at, ends_at);

-- Két párhuzamos mentési kérés sem tud két egymásra eső foglalást létrehozni.
alter table public.booking_appointments add constraint booking_no_staff_overlap
  exclude using gist (staff_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'confirmed');
alter table public.booking_appointments add constraint booking_no_guest_overlap
  exclude using gist (user_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'confirmed');

alter table public.booking_services enable row level security;
alter table public.booking_staff enable row level security;
alter table public.booking_hours enable row level security;
alter table public.booking_time_off enable row level security;
alter table public.booking_appointments enable row level security;

-- A weboldal csak szerveroldali Supabase secret key-jel kérdezhet rá a foglaltságra.
revoke all on public.booking_services, public.booking_staff, public.booking_hours,
  public.booking_time_off, public.booking_appointments from anon, authenticated;
grant select on public.booking_appointments to authenticated;
drop policy if exists "Guests see own bookings" on public.booking_appointments;
create policy "Guests see own bookings" on public.booking_appointments
  for select to authenticated using ((select auth.uid()) = user_id);
grant all on public.booking_services, public.booking_staff, public.booking_hours,
  public.booking_time_off, public.booking_appointments to service_role;
grant usage, select on all sequences in schema public to service_role;

reset search_path;
