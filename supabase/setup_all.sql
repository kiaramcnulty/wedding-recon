-- Wedding Recon — core schema
-- Requires PostGIS for geospatial vendor queries.

create extension if not exists postgis;

-- Enums -----------------------------------------------------------------------
-- `music` is legacy — split into `dj` + `band` ("Live music"); see migrations
-- 0020/0021. Kept in the enum for parity so a hand-run of 0021 never errors.
create type vendor_type as enum ('venue','food','music','dj','band','flowers','dress','planner','photos','other');
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
-- Row-Level Security. Public read is intentional: shared vendor deeplinks must
-- render for people without an account.

alter table profiles enable row level security;
alter table vendors enable row level security;
alter table recon_entries enable row level security;
alter table recon_media enable row level security;
alter table saved_vendors enable row level security;
alter table reports enable row level security;

-- Profiles: usernames are public; users manage their own row. --------------
create policy "profiles are public" on profiles
  for select using (true);
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Vendors: public read; any authenticated user can add. --------------------
create policy "vendors are public" on vendors
  for select using (true);
create policy "authenticated insert vendors" on vendors
  for insert to authenticated with check (auth.uid() = created_by or created_by is null);

-- Recon entries: public can read only active entries; flagged/removed hidden.
create policy "active recon is public" on recon_entries
  for select using (status = 'active' or author_id = auth.uid());
create policy "authenticated insert recon" on recon_entries
  for insert to authenticated with check (auth.uid() = author_id);
create policy "authors update own recon" on recon_entries
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own recon" on recon_entries
  for delete using (auth.uid() = author_id);

-- Recon media: readable when its parent entry is readable. -----------------
create policy "recon media follows entry visibility" on recon_media
  for select using (
    exists (
      select 1 from recon_entries e
      where e.id = recon_media.recon_entry_id
        and (e.status = 'active' or e.author_id = auth.uid())
    )
  );
create policy "authors insert media for own recon" on recon_media
  for insert to authenticated with check (
    exists (
      select 1 from recon_entries e
      where e.id = recon_media.recon_entry_id and e.author_id = auth.uid()
    )
  );

-- Saved vendors: strictly private to the owner. ----------------------------
create policy "users read own saves" on saved_vendors
  for select using (auth.uid() = user_id);
create policy "users insert own saves" on saved_vendors
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own saves" on saved_vendors
  for delete using (auth.uid() = user_id);

-- Reports: any authenticated user can file one; nobody reads via the client.
create policy "authenticated file reports" on reports
  for insert to authenticated with check (auth.uid() = reporter_id);
-- Viewport query for the Explore map: returns vendors whose location falls
-- within the given bounding box, optionally filtered by type. Longitude/latitude
-- are flattened out of the PostGIS geography for easy client consumption.

create or replace function vendors_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  p_types vendor_type[] default null,
  max_rows integer default 500
)
returns table (
  id uuid,
  name text,
  vendor_type vendor_type,
  google_place_id text,
  address_text text,
  city text,
  region text,
  lng double precision,
  lat double precision,
  source vendor_source,
  created_by uuid,
  created_at timestamptz
)
language sql
stable
as $$
  select
    v.id, v.name, v.vendor_type, v.google_place_id, v.address_text, v.city, v.region,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat,
    v.source, v.created_by, v.created_at
  from vendors v
  where v.location is not null
    and st_intersects(
      v.location::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
    and (p_types is null or v.vendor_type = any(p_types))
  limit max_rows;
$$;

grant execute on function vendors_in_bbox(
  double precision, double precision, double precision, double precision, vendor_type[], integer
) to anon, authenticated;
-- Trust & safety: threshold auto-hide.
-- Once a recon entry accumulates REPORT_THRESHOLD distinct reports, it is flipped
-- to 'flagged' so the public RLS read policy stops serving it, pending review.
-- Nothing is ever hard-deleted; a moderator can restore via status from the
-- Supabase dashboard.

create or replace function handle_new_report()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  report_threshold constant integer := 2;
  report_count integer;
begin
  select count(*) into report_count
  from reports
  where recon_entry_id = new.recon_entry_id;

  if report_count >= report_threshold then
    update recon_entries
    set status = 'flagged'
    where id = new.recon_entry_id and status = 'active';
  end if;

  return new;
end;
$$;

create trigger on_report_created
  after insert on reports
  for each row execute function handle_new_report();
-- Public storage bucket for user-uploaded recon images.

insert into storage.buckets (id, name, public)
values ('recon-media', 'recon-media', true)
on conflict (id) do nothing;

-- Anyone can read (public bucket, used in <img> on public vendor pages).
create policy "recon media public read" on storage.objects
  for select using (bucket_id = 'recon-media');

-- Authenticated users can upload into the bucket.
create policy "authenticated upload recon media" on storage.objects
  for insert to authenticated with check (bucket_id = 'recon-media');

-- Uploaders can manage their own objects.
create policy "owners update recon media" on storage.objects
  for update to authenticated using (bucket_id = 'recon-media' and owner = auth.uid());
create policy "owners delete recon media" on storage.objects
  for delete to authenticated using (bucket_id = 'recon-media' and owner = auth.uid());
-- Denver, CO starter data so the Explore map isn't empty on day one.
-- Everything here is CLEARLY LABELED: vendors carry source='seed' and recon is
-- authored by the 'SampleData' profile with a [Sample] note prefix.
-- Run scripts/teardown-seed.sql to purge it all before launch.

create extension if not exists pgcrypto;

-- Sample author account (fixed UUID so the seed is idempotent / removable).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000aa',
  'authenticated', 'authenticated', 'sampledata@wedding-recon.local',
  crypt('seed-only-not-a-real-account', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
)
on conflict (id) do nothing;

-- The on_auth_user_created trigger creates a profile; set its username.
update profiles set username = 'SampleData'
where id = '00000000-0000-0000-0000-0000000000aa';

-- Seed vendors (fictional, plausible Denver-area businesses) ------------------
insert into vendors (id, name, vendor_type, address_text, city, region, location, source, created_by)
values
  ('00000000-0000-0000-0000-000000000101','Cranberry Ranch','venue','Foothills Rd','Denver','CO', st_setsrid(st_makepoint(-105.020, 39.760),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000102','Mile High Gardens','venue','E 17th Ave','Denver','CO', st_setsrid(st_makepoint(-104.960, 39.730),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000103','Platte River Pavilion','venue','Confluence Park','Denver','CO', st_setsrid(st_makepoint(-105.000, 39.753),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000104','Bloom & Co Florals','flowers','S Broadway','Denver','CO', st_setsrid(st_makepoint(-104.987, 39.740),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000105','Front Range Catering','food','Larimer St','Denver','CO', st_setsrid(st_makepoint(-104.970, 39.748),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000106','Aspen Strings Quartet','band','Capitol Hill','Denver','CO', st_setsrid(st_makepoint(-104.980, 39.737),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000107','Summit Sound DJs','dj','RiNo','Denver','CO', st_setsrid(st_makepoint(-104.983, 39.765),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000108','Rocky Mountain Photo','photos','Wash Park','Denver','CO', st_setsrid(st_makepoint(-104.965, 39.700),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-000000000109','Evergreen Event Planning','planner','LoDo','Denver','CO', st_setsrid(st_makepoint(-105.000, 39.752),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-00000000010a','The Bridal Loft','dress','Cherry Creek','Denver','CO', st_setsrid(st_makepoint(-104.955, 39.718),4326)::geography,'seed','00000000-0000-0000-0000-0000000000aa')
on conflict (id) do nothing;

-- A few sample recon entries -------------------------------------------------
insert into recon_entries (vendor_id, author_id, recon_type, price_text, price_details, notes, status)
values
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-0000000000aa','in_person','$8,000 – $10,000','Indoor barn only; outdoor adds ~$3k','[Sample] Beautiful but restrictive — you cannot choose your own food.','active'),
  ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-0000000000aa','virtual','$6,500 flat','Includes tables and chairs','[Sample] Gorgeous garden setting, very responsive coordinator.','active'),
  ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-0000000000aa','online','~10% of total floral spend','Minimum $2,500','[Sample] Strong reviews for seasonal arrangements.','active'),
  ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-0000000000aa','in_person','$95 / head','Plated dinner; tasting was free','[Sample] Appetizers were the standout; mains were just okay.','active')
on conflict do nothing;

-- Case-insensitive uniqueness on usernames (see migration 0006). Prevents
-- "spainlove26" and "SpainLove26" from both being registered. -----------------
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));
