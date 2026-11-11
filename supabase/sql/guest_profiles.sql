-- Run once in the Supabase SQL Editor. Auth is managed by Supabase Auth, not this table.
create table if not exists public.guest_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (char_length(phone) between 7 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guest_profiles enable row level security;

-- The owner may only read/write their own record. No public/anon access.
drop policy if exists "Guest can read own profile" on public.guest_profiles;
create policy "Guest can read own profile" on public.guest_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Guest can create own profile" on public.guest_profiles;
create policy "Guest can create own profile" on public.guest_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Guest can update own profile" on public.guest_profiles;
create policy "Guest can update own profile" on public.guest_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Necessary if your Data API access grants are not automatic:
grant usage on schema public to authenticated;
grant select, insert, update on public.guest_profiles to authenticated;

-- updated_at trigger, no SECURITY DEFINER needed.
create or replace function public.touch_guest_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guest_profile_touch_updated_at on public.guest_profiles;
create trigger guest_profile_touch_updated_at
  before update on public.guest_profiles
  for each row execute function public.touch_guest_profile_updated_at();
