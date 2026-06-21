-- Wedding Recon — core schema
-- Requires PostGIS for geospatial vendor queries.

create extension if not exists postgis;

-- Enums -----------------------------------------------------------------------
create type vendor_type as enum ('venue','food','music','flowers','dress','planner','photos','other');
create type vendor_source as enum ('google','user','seed');
create type recon_type as enum ('online','virtual','in_person');
create type recon_status as enum ('active','flagged','removed');
create type report_status as enum ('open','reviewed','dismissed');

-- Profiles (1:1 with auth.users) ---------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 30),
  created_at timestamptz not null default now()
);

-- Canonical vendors -----------------------------------------------------------
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor_type vendor_type not null,
  google_place_id text unique,
  address_text text,
  city text,
  region text,
  location geography(Point, 4326),
  source vendor_source not null default 'user',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index vendors_location_gix on vendors using gist (location);
create index vendors_type_idx on vendors (vendor_type);
-- Soft-dedup helper for user-created vendors (normalized name + city).
create index vendors_name_city_idx on vendors (lower(name), lower(coalesce(city, '')));

-- Recon entries ---------------------------------------------------------------
create table recon_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  recon_type recon_type not null,
  price_text text,
  price_details text,
  notes text,
  status recon_status not null default 'active',
  created_at timestamptz not null default now()
);

create index recon_entries_vendor_idx on recon_entries (vendor_id);
create index recon_entries_author_idx on recon_entries (author_id);
create index recon_entries_status_idx on recon_entries (status);

-- Recon media (images only for MVP) ------------------------------------------
create table recon_media (
  id uuid primary key default gen_random_uuid(),
  recon_entry_id uuid not null references recon_entries (id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image',
  created_at timestamptz not null default now()
);

create index recon_media_entry_idx on recon_media (recon_entry_id);

-- Planning hub saves ----------------------------------------------------------
create table saved_vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  vendor_id uuid not null references vendors (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, vendor_id)
);

create index saved_vendors_user_idx on saved_vendors (user_id);

-- Moderation reports ----------------------------------------------------------
create table reports (
  id uuid primary key default gen_random_uuid(),
  recon_entry_id uuid not null references recon_entries (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete cascade,
  reason text,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (recon_entry_id, reporter_id)
);

create index reports_entry_idx on reports (recon_entry_id);

-- Auto-create a profile row on signup (username defaults to a temporary value;
-- the onboarding step lets the user choose a real anonymous username).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'user_' || substr(new.id::text, 1, 8))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
