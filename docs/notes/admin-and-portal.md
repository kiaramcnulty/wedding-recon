# Admin permissions and the vendor portal (paid tier)

The two surfaces that are not the couple-facing app: the site-admin flag, and the
Vendor Verification paid tier a vendor uses to claim and dress up their listing.

### Admin permissions (`is_admin`, migration `0041`)
- **One flag, deliberately small.** `profiles.is_admin` (mirrors `is_bot`) is the whole model — a future admin power gates on the same boolean; it becomes a roles table only once one boolean can no longer express the set, not before. `lib/auth/admin.ts` `isAdminUser(supabase, userId)` is the ONE place app code asks "is this account an admin", so every admin-gated surface shares a single definition; it fails **closed** (null user or query error → `false`) and reads the public-readable `profiles` under the caller's own RLS, so it is safe on the public vendor page for a logged-out viewer.
- **First capability: editing bot-authored recon.** An admin gets the existing "· Edit" control on **bot** entries that aren't their own — never a real person's, the same line `0036`/`0040` draw by gating on `is_bot`. Scoped that way in all four layers that gate a recon edit: the RLS UPDATE policy (`admins update bot recon`, **additive** to the untouched author policy — permissive policies OR, so authorship and admin stay two separate capabilities), the `updateRecon` action, the edit page's render gate, and the card's control. **RLS is the boundary; the app-code checks are the friendly errors.** The write still runs on the RLS-enforced client (not the service role), so the DB enforces the bot-scope even if an app check were bypassed.
- **The control is `is_site_admin()` in SQL, `isAdminUser()` in TS** — keep them the same rule. The SQL helper is `STABLE SECURITY DEFINER` (reads `profiles` past RLS, cached per statement) and named `is_site_admin` so it never reads as the `is_admin` column inside a policy. Only Kiara ever sees the admin pill: it renders server-side, gated on `viewerIsAdmin`, and shows a neutral-stone "Admin · Edit" (green stays "My recon", i.e. *yours*). It replaces the report button on that card — reporting a curated entry to yourself is moot.
- **Not extended to flagged/removed entries.** The edit surface only appears on the active entries the vendor page lists, and RLS SELECT already hides non-active foreign entries from an admin, so admin editing matches exactly where the existing edit UI lives. Widening to moderation (read/edit flagged) would need SELECT-policy changes too — out of scope for now.


## Vendor Verification -- the paid tier (migrations `0042`-`0048`)

**Shipped and deployed.** Merged as PR #57 on 2026-09-13; `/portal` is live in
production and every migration through `0048` is applied to the hosted DB. The
plan is `docs/vendor-verification-plan.md`; the **as-built** record, phase by
phase, is `docs/vendor-verification-slice-notes.md` -- read that before changing
any of it, because it records what each slice deliberately left out.

- **`vendor_claims` / `vendor_listings` / `vendor_subscriptions` are one
  pipeline, and "verified" is a PREDICATE over all three** -- not a column
  anybody sets. `verified_vendor_ids()` (`0044`, SECURITY DEFINER with
  `search_path` pinned) is the single definition: an approved claim, an active
  subscription, AND a published listing. Flip `vendor_subscriptions.status` to
  `past_due` or `vendor_listings.published` to false and the badge plus the sort
  boost vanish everywhere at once. There is no cached copy to invalidate.
- **The definer functions exist because `vendor_subscriptions` is deny-all
  RLS.** A logged-out couple must still see who is verified, so the predicate is
  consumed through `verified_vendor_ids` / `vendor_is_verified` /
  `verified_listing_overrides` rather than by selecting the table. A plain
  select from the client cannot work and is not a bug to fix.
  - **pglite cannot prove that boundary** -- it has no `anon`/`authenticated`
    roles -- which is why `scripts/verified-rls-check.sql` exists and must be run
    on a real Supabase after any change to those functions. It is
    transaction-wrapped with a `ROLLBACK`, so it is safe on prod. The silent
    failure it guards against: everything looks right, but no vendor ever reads
    as verified in public.
- **`verified` is a within-partition sort key.** `lib/map/rank.ts` (extracted
  from `vendor-map.tsx` so the rule is node-testable) puts it immediately after
  `rank` and before `matched`, so a verified PARTIAL match never sorts above an
  unverified FULL match. Paying moves you up among your peers; it does not buy
  you past a better answer to what the couple asked for. `scripts/test-rank-order.mjs`
  asserts exactly that.
- **Filter overrides merge at READ time, and a draft never leaks.**
  `vendor_filters_in_bbox` (`0045`) left-joins a verified vendor's PUBLISHED
  `filter_overrides` over the extracted `vendors.filters`. Override wins,
  extracted survives where the override is silent, evidence quotes stay
  stripped. An unpublished listing contributes nothing -- which is what lets a
  vendor edit safely.
- **The portal sits outside the couple app on purpose.** `app/(portal)/` is its
  own route group: no bottom nav, `max-w-[760px]`, its own header, reusing the
  OTP auth. It is deliberately NOT in the `(app)` layout, so visiting it does
  not write `wr_seen` -- a vendor in the portal is not a couple using the
  product, and marking them as one would suppress the landing page they were
  sent to. Same reasoning as `/terms`.
- **`/portal/admin` returns `notFound()` for non-admins, not a 403** -- the
  route does not announce that it exists. It reads ALL claims through the
  service role because RLS shows a caller only their own.
- **Three endpoints are excluded from the proxy matcher, each for its own
  reason** (see `proxy.ts`): `api/map/vendors` and `api/vendor-photo` because a
  `Set-Cookie` would make them uncacheable, and `api/stripe-webhook` because it
  authenticates by Stripe signature over its RAW body and has no session to
  refresh.
- **The claim email is optional by design.** `lib/notify/claim-report.ts` sends
  via one `fetch` to Resend (no SDK dependency) and logs-and-continues when
  `RESEND_API_KEY` is unset, so a claim never fails because email did. The
  durable trail is the `vendor_claim_created` PostHog server event plus the row
  itself. Optional env: `RESEND_API_KEY`, `CLAIM_REPORT_EMAIL`,
  `CLAIM_REPORT_FROM`.

**Outstanding:** the signed-IN claim/admin flow has never been driven
end-to-end, because it needs a real OTP sign-in and could not be automated. The
six-step manual recipe is at the end of
`docs/vendor-verification-slice-notes.md`. The DB layer underneath it IS proven
(20 checks in `scripts/test-verified-sql.mjs` plus a live anon-path run).
