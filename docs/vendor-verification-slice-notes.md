# Vendor Verification — the verified-flag slice (as-built)

Branch: `claude/vendor-verified-slice`. This is the first slice of
`docs/vendor-verification-plan.md` — the DB perks predicate, its read-time
merge, and the verified flag threaded end-to-end into the map ordering and the
badge. **Nothing here touches prod until the migrations are hand-applied.**
Explicitly NOT in this slice: the portal, Stripe, the listing editor, and the
vendor-page listing CONTENT block (intro / CTA / pricing rows / vendor photos).
Those are later phases. This slice makes "verified" real and visible.

## What is in it

**Migrations (0042–0045)** — hand-apply in order in the Supabase SQL editor;
all idempotent, all backward-compatible (nothing breaks before they are
applied):
- `0042_vendor_claims.sql` — claims, auto-approved, one live claim per vendor.
- `0043_vendor_listings.sql` — the vendor-entered listing (draft until paid).
- `0044_vendor_subscriptions.sql` — subscription mirror (deny-all RLS) **plus
  the perks predicate**: `verified_vendor_ids()` (SECURITY DEFINER set
  function, `search_path` pinned), `verified_listing_overrides()`, and the
  scalar `vendor_is_verified()`.
- `0045_vendors_in_bbox_verified.sql` — re-creates `vendors_in_bbox` (adds the
  `verified` boolean via a set-based left join) and `vendor_filters_in_bbox`
  (read-time merge of a verified vendor's published `filter_overrides`).

**App:**
- `lib/map/rank.ts` — `RankedVendor` + `compareRanked` extracted from
  `vendor-map.tsx` so the ordering rule is node-testable. `verified` is the new
  key, immediately **after** `rank` (within-partition only) and before
  `matched`. `vendor-map.tsx`'s `rankVendor` sets `verified: v.verified === true`.
- `components/vendor/verified-badge.tsx` — the blue "Vendor verified" badge
  (icon-only variant for cards). No popover, per the locked decision.
- `components/map/vendor-preview-card.tsx` — resolves the verified set via a
  `verified_vendor_ids` RPC (a plain select cannot read the deny-all
  subscriptions table), renders the badge on all four card surfaces.
- `app/(app)/vendor/[id]/page.tsx` — header badge via `vendor_is_verified`.

Both new client RPC calls swallow errors as "not verified", so the app is
unchanged until the migrations are applied (same never-throw stance as search).

## How it was validated (all green)

- `node scripts/test-rank-order.mjs` — 7 checks on the comparator. The
  load-bearing one: a verified PARTIAL match never sorts above an unverified
  FULL match (verified is within-partition).
- `node scripts/test-verified-sql.mjs` — 20 checks running the **actual**
  0044/0045 function bodies against an embedded Postgres (pglite; PostGIS
  stubbed because that part is unchanged from 0034/0035). Covers every
  subscription state (unclaimed / no-sub / draft / active+published / revoked /
  past_due / p_ids isolation) and the jsonb merge (override wins, extracted
  survives, draft override does NOT leak, null-filters-with-overrides appears,
  evidence quotes still stripped, verified flag never null).

## The one thing you MUST check on a real Supabase before prod

pglite has no `anon`/`authenticated` roles, so it cannot prove the SECURITY
DEFINER boundary — that a **logged-out** couple gets the correct verified set
through the definer functions rather than an empty one (the classic silent
failure: everything looks fine, but no vendor ever shows verified in public).

Run `scripts/verified-rls-check.sql` on the **local `supabase` CLI stack or the
hosted SQL editor** after applying 0042–0045. It is transaction-wrapped with a
`ROLLBACK`, so it is safe to run even on prod — it sets `role anon`, asserts the
predicate sees the verified vendor while a direct read of `vendor_subscriptions`
returns nothing, and persists nothing. Every returned row must read `passed = true`.

## Test-mode fixtures (for driving the UI before Stripe exists)

To see a verified vendor in the running app before the billing phase exists,
hand-insert the three rows for one real vendor id (service role / SQL editor):

```sql
insert into vendor_claims (vendor_id, user_id, status, contact_email)
  values ('<vendor-id>', '<your-user-id>', 'approved', 'you@example.com');
insert into vendor_subscriptions (vendor_id, stripe_customer_id, status)
  values ('<vendor-id>', 'cus_test', 'active');
insert into vendor_listings (vendor_id, published, filter_overrides)
  values ('<vendor-id>', true, '{}'::jsonb);
```

Flip `vendor_subscriptions.status` to `past_due` (or `vendor_listings.published`
to false) and the badge + sort boost vanish everywhere — the cancellation
behavior, provable by hand today.
