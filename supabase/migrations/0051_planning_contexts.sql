-- 0051_planning_contexts.sql
-- Guided journey: the planning context of a couple, kept on their account.
--
-- The journey (venue or town, wedding month and year, preferences per vendor
-- type, where the couple left off) lives in the browser as wr:journey. This
-- table is the account copy, so the same answers follow a signed-in couple to
-- another device and survive clearing the browser. One row per account. The
-- app writes the whole journey as one JSON document and the newest copy wins
-- (lib/search/journey-sync.ts); the database does not interpret the payload.
--
-- Private on purpose. A booked venue and a wedding date are personal, and the
-- profiles table is publicly readable, so this is its own table and every
-- policy is owner only: a user reads, writes and deletes their own row and
-- nobody else can see it, signed in or not.
--
-- The size check keeps a buggy or hostile client from parking a large document
-- here. A real journey is well under 4 KB.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file.
-- Not auto-applied - hand-apply in the Supabase SQL editor. Idempotent.

create table if not exists planning_contexts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  schema_version smallint not null default 1,
  updated_at timestamptz not null default now()
);

alter table planning_contexts
  drop constraint if exists planning_contexts_payload_size;
alter table planning_contexts
  add constraint planning_contexts_payload_size
  check (pg_column_size(payload) <= 32768);

alter table planning_contexts
  drop constraint if exists planning_contexts_payload_object;
alter table planning_contexts
  add constraint planning_contexts_payload_object
  check (jsonb_typeof(payload) = 'object');

alter table planning_contexts enable row level security;

drop policy if exists "users read own planning context" on planning_contexts;
create policy "users read own planning context" on planning_contexts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own planning context" on planning_contexts;
create policy "users insert own planning context" on planning_contexts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update own planning context" on planning_contexts;
create policy "users update own planning context" on planning_contexts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own planning context" on planning_contexts;
create policy "users delete own planning context" on planning_contexts
  for delete to authenticated using (auth.uid() = user_id);

-- Check after applying (signed in as nobody in particular, this is just shape):
-- select count(*) from planning_contexts;   -- 0 rows, no error
