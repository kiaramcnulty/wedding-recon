# Wedding Recon

Mobile-first PWA for engaged couples to (1) explore local wedding vendors on a map and (2) log + save their own "recon" (price quotes, notes, photos) in a personal planning hub. Non-revenue on the couple side -- favor free/low-cost choices; the one paid surface is vendor-side (see Vendor Verification below). Soft-launch market: Denver, CO.

**This file is the always-loaded working reference: hard contracts, gates, and an index.** The as-built reasoning behind each feature lives in `docs/notes/` -- go there before re-deriving a rule from the code, because those notes record what was deliberately NOT done and why. (Restructured 2026-09-12: this file was 121 KB, about 30k tokens on every session, and had drifted -- it documented a map data path the app no longer used and never mentioned analytics or the paid tier. Content was moved, not deleted.)

## Where the detail lives

| Topic | Notes |
|---|---|
| Explore map: pins, peek cards, feeds, list order, filter ranking | `docs/notes/explore-map.md` |
| How the map is actually SERVED -- edge cache, bbox snapping, the 2026-08-14 pool outage | `docs/notes/map-serving.md` |
| Recon entries: fields, ordering, editing, photos, text repairs | `docs/notes/recon-entries.md` |
| Vendor search (one matcher, two bars) | `docs/notes/search.md` |
| Vendor page: photo strip + external-link overlay | `docs/notes/vendor-page.md` |
| Landing page, first-visit routing, SEO | `docs/notes/landing-and-seo.md` |
| Sign-in (the CODE leads, not the link) and `from` navigation | `docs/notes/auth-and-navigation.md` |
| Admin flag, the Vendor Verification paid tier / portal, the public `/vendors` entry point | `docs/notes/admin-and-portal.md` |
| Analytics: PostHog + first-party attribution | `docs/notes/analytics.md` |
| React/UI/Supabase/form patterns and the expensive gotchas | `docs/notes/app-patterns.md` |
| Migration ledger (all 48, applied state) | `docs/notes/migrations.md` |

Plans and investigations (not as-built) stay in `docs/` directly -- e.g. `docs/vendor-verification-plan.md`, `docs/google-places-cost.md`, `docs/filter-recon-on-write.md`, `docs/analytics-plan.md`, `docs/vendor-filters-proposal.md`.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack) — see `AGENTS.md`: this Next is newer than your training data, check `node_modules/next/dist/docs/` when unsure.
- Tailwind v4 (CSS-based config in `app/globals.css`, no `tailwind.config.js`).
- shadcn/ui components in `components/ui/` — these wrap **Base UI** (`@base-ui/react`), not Radix. Follow the existing component files for APIs.
- Icons: `lucide-react`.
- Supabase (Postgres + PostGIS + Auth + Storage + RLS).
- Map: MapLibre GL JS + free OpenFreeMap tiles. Google Places only for business search in Add Recon.

## App structure

- `app/page.tsx` — the **marketing landing page** at `/` (statically prerendered, desktop-first, no bottom nav). It used to be a bare `redirect("/explore")`; the redirect now lives in the middleware and is conditional. See "Landing page + first-visit routing" below.
- `app/(app)/` — main screens with the mobile frame + bottom nav: `explore`, `add`, `hub`, and `vendor/[id]`.
- `app/(auth)/` — login / onboarding (no bottom nav).
- `app/vendors/` — the **public vendor-side marketing page** (statically prerendered, at the root like `/terms` so it does not mount `<MarkVisited>`). It is the pitch a vendor reads before signing up; `app/(portal)/` behind it is the signed-in dashboard.
- `components/` — shared components (`bottom-nav.tsx`, plus feature components).
- `components/landing/` + `lib/landing/` — landing-page-only components and content. Nothing under `app/(app)/` should import from them except the two links back (`BrandFooter`, `ProfileMenu`), which take `LANDING_HREF` from `lib/landing/nav.ts`.
- Mobile frame is `max-w-[480px]`, centered. The landing page is the one screen that is **not** in that frame — it runs to `max-w-5xl`, since it is the only surface people meet on a laptop.

## Env

Copy `.env.example` → `.env.local` and fill in. See `SETUP.md` for how to obtain each value.

## Run

- `npm run dev` -- dev server (needs `.env.local`).
- `npm run build` -- production build (**must pass before commit**).
- `npm run lint` -- eslint. Must be clean; one known-benign warning remains (`watch()` in `app/(app)/add/page.tsx`, react-hook-form + React Compiler).
- `npm test` -- the 8 node check scripts in `scripts/test-*.mjs` (146 assertions), preceded by a staleness check on the Codex mirrors. Run after touching filter matching, list ordering, the RPC fan-out, bbox snapping, or the verification SQL -- these are the only executable checks on those rules.
- `npm run sync-codex` -- regenerate the Codex mirrors from `.claude/`. See the Skills section.
- `npm run check:stripe-webhook` -- **network + Stripe**, deliberately outside `npm test`. Asserts the live Stripe webhook is reachable with **no redirect** (the apex 308s and Stripe does not follow it), registered at the canonical `www` URL, and subscribed to every `HANDLED_EVENT_TYPES` entry. Run after touching the webhook, the domain config, or the Stripe dashboard. **A test-mode key proves nothing about live mode** -- pass a live key. Weekly in `.github/workflows/stripe-webhook-check.yml`; the outage it comes from is in `docs/notes/admin-and-portal.md`.

**Keep the lint gate usable.** `eslint.config.mjs` ignores `.claude/worktrees/**`, `.agents/**`, `.codex/**`, `data/**` and `.recon-upload-tmp/**`. Each git worktree is a FULL copy of the repo, so linting them lints the codebase two or three times over: two stale worktrees once made `npm run lint` report **41,335 problems / 1,516 errors** while the app's own source was clean. If lint output suddenly explodes, check for a new worktree before believing the findings.

## Conventions & contracts (do not break these)

- **Vendor categories**: import from `lib/constants/categories.ts` (`VENDOR_TYPES`, `CATEGORIES`, `RECON_TYPES`, labels). Each type has a fixed icon + color reused on pins, chips, accordions, tags -- **never hardcode a category color elsewhere**. Use `VENDOR_TYPES` for anything user-selectable (picker, Explore filter, Hub); `ALL_VENDOR_TYPES` to validate a value that might be legacy.
  - **Music is two types**, `dj` ("DJs") and `band` ("Live music" -- the broad live-performer bucket: bands, quartets, soloists, pianists, ceremony ensembles). `music` is a hidden legacy value (`LEGACY_VENDOR_TYPES`), kept only so a straggler row still renders.
  - **`beauty` ("Hair & makeup") is ONE joint type** for wedding-day hair AND makeup: most artists do both, and a hair-only or makeup-only artist goes in the same bucket rather than a second category.
  - **`hotel` ("Hotel blocks") is guest-lodging ROOM BLOCKS, not event space, and venue supersedes hotel** -- a property with a ballroom or ceremony site is normally a `venue` even when it also blocks rooms. **Exception (Kiara, 2026-08-03): where a property is primarily valuable to couples AS A ROOM BLOCK, type it `hotel` even if it has event space**, judged per property, because the listing should lead with what couples actually come to it for. A second row is NOT an option -- `vendors.google_place_id` is `unique`, so one property is one row and this is a typing decision, not a duplication one. Self-enforcing at seed time: `upload.mjs` dedups `google_place_id` GLOBALLY across types. Full reasoning + the worked examples are in the skill type cards (`.claude/skills/launchvendors/types/`).
- **Fixed-location vs service-area** is ONE list: `FIXED_LOCATION_TYPES` in `lib/constants/categories.ts` (`venue`, `hotel`, `dress`), read through `usesServiceRegion()`. It gates the recon form field, the `service_region` column, the map pin halo, and the vendor-page map-vs-service-areas slot -- add a type and all four move together. The enrich pipeline mirrors it as `serviceRegionRequired` in `etype.mjs`; **change both together**, or a run writes a field the app then nulls out.
- **Types**: shared row types in `lib/types.ts`.
- **Supabase clients**:
  - Client Components -> `createClient()` from `lib/supabase/client.ts`.
  - Server Components / Route Handlers / Server Actions -> `await createClient()` from `lib/supabase/server.ts`.
  - Service role (server-only, bypasses RLS) -> `createServiceRoleClient()` -- use sparingly.
- **Auth session** is refreshed in `proxy.ts` (Next 16's renamed middleware). Don't gate public vendor pages -- shared deeplinks must render without an account. Three endpoints are excluded from the matcher on purpose (`api/map/vendors`, `api/vendor-photo`, `api/stripe-webhook`); see `docs/notes/map-serving.md` and `docs/notes/admin-and-portal.md` before adding a fourth.
- **Map geo query**: the browser calls the **edge-cached route `/api/map/vendors`**, NOT the `vendors_in_bbox` RPC directly, and the viewport is snapped to a shared grid first. The per-type fan-out is concurrency-capped and retried. This is not optional plumbing -- it is what survived the 2026-08-14 outage. Read `docs/notes/map-serving.md` before changing anything in that path.
- **Map markers**: `components/map/vendor-map.tsx` owns pin styling -- dashed outline for approximate locations, deterministic phyllotaxis fan-out for shared coordinates, a soft radial halo for service-region categories, an emphasized pin for the selected one. Pins carry vendor names from zoom 12, and a tap opens a peek card rather than navigating. See `docs/notes/explore-map.md`.
- **Every overlay over the map opts IN to pointer events.** The whole over-the-map stack sits in one `pointer-events-none absolute inset-0` box, so a control without `pointer-events-auto` is inert and the tap goes to the MapLibre canvas -- it renders and hovers correctly, it just does not respond. Put the class on individual controls, never on a row (the gaps must stay pannable). Check: `document.elementFromPoint(x, y)` at a control's centre must not return `canvas.maplibregl-canvas`.
- **Ordering rules are shared, never re-implemented**: `sortReconEntries()` (`lib/recon-sort.ts`) for recon entries on both the vendor page and preview cards; `compareRanked()` (`lib/map/rank.ts`) for both list feeds. A new sort key goes in those modules so every surface moves together.
- **Schema** lives in `supabase/migrations/`. If you change the DB, add a new numbered migration -- don't edit applied ones. Write them idempotent and **apply new ones by hand in the Supabase SQL editor**. See Migrations below and `docs/notes/migrations.md`.
- **Vendor links point at `/portal`, never at `/vendors`.** `/portal` is the router: signed out it redirects to the public pitch at `/vendors`, signed in it renders the dashboard. That is what keeps all three entry points (landing footer, profile menu, vendor page) a single href that cannot go stale. The benefit list is ONE constant (`VERIFICATION_BENEFITS` in `lib/vendors/content.ts`) shared by the page and the in-portal intro, and the price is `lib/portal/verification.ts` — never retyped. `docs/notes/admin-and-portal.md`.
- **`from` and `back` are different params on `/login`**: `from` is where sign-in LANDS, `back` is only what the back link returns to. They must stay separate wherever the landing destination would bounce the visitor back to login (the vendor flow does exactly that). Both go through `sanitizeSignInDestination()`.
- **Copy/nomenclature**: the recon CTA is **"Save recon"** (not "Publish"); user-facing labels say **"Vendor"**, not "Business".
- **External links**: use `<ExternalLink>` from `components/external-link.tsx`, never a bare `<a target="_blank">`. See `docs/notes/vendor-page.md`.
- **No `next/image` anywhere** -- deliberate, since Vercel Image Optimization is billed and an explicit `?w=` on a plain `<img>` is free. Google photo widths are allowlisted (`600`, `1200`); each width is a separate CDN key AND a separate billed Google fetch. Place Photos is the app's dominant Google cost -- see `docs/google-places-cost.md`.
- **`getClaims()` over `getUser()` on read paths** (asymmetric JWT signing keys, so it verifies locally with no Auth round trip). **Writes keep `getUser()`**, where the round trip catches a session revoked before its token expires. RLS re-validates at the database either way, so this is a latency choice, not the security boundary.
- **A dynamic route under `(app)` needs a `loading.tsx`**, or the tap feels broken -- Next has no boundary to swap in and just waits out the server round trip (measured: 2052ms of dead air vs 379ms to first feedback). Relatedly, a card's main control must be a **`<Link href>`**, not a button calling `router.push`, so the loading boundary gets prefetched (measured: 821ms vs 241ms tap-to-navigation).

## Migrations

- **Write idempotent:** `add column if not exists`; for constraints use `drop constraint if exists` then `add constraint` (Postgres has **no** "add constraint if not exists").
- **One ALTER per constraint** — you cannot chain multiple `add constraint` clauses in a single `alter table` (syntax error).
- **Not auto-applied** to the hosted DB — run new migrations by hand in the Supabase SQL editor.
- **No apostrophes or `$$` in SQL comments** — the Supabase SQL editor splits a paste into statements with a lexer that tracks string literals but does **not** skip `--` comments. A `'` in a comment (`the tier's rule`, `typo'd`) opens a phantom string; an odd number of them desyncs it, it stops seeing the dollar-quoted function boundary, and it splits the body at the semicolon inside it — the server then rejects the fragment (`42601: syntax error at or near "limit"`). Cost a failed hand-apply of `0026` on 2026-07-29 (7 comment apostrophes; `0025` had 2 and survived on even parity). Write comments apostrophe-free — "does not" over "doesn't", "the rule of the strict tier" over "the strict tier's rule" — and name the delimiter "dollar-quoted body", never the literal token. `psql -f` is immune, so **local testing will not catch this**; the check is `grep -n "'" <file> | grep -- "--"`.
- **Prefer single-quoted literals with DOUBLED apostrophes over dollar-quoting in hand-applied SQL** — same lexer, second way it bites (2026-08-07). Postgres itself prefers `$q$…$q$` for text full of apostrophes and dollar signs, but the editor lints **client-side, before the server ever parses**, and that lexer does not understand a dollar-quoted string. So every apostrophe *inside* one toggles its in-string state exactly like an apostrophe in a comment does. `scripts/fix-quote-only-residue.sql` carried 25 of them (`what's public`, `don't mention`) — odd parity again — which collapsed 75 statements into 36 fragments, 6 holding more than one `UPDATE`, and the editor then raised **"This query runs an UPDATE without a WHERE clause. It may update every row in the target table"** on a file where all 74 statements are gated on a single `id`. A false positive, but not one to click through on live data. Doubling (`don''t`) is the escape every SQL lexer agrees on. Safe whenever no value contains a **backslash** (nothing then depends on `standard_conforming_strings`); a `$` is inert inside a single-quoted string, so money figures need no special handling. The older `scripts/fix-comma-split-recon.sql` still uses `$fix$` — it predates this and is short enough that the parity never bit. **The check is the same shape as the comment one, and equally invisible to `psql -f`.**

## Skills

Three project skills. Each `SKILL.md` is loaded when the skill is invoked, so this section is a pointer, not a summary -- **read the skill file rather than working from memory of it.**

- **`/launchvendors <type> <region>`** (`.claude/skills/launchvendors/`) -- seed a region's vendor rows for one type (venue default; photographer, caterer, music, flowers, dress/bridal, planner, hair & makeup, hotel blocks). Places sweep + web/Reddit research -> canonical Google-place resolve -> agent-adjudicated flagged rows -> deduped bulk insert. Headless; never drives a browser and never fetches Meta. Mechanical config is `TYPE_PROFILES` in `scripts/lib.mjs`; **judgment config is the per-type card in `types/<type>.md`, which the skill loads first.**
  - Two rules that have each cost real data: **phase order is resolve -> adjudicate -> upload, and `adjudicate` is TERMINAL** (re-running `resolve` after it used to resurrect every removed row -- 2026-07-29: 5 resurrected + 4 duplicated; `adjudicate --rescue` is the only way back out). And **keys are `place_id` or normalized name, never row numbers.**
  - **Places calls are cached + metered**: responses memoize to `<workdir>/places-cache.jsonl` (30-day TTL), city centroids persist in the committed `centroids.json`, and each script prints per-SKU spend. **One type-launch per calendar month fits the free allowance and costs $0; each additional type that month is ~$29** -- so spread build-outs across months. `docs/google-places-cost.md`.
- **`/enrichvendors <type> <region>`** (`.claude/skills/enrichvendors/`) -- add bot-authored recon entries to already-seeded vendors of one type, under user-approved `is_bot` accounts. Harvest -> per-vendor dossiers -> single-turn draft workers -> human-voiced `recons.csv` -> upload. Drafting runs on the **Anthropic Batch API by default** (needs `ANTHROPIC_BATCH_API_KEY`, deliberately not `ANTHROPIC_API_KEY`, which would shadow Claude Code's own auth); `docs/anthropic-batch-drafting.md`.
  - **Name the enrich workdir to match the LAUNCH workdir.** Archived research is looked up under `data/launchvendors/<name>/research`, and a mismatch is **silent** -- the tell is `roster.mjs` printing `reddit threads on file: 0` right after a launch that archived pastes, after which the whole region drafts with no Reddit content. Never "fix" it by copying pastes across: both dirs are scanned, so copies double every excerpt.
  - **`pipeline.mjs status` is the real quality gate**, not upload. It counts the same defects `upload.mjs` hard-fails on -- these are cheap to fix in the JSONLs and expensive afterwards.
- **`/verify`** (`.claude/skills/verify/`) -- run and drive the app with no Supabase credentials, via a fake PostgREST server + Playwright. Reach for it early on "renders but looks wrong": a DOM probe beats reasoning from screenshots (it named the collapsed-map bug in one shot after two wrong fixes).

**The Codex mirrors are GENERATED, never hand-edited.** `.claude/skills` + `.claude/agents` + `.claude/hooks` are the source of truth; `scripts/sync-codex-mirrors.mjs` produces `.agents/skills` + `.codex/agents` + `.codex/hooks` from them (`npm run sync-codex`), and `npm test` fails when they are stale. Edit the canonical tree and re-run it -- editing a mirror directly gets overwritten.
  - Hand-maintaining them drifted twice, both times silently. Every mirrored `SKILL.md` pointed at a `.Codex/skills/` directory that does not exist, so a Codex session failed on its first command (26 occurrences). And `pipeline.mjs` hardcoded its references path to the canonical tree, so the mirror read the *other* copy's drafting rules -- working only because both trees coexist here.
  - The rewrites are blind string substitutions, so **do not name either tree literally in prose that the substitution would mangle.** A comment reading "`.claude/skills` for Claude Code, `.agents/skills` for Codex" came out as "`.claude/skills` for Codex, `.agents/skills` for Codex". The script warns when a mirror still points at the canonical tree; the fix is always to reword the SOURCE.
  - `.codex/hooks.json` is the one generated file that is **gitignored** -- Codex wants an absolute command path, which is machine-specific. Run `npm run sync-codex` once per checkout.

## Status

M0-M6 all built and functional (foundation, auth, Explore map, vendor page, Add Recon, Hub, T&S). Current work is polish, cost control, and the vendor-side paid tier.

**Live in production** at `weddingrecon.com`, with the Vendor Verification portal deployed (PR #57, merged 2026-09-13). Hosted DB applied through migration **`0048`**; corpus **2,300 vendors / 3,595 recon entries** (checked 2026-09-12).

**Seeded regions** (all Colorado, statewide unless noted): venues, photographers, caterers, music (`dj` + `band`), flowers, planners, dress/bridal, hair & makeup, hotel blocks. Per-type counts, removals and known gaps are in the memory notes rather than here, because they change with every run.

**Known outstanding:**
- Stripe webhook: **resolved 2026-09-20**, but the guard rails are not wired up yet. The live endpoint had been registered on the APEX (which 308s to `www`, and Stripe does not follow redirects), so no paid vendor ever reached `vendor_subscriptions` and `verified_vendor_ids()` returned nobody. Repointed to `https://www.weddingrecon.com/api/stripe-webhook` and the failed deliveries resent; both paying vendors verified. **Still to do:** `.github/workflows/stripe-webhook-check.yml` is a no-op until the repo gets secret `STRIPE_LIVE_SECRET_KEY` (live, read-only on Webhook endpoints) and variable `STRIPE_WEBHOOK_URL`. Full account in `docs/notes/admin-and-portal.md`.
- **97 vendors have no `location`**, so they are invisible on the Explore map AND in vendor search; 71 of them carry 106 bot recon entries nobody can reach. They came from the **July 2026 launch passes**, not from users: `created_by` is null on every one (the app always sets it), none has a `google_place_id`, and the type mix is photos 64 / band 13 / flowers 13 / planner 4 / food 2 / dj 1. **`source` is not an author field** -- `upload.mjs` sets `source: place_id ? 'google' : 'user'`, so `user` means "did not resolve to a Google place". These rows are where `resolve` found no place and the centroid fallback did not fire either, leaving `hasLoc()` false and `location` silently null. **Not backfilled**, and harder than it looks: `region` is `CO` but `city` and `address_text` are null on all 97, so there is no city centroid to fall back on (31 have a website; the archived `data/launchvendors/<name>/research` is the free lead). The upstream gap -- `upload.mjs` accepting a location-less row without complaint -- is also still open. Separately, the claim-form hole that produced ONE such row (a paying verified vendor) IS fixed; see `lib/vendor/manual-entry.ts` and `docs/notes/admin-and-portal.md`.
- The signed-IN vendor claim/admin flow has never been driven end to end -- it needs a real OTP sign-in. Six-step recipe at the end of `docs/vendor-verification-slice-notes.md`. The DB layer beneath it IS proven.
- `.github/workflows/filter-recon-daily.yml` ships **disabled** (manual dispatch, dry-run default, cron commented) and must be piloted by hand before the schedule is enabled. `docs/filter-recon-on-write.md`.
- Keep-alive: `.github/workflows/keepalive.yml` pings `/api/health` daily so the free-tier project does not pause after 7 idle days. **A green run does not mean it worked** -- it exits 0 when `HEALTHCHECK_URL` is unset, and it once curled the apex domain, took a 308, and passed without touching Supabase. The step now requires HTTP 200 and greps the body for `"db":"ok"`. If you change it, keep it asserting on the **body**: the endpoint returns 200 even when its Supabase query fails.
