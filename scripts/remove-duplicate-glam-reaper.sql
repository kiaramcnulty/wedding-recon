-- Remove the duplicate "Glam Reaper" vendor: keep the row that has a street
-- address, delete the row without one.
--
-- Context: two vendor rows exist for the same hair and makeup business
-- ("Glam Reaper" / "Colorado Glam Reaper"). vendors.google_place_id is unique,
-- so a second row can only mean one copy resolved to a real Google place and
-- carries a full street address, while the other came from web research and
-- sits on a city centroid with no street address. We keep the addressed row and
-- drop the other.
--
-- Cascade: deleting a vendors row removes everything that references it -
-- recon_entries -> recon_media, plus saved_vendors and reports (0001_init.sql).
-- So a single delete takes the vendor and any recon attached to it.
--
-- Safety: this mirrors the enrichvendors remove-vendors.mjs guard rails. The
-- delete refuses a row that was added by a real user (created_by set) or that
-- carries recon from a non-bot author, and it fires only when an address-bearing
-- twin still exists to keep. It is idempotent: a second run deletes 0 rows.
--
-- Apply by hand in the Supabase SQL editor, in order. Run STEP 1 first and read
-- the verdict column before running STEP 2.
--
-- Editor note: every comment here is apostrophe-free on purpose - the SQL editor
-- lexer treats an apostrophe inside a comment as an opening string quote and
-- desyncs, so contractions are spelled out.


-- STEP 1 - inspect. Lists every Glam Reaper row with its address, its
-- provenance, its recon and hub-save counts, and what STEP 2 would do to it (the
-- verdict column). Confirm the row you want gone reads DELETE candidate and the
-- row you want to keep reads KEEP before running anything below.
select
  v.id,
  v.name,
  v.vendor_type,
  v.address_text,
  v.city,
  v.region,
  v.source,
  v.google_place_id,
  (v.address_text ~ '[0-9]')             as has_street_number,
  v.created_by,
  coalesce(rc.total, 0)                  as recon_total,
  coalesce(rc.bot,   0)                  as recon_bot,
  coalesce(rc.human, 0)                  as recon_human,
  coalesce(sc.saves, 0)                  as hub_saves,
  case
    when (v.address_text ~ '[0-9]')      then 'KEEP - has street address'
    when v.created_by is not null        then 'BLOCKED - user-created vendor'
    when coalesce(rc.human, 0) > 0       then 'BLOCKED - has non-bot recon'
    else 'DELETE candidate - no street address'
  end                                    as verdict
from vendors v
left join lateral (
  select
    count(*)                             as total,
    count(*) filter (where p.is_bot)     as bot,
    count(*) filter (where not p.is_bot) as human
  from recon_entries re
  join profiles p on p.id = re.author_id
  where re.vendor_id = v.id
) rc on true
left join lateral (
  select count(*) as saves
  from saved_vendors s
  where s.vendor_id = v.id
) sc on true
where v.name ilike '%glam reaper%'
order by has_street_number desc nulls last, v.created_at;


-- STEP 2 - delete the address-less duplicate. Self-targeting and guarded: it
-- removes only a Glam Reaper row that has no street number, was not added by a
-- real user, and carries no non-bot recon, and only when an address-bearing twin
-- still exists to keep. Re-running deletes 0 rows.
delete from vendors v
where v.name ilike '%glam reaper%'
  and (v.address_text is null or v.address_text !~ '[0-9]')
  and v.created_by is null
  and not exists (
    select 1
    from recon_entries re
    join profiles p on p.id = re.author_id
    where re.vendor_id = v.id
      and p.is_bot = false
  )
  and exists (
    select 1
    from vendors k
    where k.id <> v.id
      and k.name ilike '%glam reaper%'
      and k.address_text ~ '[0-9]'
  );


-- STEP 2 (alternative, surgical) - if the verdict column in STEP 1 does not fit
-- your rows, delete by id instead. Take the id STEP 1 marked DELETE candidate,
-- put it in single quotes in place of the placeholder, remove the leading
-- dashes, and run. Keep the two guard lines so a user row or real-person recon
-- can never be hit.
--   delete from vendors v
--   where v.id = <PASTE_THE_ADDRESS_LESS_ROW_ID_IN_SINGLE_QUOTES>
--     and v.created_by is null
--     and not exists (
--       select 1
--       from recon_entries re
--       join profiles p on p.id = re.author_id
--       where re.vendor_id = v.id
--         and p.is_bot = false
--     );


-- STEP 3 - verify. Should now list only the kept row(s), each with an address.
select id, name, address_text, city, region, google_place_id
from vendors
where name ilike '%glam reaper%'
order by created_at;
