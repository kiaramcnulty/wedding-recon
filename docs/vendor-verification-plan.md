# Vendor Verification — implementation plan

Status: **approved for build, not yet started.** This document is the execution
spec: every product decision in it has been made and signed off by Kiara
(2026-08-25). The executing agent should follow it as written and should NOT
re-litigate the decisions in "Locked decisions". Where this doc says "verify"
or "measure", actually do it — those are acceptance gates, not suggestions.

Read `CLAUDE.md` first. Every house convention there applies (migrations are
hand-applied and idempotent; no apostrophes in SQL comments; `<ExternalLink>`
for external links; `cn(buttonVariants(...))`; dynamic routes need
`loading.tsx`; copy says "Vendor" never "Business"; no em dashes in user-facing
copy — spaced hyphens).

## What this is

A paid tier ("Vendor Verification", $20/month with 6 months prepaid up front)
that lets a wedding vendor claim their listing, keep its info accurate, and get
a verified badge + modest ranking boost + a CTA button shown to couples.
Full background: `Wedding Recon - Vendor Verification.pdf` (Kiara's spec) —
but where that PDF and this doc disagree, **this doc wins**; it incorporates
the review discussion that amended the spec.

## Locked decisions (do not reopen)

| Decision | Resolution |
|---|---|
| Badge semantics | The badge asserts "identity confirmed + info maintained by the business". Payment is the gate, not the meaning. A small info affordance (tooltip/sheet) on the badge states this in one line. |
| Badge color | Blue check (verified convention), NOT green (green = brand + venue category). Default `#2563EB`; must be visually checked side-by-side against photos-category blue `#378ADD` — a deeper blue + different shape (check-in-circle) is the separation. Badge = icon + "Verified vendor" subtext next to the name. |
| Badge surfaces | Vendor page header, `vendor-preview-card.tsx` (covers cluster feed, results feed, pin peek, Hub at once). **Never on map pins** — the pin signal budget (dashed/ring/halo) is spent. |
| Ranking | Verified sorts first **within its partition only**: a new key in `compareRanked()` immediately after the `rank` key (before `matched`). Applies to Explore's results feed + cluster feed (automatic — shared comparator). **The Hub is NOT re-sorted** — it is the couple's own planning space; badge yes, boost no. |
| Vendor data | Vendor-entered data is a **separate labeled source, never an overwrite**. It lives in its own table and is merged at read time only while perks are active. Cancellation = the merge stops; `vendors` rows are never mutated by the portal. Pricing: displayed as its own labeled block; recon entries and recon-derived rank pricing are untouched. Factual overrides (website, instagram, filter tags) DO win over extracted data while active, labeled "Provided by vendor". |
| Claims | **Auto-approved on submission.** Kiara reviews retroactively via (a) an email report per new claim + per completed checkout, and (b) a minimal admin page where she can revoke. No pre-approval gate anywhere in the flow. |
| Billing | Stripe only. $120 Checkout up front covering 6 months, then $20/month auto-renew, via a Subscription Schedule (see Billing section). Stripe Customer Portal handles card updates/cancel/invoices. **Never build billing UI; never store card data.** |
| Free tier | None for now. Claiming is free to *do*, but nothing is published (no badge, no overrides, no CTA) until the subscription is active. |
| Portal + recon | The portal **never displays recon entries and never links to the vendor's public page**. Vendors edit only their own draft fields. |
| Portal layout | Responsive: must work well on phones AND desktop. Single column, `max-w-[760px]` (the Hub's width), fluid below that. No bottom nav, not inside the 480px app frame. |
| Pricing input | Repeatable rows `{label, price, unit}`, not an n×n grid. The editor shows a live rendered preview of the public pricing block so vendors can see the formatting they get. |
| CTA | Label from a fixed enum (no free text): "Book a tour", "Check availability", "Contact us", "Get a quote". URL https-only. Rendered with `<ExternalLink>` as a plain new-tab link (no overlay embed check for MVP). |
| Analytics | PostHog (already wired — see Analytics section). No new analytics product. Revenue reporting = Stripe dashboard. |

## Non-negotiable guardrails

1. **Never write portal data onto `vendors` or `recon_entries`.** All
   vendor-entered content lives in `vendor_listings`. The merge happens in the
   two bbox RPCs (SQL) and in the vendor page query (join). This is what makes
   cancellation a boolean flip.
2. **Subscription state is server-authoritative.** `vendor_subscriptions` is
   written ONLY by the Stripe webhook route using the service-role client. It
   has no client RLS policies at all (no select needed client-side — the
   portal reads it through a server component).
3. **Perks-active is one predicate, used everywhere:** claim `approved` AND
   subscription active AND listing published. Implement it once as a SQL
   helper (see migration 0043) and once in TS; never inline the logic a third
   time.
4. **RPC changes follow the 0034/0035 pattern:** `drop function` + `create`
   when the return shape changes, backward compatible in both directions,
   client guards with `=== true` so an unapplied migration degrades to
   "feature off", never to wrong behavior.
5. **Do not gate public pages on auth** (existing rule — shared deeplinks must
   render logged out). The portal routes are the only new authed surface.
6. Vendor-uploaded photos follow the existing pipeline: client-side compress
   (`lib/image-compress.ts`) + direct-to-Storage upload; Server Actions only
   record paths. Never route image bytes through an action.

## Schema — four new migrations (numbering starts at 0041)

All idempotent, hand-applied in the Supabase SQL editor. Remember: no
apostrophes in SQL comments, one ALTER per constraint, doubled apostrophes in
string literals, no dollar-quoted bodies containing apostrophes.

### 0041_vendor_claims.sql
```sql
create table if not exists vendor_claims (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'approved'
    check (status in ('approved','revoked')),
  claimant_role text,          -- e.g. owner, manager (free text, short)
  contact_email text not null, -- the auth email at claim time, denormalized
  email_domain_matches_website boolean, -- computed at claim time, for review
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- one live claim per vendor; a revoked claim frees the vendor again
create unique index if not exists idx_vendor_claims_one_live
  on vendor_claims (vendor_id) where (status = 'approved');
create index if not exists idx_vendor_claims_user on vendor_claims (user_id);
```
RLS: enable; authenticated users can `insert` a row for themselves
(`user_id = auth.uid()`) and `select` their own rows. No update/delete
policies (revocation goes through the service role via the admin page).
Status defaults to `approved` — that IS the auto-approve.

### 0042_vendor_listings.sql
```sql
create table if not exists vendor_listings (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  intro text,                       -- cap ~600 chars via check constraint
  cta_label text
    check (cta_label in ('Book a tour','Check availability','Contact us','Get a quote')),
  cta_url text check (cta_url is null or cta_url like 'https://%'),
  website text,
  instagram text,                   -- bare handle, same convention as vendors.instagram
  pricing jsonb not null default '[]'::jsonb, -- [{label, price, unit}]
  filter_overrides jsonb not null default '{}'::jsonb, -- same shape as vendors.filters
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
```
RLS: enable; select/insert/update allowed when the caller holds the approved
claim: `exists (select 1 from vendor_claims c where c.vendor_id = vendor_id
and c.user_id = auth.uid() and c.status = 'approved')`. Public (anon) select
is NOT granted — public reads go through the RPCs/joins which already gate on
perks-active, and granting anon select would leak unpublished drafts.

### 0043_vendor_subscriptions.sql
```sql
create table if not exists vendor_subscriptions (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'inactive',  -- mirror of Stripe status: active, past_due, canceled, inactive
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
No RLS policies for clients (service-role writes only; enable RLS with no
policies = deny all, which is correct).
Also define the single perks predicate as a SQL function, used by 0044 and any
future query:
```sql
create or replace function vendor_is_verified(p_vendor_id uuid)
returns boolean language sql stable as
'select exists (
   select 1 from vendor_claims c
   join vendor_subscriptions s on s.vendor_id = c.vendor_id
   join vendor_listings l on l.vendor_id = c.vendor_id
   where c.vendor_id = p_vendor_id
     and c.status = ''approved''
     and s.status = ''active''
     and l.published = true
 )';
```
(Grace period: Stripe keeps status `active` until an invoice actually fails;
`past_due` = perks off. That is the intended behavior — no custom grace logic.)

### 0044_vendors_in_bbox_verified.sql
Re-create `vendors_in_bbox` (drop + create, return shape changes) adding
`verified boolean` (via `vendor_is_verified`, `coalesce(..., false)` — the
0035 NULL lesson applies). Re-create `vendor_filters_in_bbox` so that for a
verified vendor, `filters` is `vendors.filters || vendor_listings.filter_overrides`
(jsonb concat: override keys win, extracted keys survive where not overridden).
Client work in `vendor-map.tsx`: read `verified === true` per row, thread it
into `RankedVendor`, and treat a missing column as false — so the app deploys
before or after the migration with no coordination, same as 0034/0035.

## Billing (Stripe)

**Products/prices (one-time setup in the Stripe dashboard, document IDs in
`.env.local`):** one Product "Vendor Verification"; Price A = $120 every 6
months; Price B = $20 monthly.

**Purchase flow:** portal "Activate verification" button → server action
creates a Checkout Session (mode `subscription`, Price A, `client_reference_id`
= vendor_id, customer email prefilled) → redirect to Stripe → success URL back
to the portal.

**Webhook route** `app/api/stripe-webhook/route.ts` (verify signature with
`STRIPE_WEBHOOK_SECRET`; service-role client; idempotent handlers):
- `checkout.session.completed`: upsert `vendor_subscriptions` (customer id,
  subscription id, status active, period end). Then create a Subscription
  Schedule `from_subscription`, phases = [current phase: Price A, 1 iteration,
  then: Price B monthly], `end_behavior: 'release'`. Release means that after
  month 6 it becomes a plain monthly subscription with full Customer Portal
  support. Send the claim-report email (below) noting payment completed.
- `customer.subscription.updated` / `invoice.paid` / `invoice.payment_failed`
  / `customer.subscription.deleted`: mirror status + `current_period_end` onto
  the row.

**Cancel/card management:** the portal's billing card links to a Stripe
Customer Portal session (server action creates it). During the prepaid phase a
cancel = no renewal at month 6 (they keep what they paid for); after release,
standard monthly cancel-at-period-end. Configure the Customer Portal in the
Stripe dashboard: cancel enabled, plan switching disabled.

**Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_6MO`, `STRIPE_PRICE_MONTHLY` in `.env.local` + `.env.example`
with comments in `SETUP.md`. The `stripe` npm package is the one new
dependency (free).

**Refund/abuse runbook (manual, for Kiara, include in the portal admin page as
a note):** if a claim turns out fraudulent — revoke the claim in the admin
page (kills perks instantly via the predicate), then cancel + refund in the
Stripe dashboard by hand. No code path needed.

## Claim reports (retroactive review)

No transactional email infra exists in the repo today. Use **Resend**
(free tier, one API call): `lib/notify/claim-report.ts` sending to
`kiaramcnulty@gmail.com` on (a) claim created, (b) checkout completed. Content:
vendor name, city, type, claimant email, whether the email domain matches the
vendor website domain (the `email_domain_matches_website` flag — compute at
claim time by comparing the auth email domain to the hostname of
`vendors.website`), link to the admin page. Env: `RESEND_API_KEY`,
`CLAIM_REPORT_EMAIL`. **If the key is unset, log and continue** — email must
never fail a claim. Also stamp the same info as a PostHog server event so
there is a queryable trail independent of email.

## Portal (`app/(portal)/portal/...`)

New route group: no bottom nav, no 480px frame, responsive single column
`max-w-[760px] mx-auto px-4`. Auth = the existing email-OTP flow (reuse
`(auth)` components; sign-in redirects back to `/portal` via the existing
`from` param pattern — validate it as always). Add `loading.tsx` to every
dynamic portal route.

Screens:
1. **`/portal`** — dashboard. If no claim: the claim flow. If claimed: cards
   for Listing (edit link + published state), Billing (status,
   activate/manage), and later Stats.
2. **Claim flow** — reuse the Add Recon business combobox
   (`components/add/places-combobox.tsx`) exactly as Add Recon uses it:
   existing vendor → claim it; Google result / manual → create the vendor row
   (same server path Add Recon uses, which already dedups on
   `google_place_id`) → claim it. If the vendor already has a live claim,
   show "Already claimed - contact us" (the partial unique index enforces it;
   handle the 23505 gracefully, existing convention).
3. **`/portal/listing`** — the editor: intro (char-limited textarea), CTA
   label (select from the enum) + URL, website, instagram, photos (max 4,
   existing compress+upload pipeline, storage prefix `vendor-media/`),
   pricing rows (add/remove/reorder rows of label/price/unit), and the filter
   tag editor. **Filter controls are generated from
   `filtersForType(vendorType)` in `lib/constants/vendor-filters.ts`** — the
   same `FilterDef[]` the Explore filter sheet renders, so the editable set
   can never drift from the filterable set. `multi` → checkboxes, `bool` →
   yes/no/unset (unset = no override), `range` → min/max inputs. Below the
   form: a live preview of the public pricing block + intro exactly as the
   vendor page will render them. One Save button (server action, upsert
   `vendor_listings`, `published = true` on first save once billing is
   active; if billing is not active, save as draft and surface the Activate
   step).
4. **`/portal/billing`** — status + the Checkout / Customer Portal links.
5. **`/portal/admin`** — Kiara only: gate on `getClaims()` sub equal to env
   `ADMIN_USER_ID`. Table of claims (newest first) with the domain-match
   flag, subscription status, and a Revoke button (server action, service
   role: set claim `revoked` + `revoked_at`). Nothing fancier.

**The portal never renders recon entries and never links to the public vendor
page.** The live preview renders only vendor-entered fields.

## Public app surfaces

1. **`VerifiedBadge` component** (`components/vendor/verified-badge.tsx`):
   blue check-in-circle + "Verified vendor" text, with an info popover: "This
   business confirmed its identity and maintains its own listing info." One
   component, used everywhere the badge appears.
2. **Vendor page** (`app/(app)/vendor/[id]/page.tsx`): extend the existing
   cached `getVendor(id)` query (React `cache()` — keep the one-query rule)
   to join `vendor_listings` + the verified predicate. When verified: a
   compact header block above the photos — badge, intro clamped to 2 lines
   with an expand toggle, CTA button (`<ExternalLink>`,
   `cn(buttonVariants())`). Pricing rows render as a collapsible section
   BELOW the photo strip, labeled "Pricing - provided by vendor". Website /
   instagram links and the filter chips show a small "Provided by vendor"
   annotation when they come from overrides. **Acceptance gate: on a 390x844
   viewport the first recon card must still be reachable at or near the fold
   — measure before/after like the media-block work did; if the header pushes
   recon meaningfully down, tighten the header, not the recon.**
3. **Preview card** (`components/map/vendor-preview-card.tsx`): badge next to
   the name. `useVendorPreviews` must select the verified flag (add to its
   query); all four surfaces (cluster feed, results feed, pin peek, Hub) get
   it automatically.
4. **List order** (`components/map/vendor-map.tsx`): add `verified` to
   `RankedVendor`; in `compareRanked()` insert the key after `rank`, before
   `matched`. Missing/undefined compares as false (`=== true`). Update
   `scripts/test-filter-match.mjs`-adjacent coverage if any touches the
   comparator; at minimum add a small node test for the comparator ordering.
   The Hub does not use this comparator — confirm nothing re-sorts there.
5. **Acquisition links:** (a) quiet line at the bottom of every vendor page:
   "Are you the owner? Verify this business" → `/portal`; (b) "For vendors"
   link in the landing page footer → `/portal`. Landing page stays
   couple-first — footer only, no hero changes.

## Analytics (PostHog — already wired)

Client events: extend the typed `ClientEvents` map in
`lib/analytics/posthog.ts` (see the existing three events for the pattern):
- `vendor_verify_link_clicked: { source: "vendor_page" | "landing_footer" }`
- `vendor_cta_clicked: { vendor_id: string; cta_label: string }`

Server events: extend `ServerEvent` in `lib/analytics/posthog-server.ts`:
- `vendor_claim_created`, `vendor_checkout_completed` (fired from the claim
  action and the webhook).

`vendor_cta_clicked` doubles as the future retention stat ("your button got N
clicks") — no extra infra needed to add that to the portal later.

## Build order (each phase ships and builds independently)

**Phase 1 — claims + portal shell.** Migrations 0041–0043 written (hand-apply
checklist in the PR description), portal route group + auth + claim flow +
admin page + claim-report email. Gate: a fresh account can claim a seeded
vendor end to end; second claim on the same vendor is cleanly refused; report
email arrives (or logs when key unset); `npm run build` passes.

**Phase 2 — editor + public surfaces.** Migration 0044, listing editor with
live preview, vendor page header + pricing block, badge on card + page,
comparator key, RPC merge. Gate: with a hand-inserted active subscription row,
the badge/CTA/overrides appear everywhere listed and vanish when the row is
flipped inactive; the fold measurement passes; `verify` skill walk of Explore
list order shows the verified vendor first within its partition and NOT above
the partial-match divider when it is a partial match.

**Phase 3 — Stripe.** Checkout, webhook, schedule creation, Customer Portal
link, billing card. Gate: Stripe test-mode end-to-end (test clock optional but
recommended for the 6-month phase transition); webhook signature verification
rejects unsigned payloads; canceling in the Customer Portal flips perks off at
period end.

**Phase 4 — analytics + acquisition links.** Events above, the two links.
Gate: events visible in PostHog; links present; build passes.

## Explicitly deferred (do not build now)

- Free claim tier; recon dispute tooling in the portal (Kiara mediates by
  hand); vendor stats card; n×n pricing matrix; auto-approval hardening
  (domain-match auto-checks are recorded but nothing gates on them); badge on
  map pins (never, per decision); embed-overlay for CTA links; multi-vendor
  claims UX polish (one account CAN hold claims on multiple vendors — the
  schema allows it; the portal can show a simple vendor switcher if trivial,
  otherwise first claim only and note it).
