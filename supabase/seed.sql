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
