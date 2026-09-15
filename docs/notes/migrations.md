# Migration ledger

Every migration in `supabase/migrations/`, with its one-line purpose.

**Migrations are NOT auto-applied to the hosted DB** -- run new ones by hand in
the Supabase SQL editor. Read "Migrations" in `CLAUDE.md` first: the SQL editor's
client-side lexer has two failure modes (apostrophes in `--` comments, and
apostrophes inside a dollar-quoted body) that are invisible to `psql -f` and have
each cost a failed hand-apply.

## Applied state

**Verified against the hosted DB on 2026-09-12: everything through `0048` is
applied.** That was checked by probing for each added column, function, table and
storage bucket -- not by reading this file -- so it reflects the database, not
intent. Corpus at that check: **2,300 vendors, 3,595 recon entries**, storage
buckets `recon-media` and `vendor-media`.

There is consequently **nothing waiting to be hand-applied.** The long list of
"hand-apply before the first X upload" warnings that used to live in `CLAUDE.md`
is retired -- it had become a list of things already done, which is worse than no
list. When you ADD a migration, note it here as pending and re-check rather than
assuming.

How to re-check (read-only, no writes): probe for the specific column, function
or table a migration adds, using the service-role client. Parameter names matter
-- `vendors_in_bbox` takes `p_types` (an array), and `vendor_is_verified` takes
`p_vendor_id`; guessing wrong reports a live function as missing.

## The list

| # | File | What it does |
|---|------|--------------|
| 0001 | `0001_init.sql` | Wedding Recon — core schema Requires PostGIS for geospatial vendor queries |
| 0002 | `0002_rls.sql` | Row-Level Security |
| 0003 | `0003_rpc.sql` | Viewport query for the Explore map: returns vendors whose location falls within the given bounding box, option |
| 0004 | `0004_triggers.sql` | Trust & safety: threshold auto-hide |
| 0005 | `0005_storage.sql` | Public storage bucket for user-uploaded recon images |
| 0006 | `0006_username_case_insensitive.sql` | Enforce case-insensitive uniqueness on profile usernames |
| 0007 | `0007_tos_acceptance.sql` | Track when users accept the Terms of Service |
| 0008 | `0008_recon_collected_at.sql` | Add recon_collected_at to track when the recon was collected (month/year granularity) |
| 0009 | `0009_service_region.sql` | Add service_region to recon_entries for non-venue vendors (florist, caterer, etc.) |
| 0010 | `0010_recon_media_thumbs_and_limits.sql` | Recon media: add a thumbnail path and constrain the storage bucket |
| 0011 | `0011_vendor_website.sql` | Vendor website (from Google Place Details), shown as a "Visit website" link on the vendor page |
| 0012 | `0012_bot_profiles.sql` | Internal flag for seeded/curator bot accounts (enrichvenues pipeline) |
| 0013 | `0013_normalize_vendor_region.sql` | Canonicalize vendors.region to a 2-letter USPS state code |
| 0014 | `0014_vendor_google_photos.sql` | Cache of a venue's top Google Places photos (references only — never the image bytes; those are fetched on dem |
| 0015 | `0015_rate_limits.sql` | Postgres-backed fixed-window rate limiter, so limits hold across serverless instances (an in-memory counter do |
| 0016 | `0016_vendor_instagram.sql` | vendors.instagram — bare Instagram handle (no @, no URL), rendered as an "Instagram" link next to "Visit websi |
| 0017 | `0017_vendors_geom_index.sql` | vendors_in_bbox (0003) filters on st_intersects(location::geometry, …) |
| 0018 | `0018_search_vendors.sql` | Name/address vendor search for the Explore search bar |
| 0019 | `0019_search_vendors_tokenized.sql` | Token-aware vendor search for the Explore bar |
| 0020 | `0020_split_music_types.sql` | Split the legacy `music` vendor type into two: `dj` (DJs) and `band` ("Live music" — ALL live performers: band |
| 0021 | `0021_reclassify_music_vendors.sql` | Reclassify music vendors into `dj` / `band` ("Live music") — RECON-FIRST. RUN AFTER 0020 — the `dj`/`band` enu |
| 0022 | `0022_add_beauty_vendor_type.sql` | Add the `beauty` vendor type — wedding-day HAIR & MAKEUP artists, deliberately ONE joint category (Kiara, 2026 |
| 0023 | `0023_add_hotel_vendor_type.sql` | Add the `hotel` vendor type — hotels that hold a WEDDING ROOM BLOCK for guests |
| 0024 | `0024_remove_hotel_service_region.sql` | Hotel blocks are a fixed property in one place, not a service-area vendor — the "Service region" field never m |
| 0025 | `0025_search_vendors_shared.sql` | One vendor-search implementation for BOTH search surfaces |
| 0026 | `0026_search_vendors_typo_tolerance.sql` | Light typo tolerance for vendor search ("sanctaury" still finds "Sanctuary Golf Course"), for both search bars |
| 0027 | `0027_search_vendors_strict_word_similarity.sql` | Fix a class of false positive in the typo tier from `0026`: searching "sanctaury" returned "The Farmhouse Luxu |
| 0028 | `0028_recon_entry_edits.sql` | Recon entry editing: authors can revise their own entries |
| 0029 | `0029_vendor_location.sql` | Flatten ONE vendor location to lng/lat, for the map preview on the vendor page |
| 0030 | `0030_remove_dress_service_region.sql` | A bridal shop is a storefront you book an appointment at and return to for fittings — it never travels to the  |
| 0031 | `0031_unescape_recon_line_breaks.sql` | Literal line-break ESCAPES in recon text, printed as visible junk on the card |
| 0032 | `0032_vendor_filters.sql` | Vendor filter attributes |
| 0033 | `0033_vendors_in_bbox_filters.sql` | Carry filter attributes to the Explore map |
| 0034 | `0034_vendors_in_bbox_lean.sql` | Slim the Explore map payload down to what actually draws a pin |
| 0035 | `0035_vendors_in_bbox_ranking.sql` | Two ranking flags for the Explore list view: does this vendor have a price, and will its card draw a photo |
| 0036 | `0036_reword_quote_only.sql` | "Quote only" on bot recon entries: wrong when a number exists, confusing when it does not |
| 0037 | `0037_filters_meta_per_key.sql` | Per-key provenance for vendors.filters |
| 0038 | `0038_recon_marks_filters_dirty.sql` | Mark a vendor for filter reconciliation whenever its recon changes |
| 0039 | `0039_signup_attribution.sql` | First-touch marketing attribution, stamped onto the account at signup |
| 0040 | `0040_dirty_only_on_human_recon.sql` | Only HUMAN recon marks a vendor for filter reconciliation |
| 0041 | `0041_admin_permissions.sql` | Site admin accounts, and their first capability: editing bot-authored recon |
| 0042 | `0042_vendor_claims.sql` | Vendor Verification, part 1 of 4: business claims |
| 0043 | `0043_vendor_listings.sql` | Vendor Verification, part 2 of 4: the vendor-entered listing |
| 0044 | `0044_vendor_subscriptions.sql` | Vendor Verification, part 3 of 4: subscription state + the perks predicate |
| 0045 | `0045_vendors_in_bbox_verified.sql` | Vendor Verification, part 4 of 4: the verified flag on the map payload, and the read-time filter merge |
| 0046 | `0046_verified_listing_public.sql` | Vendor Verification: the public read of a verified vendor's listing content, for the vendor page |
| 0047 | `0047_vendor_media_bucket.sql` | Storage for vendor-uploaded listing photos (Vendor Verification) |
| 0048 | `0048_stripe_webhook_events.sql` | Vendor Verification billing: idempotency ledger for the Stripe webhook |

## Groups worth knowing as a set

- **`0020` + `0021` -- the music split.** Apply `0020` on its own FIRST (Postgres
  forbids adding an enum value and using it in the same transaction), then
  `0021`. `0021` is recon-first and **re-runnable + self-correcting**: it types
  each vendor from its recon act-type text, name only as a fallback, and fixes an
  earlier name-based mis-tag. Re-run it after enrichment adds recon, then run its
  commented REVIEW query and hand-fix the residue.
- **`0024` + `0030` -- the fixed-location cleanups.** Each nulls
  `recon_entries.service_region` for a type that never travels to the couple
  (hotels, then bridal shops). Re-runnable no-ops once done. The app-side list is
  `FIXED_LOCATION_TYPES` in `lib/constants/categories.ts`; the enrich pipeline
  mirrors it as `serviceRegionRequired` in `etype.mjs` -- **change both together.**
- **`0018` -> `0019` -> `0025` -> `0026` -> `0027` -- one search function,
  refined five times.** `0025` had to be `drop function` + `create` because the
  return shape changed; the typo tier (`0026`) is a plain `create or replace`.
  See `docs/notes/search.md`.
- **`0033` -> `0034` -> `0035` -> `0045` -- the map payload.** Each re-creates
  `vendors_in_bbox`, and each was **backward compatible in both directions**, so
  no coordinated deploy was ever needed: the client detects which shape it got.
  Preserve that property. See `docs/notes/explore-map.md` and
  `docs/notes/map-serving.md`.
- **`0031` + `0036` -- text repairs on bot recon only.** Both gate on
  `profiles.is_bot`: a real person who wrote those words must never be edited.
  `0031` ends with a count that must be **0**; `0036` ends with a REVIEW query
  that is a **worklist, not an assertion of zero**. See `docs/notes/recon-entries.md`.
- **`0038` + `0040` -- the dirty flag for filter reconciliation.** `0038` stamped
  every recon write; `0040` narrowed it to HUMAN recon only. Existing rows stay
  null (clean) on purpose -- a backfill would make the first run reconcile the
  whole corpus. See `docs/filter-recon-on-write.md`.
- **`0042`-`0048` -- Vendor Verification.** Apply in order. `0044` carries the
  perks predicate; `0045` re-creates the map RPCs. After applying, run
  `scripts/verified-rls-check.sql` on a real Supabase -- pglite cannot prove the
  SECURITY DEFINER boundary. See `docs/notes/admin-and-portal.md`.
