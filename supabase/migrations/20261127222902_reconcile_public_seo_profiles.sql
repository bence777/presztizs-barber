-- Safe reconciliation for the observed live profile drift; no history replay.
-- Additive public profiles. Apply after the staff-services / device migrations.
-- Existing RLS, staff ownership, auth, appointments and service prices stay intact.
begin;
alter table public.booking_staff
  add column if not exists public_slug text,
  add column if not exists bio text not null default '' check(length(bio)<=3000),
  add column if not exists bio_en text not null default '' check(length(bio_en)<=3000),
  add column if not exists specializations text[] not null default '{}' check(cardinality(specializations)<=12),
  add column if not exists specializations_en text[] not null default '{}' check(cardinality(specializations_en)<=12),
  add column if not exists portfolio jsonb not null default '[]' check(jsonb_typeof(portfolio)='array' and jsonb_array_length(portfolio)<=24),
  add column if not exists social_links jsonb not null default '{}' check(jsonb_typeof(social_links)='object'),
  add column if not exists public_updated_at timestamptz;
-- IDs already use stable URL-safe names; changing the displayed name never changes the URL.
update public.booking_staff set public_slug=id where public_slug is null;
alter table public.booking_staff alter column public_slug set not null;
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.booking_staff'::regclass and conname='booking_staff_public_slug_format') then alter table public.booking_staff add constraint booking_staff_public_slug_format check(public_slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'); end if;end $$;
create unique index if not exists booking_staff_public_slug_idx on public.booking_staff(public_slug);

create table if not exists public.booking_staff_slug_history (
 slug text primary key check(slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
 staff_id text not null references public.booking_staff(id) on delete cascade
);
create index if not exists booking_staff_slug_history_staff_idx on public.booking_staff_slug_history(staff_id);
alter table public.booking_staff_slug_history enable row level security;
revoke all on public.booking_staff_slug_history from public,anon,authenticated;
grant select,insert,update,delete on public.booking_staff_slug_history to service_role;

-- This trigger only records aliases / serializes slug changes. All write authority
-- comes from the existing booking_staff grants and managed_booking_staff() RLS.
create or replace function private.track_public_staff_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='INSERT' then new.public_slug:=coalesce(new.public_slug,new.id); end if;
  if TG_OP='INSERT' or new.public_slug is distinct from old.public_slug then
    perform pg_advisory_xact_lock(hashtextextended('demeters-public-slugs',0));
    if exists(select 1 from public.booking_staff_slug_history h where h.slug=new.public_slug and h.staff_id<>new.id) then
      raise exception using errcode='23505',message='Ez a slug korábban már más fodrászhoz tartozott.';
    end if;
    if TG_OP='UPDATE' then
      insert into public.booking_staff_slug_history(slug,staff_id) values(old.public_slug,old.id)
        on conflict(slug) do nothing;
      delete from public.booking_staff_slug_history where slug=new.public_slug and staff_id=new.id;
    end if;
  end if;
  if TG_OP='INSERT' then
    new.public_updated_at:=now();
  elsif (new.name,new.image_url,new.public_phone,new.public_slug,new.bio,new.bio_en,new.specializations,new.specializations_en,new.portfolio,new.social_links,new.active)
    is distinct from (old.name,old.image_url,old.public_phone,old.public_slug,old.bio,old.bio_en,old.specializations,old.specializations_en,old.portfolio,old.social_links,old.active) then
    new.public_updated_at:=now();
  else new.public_updated_at:=old.public_updated_at; end if;
  return new;
end $$;
revoke all on function private.track_public_staff_profile() from public,anon,authenticated,service_role;
create or replace trigger track_public_staff_profile before insert or update on public.booking_staff
  for each row execute function private.track_public_staff_profile();
-- Extend column grants only. Existing row-level staff/admin isolation is unchanged.
grant update(public_slug,bio,bio_en,specializations,specializations_en,portfolio,social_links) on public.booking_staff to authenticated;

alter table public.booking_services
  add column if not exists name_en text not null default '' check(length(name_en)<=100),
  add column if not exists description_en text not null default '' check(length(description_en)<=2000);
commit;
