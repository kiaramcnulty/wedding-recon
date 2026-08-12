# Analytics plan (as-built)

Goal: measure the distribution pilot's funnel — **visit → explore → vendor page → account → recon saved** — broken down by traffic source, so we know which channel (Reddit post, FB groups, press, ads) actually converts. Free tier only.

## Architecture at a glance

Two layers, deliberately split by trustworthiness:

1. **Supabase = the authoritative funnel.** The conversions already live in our own Postgres (`profiles`, `recon_entries`, `saved_vendors`). We now also stamp each account's **first-touch source** onto its `profiles` row at signup. So `source → account → recon` is answerable directly off Supabase — no export, no third party, and **immune to ad-blockers**. This is what a data tool like Hex reads.
2. **PostHog = the behavioral layer.** Client-side pageviews + three engagement events give browsing depth and a funnel UI. Best-effort by nature (some client events are ad-blocked), which is exactly why it is the *secondary* layer and the two conversion events are fired server-side.

### Why this differs from a naive "client-only, 5 capture calls" plan

- **The two conversion successes are server `redirect()`s.** `setUsername` → `/explore` and `createRecon` → `/vendor/[id]` both end by throwing `NEXT_REDIRECT`, so on success the client `await` never resolves — there is no client "success" moment to hook. So `signup_completed` and `recon_saved` are fired **server-side**, in the action where success is authoritative. This also makes them un-blockable.
- **The launch audience is ad-blocker-heavy.** Reddit especially. A client-only setup undercounts Reddit's pageviews *more* than Facebook/press, biasing the exact channel comparison the pilot exists to make. We mitigate two ways: a same-origin **reverse proxy** for client events, and server-side conversions that cannot be blocked at all.
- **Next 16 has a cleaner init hook than a provider.** `instrumentation-client.ts` runs before hydration and exposes `onRouterTransitionStart`, so we get pageviews with **no** `PostHogProvider`, no `useSearchParams`/Suspense, and no CSR-bailout risk.

## Tool: PostHog Cloud (US, free tier)

1M events/month (far above pilot needs), auto-captures `utm_*` + referrer, funnels UI, plain client JS. Vercel Analytics was rejected: pageviews-only free tier, weak custom events.

**Human step (Kiara, ~5 min):** create a PostHog Cloud account (US region), project "Wedding Recon", copy the **Project API key** (`phc_…`). Put it in `.env.local` AND Vercel project env:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

The same key is used by the browser and by `posthog-node` server-side — there is no second secret. With the key unset, **everything no-ops** (dev sends nothing; the build is green).

**Human step (Kiara, once):** hand-apply `supabase/migrations/0039_signup_attribution.sql` in the Supabase SQL editor (migrations are not auto-applied). Until then, signups simply record no source; nothing else breaks.

## What was built

### Client (first-party, reverse-proxied)
- **`next.config.ts`** — `/ingest/*` rewrites to PostHog (`skipTrailingSlashRedirect: true`). Keeping ingestion same-origin defeats host-based ad-blockers.
- **`instrumentation-client.ts`** (repo root, Next ≥15.3) — inits PostHog guarded on the key (`autocapture: false`, `disable_session_recording: true`, `person_profiles: "identified_only"`, `api_host: "/ingest"`), captures the initial `$pageview`, exports `onRouterTransitionStart` for client-nav pageviews, and writes the **first-touch attribution cookie**.
- **`lib/analytics/posthog.ts`** — the guarded client surface (`initPostHog`, `capturePageview`, `identifyClient`, `captureClient`). Single no-op guard when there is no key.
- **`lib/analytics/attribution.ts`** — DOM-free, framework-free (imported by both the browser and the Server Action): parse/serialize/first-touch helpers + the `wr_attribution` cookie contract. Referrer is stored as **host only** (no full URLs → no stray PII).
- **`components/analytics/identify-user.tsx`** — mounted in the `(app)` layout; on a signed-in user calls `posthog.identify(userId)` once, merging the prior anonymous browsing session into the account (connects top-of-funnel to the server conversions). Anonymous visitors no-op, so Explore stays anonymous.

### Server (un-blockable conversions)
- **`lib/analytics/posthog-server.ts`** — `captureServer()` via `posthog-node` `captureImmediate` (awaits delivery before the caller's `redirect()`; no client lifecycle to manage). No-ops without the key.
- **`app/(auth)/actions.ts` `setUsername`** — fires `signup_completed` (+ `$set_once` initial-source person props) and stamps the first-touch attribution columns onto the profile. Both are tied to the **one-time onboarding completion** (detected via `tos_accepted_at` being null beforehand), so a later username edit cannot double-fire or clobber the original source.
- **`app/(app)/add/actions.ts` `createRecon`** — fires `recon_saved` (`vendor_type`, `photo_count`). This is the single choke point for **both** the normal submit and the guest-resume path (both call `createRecon`).
- **`supabase/migrations/0039_signup_attribution.sql`** — adds `utm_source`, `utm_medium`, `utm_campaign`, `referrer_host`, `landing_path`, `attributed_at` to `profiles` (+ a partial index on `utm_source`). Idempotent.

### The five events

| Event | Fired | Where | Properties |
|---|---|---|---|
| `$pageview` | client | `instrumentation-client.ts` (initial + `onRouterTransitionStart`) | auto `utm_*`, referrer, `$current_url` |
| `signup_completed` | **server** | `setUsername` (onboarding completion) | — (+ `$set_once` initial source) |
| `recon_saved` | **server** | `createRecon` success | `vendor_type`, `photo_count` |
| `vendor_saved` | client | `SaveButton` insert-success only (not unsave) | `vendor_type` |
| `share_clicked` | client | `ShareButton` click intent | `vendor_id` |
| `vendor_link_out` | client | `ExternalLink` `track` prop (explicit, opt-in) | `kind` (website/instagram/maps), `vendor_id` |

No events for map pans, filter taps, or peek cards in v1 — pageviews on `/explore` and `/vendor/[id]` cover browsing depth.

### Privacy posture
No PII in properties (no emails/names). `identified_only` keeps anonymous browsers anonymous until sign-in. Referrer stored as host only. No cookie banner for v1 (US-only, first-party). **Flag for `/terms`:** we now persist a coarse marketing source (`utm_*` + referrer host) against the account — worth a one-line mention.

## UTM discipline (goes with every link we post)

PostHog auto-captures `utm_*` on the pageview, and our first-touch cookie captures the same for Supabase — nothing to build, but links must carry them. Registry:

- `utm_source`: `reddit` | `facebook` | `instagram` | `pinterest` | `press` | `ads-reddit` | `ads-meta`
- `utm_medium`: `organic` | `paid`
- `utm_campaign`: one slug per push, e.g. `cost-spreadsheet-aug26`

Notes:
- The first-visit middleware redirect preserves query strings, so UTMs on the bare domain survive a `/` → `/explore` redirect. But **the primary pilot visitor is NOT redirected** — a first-time visitor gets the landing page at `/` and stays; the redirect only fires for returning/signed-in users. Either way the entry `$pageview` carries the UTM (the tracker is in the root instrumentation).

## Verification (done in this sandbox)

The sandbox has no Supabase credentials, so a full `next build` cannot finish here — it fails prerendering `/explore` on `@supabase/ssr: URL and API key are required`, **identically on `main`** (same error digest), confirming it is environmental, not a code regression.

- ✅ `npm run build` **compiles + passes TypeScript** clean with the changes.
- ✅ With format-valid dummy Supabase env, the build is **green (exit 0)** and **`/` is `○` (Static)** — the landing page's static prerender survives the analytics additions.
- ✅ That build ran with **no PostHog key set** → the no-key no-op path is exercised.
- ✅ `npm run lint`: 0 errors (only pre-existing warnings, none in new files).

**Live-events check (needs the key — Kiara or an agent with creds):** run dev with the key, click landing → explore → a vendor page → an external link; confirm the pageviews + `vendor_link_out` land in PostHog's live-events view, and that a visit to `/?utm_source=test` shows `utm_source` on the entry pageview.

## Dashboards

### PostHog (behavioral)
- **Funnel:** `$pageview` (any) → `$pageview` path `/vendor/*` → `signup_completed` → `recon_saved`.
- **Breakdown:** by **`$initial_utm_source`** (the person property), **not** the event-level `utm_source` — `utm_*` only lands on the entry pageview; later steps carry none, so breaking down by the event property buckets every conversion as "no source."
- **Trends:** weekly unique visitors by `$initial_utm_source`.

### Supabase → Hex (authoritative, ad-blocker-proof)
The real "which channel converts" answer, straight off `profiles` + `recon_entries`:

```sql
-- Signups and recon-savers by first-touch source
select
  coalesce(p.utm_source, 'direct')            as source,
  count(*)                                     as signups,
  count(distinct r.author_id)                  as reconned
from profiles p
left join recon_entries r
  on r.author_id = p.id and r.status = 'active'
where p.is_bot = false
group by 1
order by signups desc;
```

The pageview *denominator* by source (visit → signup rate) comes from PostHog; the conversions come from Supabase. When wiring Hex, connect it with a **read-only** Postgres role, never the service key.
