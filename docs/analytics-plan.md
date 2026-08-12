# Analytics plan (handoff — executable by an agent)

Goal: measure the distribution pilot's funnel — **visit → explore → vendor page → account → recon saved** — broken down by traffic source, so we know which channel (Reddit post, FB groups, press, ads) actually converts. Free tier only.

## Tool: PostHog Cloud (free tier)

Why: 1M events/month free (far above pilot needs), auto-captures UTM params + referrer, has a funnels UI, and works as a plain client-side JS snippet — no server changes. Vercel Analytics was considered and rejected: its free tier is pageviews-only with weak custom-event support, and we need conversion events.

**Human step (Kiara, ~5 min):** create a PostHog Cloud account (US region), create project "Wedding Recon", copy the Project API key. Add to `.env.local` AND Vercel project env:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Everything below is agent work.

## Implementation

1. `npm install posthog-js`
2. **Provider** — new file `components/analytics/analytics-provider.tsx`, a `"use client"` component that:
   - inits PostHog in a `useEffect`, only if `NEXT_PUBLIC_POSTHOG_KEY` is set (so dev without the key sends nothing);
   - options: `capture_pageview: false` (we capture manually, below), `person_profiles: "identified_only"`;
   - renders `{children}` and provides posthog via `PostHogProvider` from `posthog-js/react`.
3. **Pageview tracker** — App Router does client-side navigation, so a second small client component watches `usePathname()` + `useSearchParams()` and fires `posthog.capture("$pageview")` on change. `useSearchParams` MUST be wrapped in a `<Suspense>` boundary or the build bails pages out to CSR.
4. **Mount both in the ROOT layout** (`app/layout.tsx`), not the `(app)` layout — the landing page at `/` must be tracked too. Client components do not break the landing page's static prerender; verify in the `npm run build` output that `/` still shows as statically generated (○). Do NOT touch `proxy.ts`.
5. **Custom events** — exactly these five, no more (each is one `posthog.capture()` call at the success point, client-side):

   | Event | Where to fire | Properties |
   |---|---|---|
   | `signup_completed` | Onboarding form submit success (the screen where a new account picks a username + accepts TOS — find it under `app/(auth)/`). Also call `posthog.identify(userId)` here. | — |
   | `recon_saved` | `app/(app)/add/page.tsx`, after the `createRecon` server action resolves successfully | `vendor_type`, `photo_count` |
   | `vendor_saved` | The save-to-hub control's success path on the vendor page | `vendor_type` |
   | `share_clicked` | The vendor-page share button | `vendor_id` |
   | `vendor_link_out` | `components/external-link.tsx` click handler (single choke point for all outbound vendor links) | `kind` (website/instagram/maps) |

   Do not add events for map pans, filter taps, or peek cards in v1 — pageviews on `/explore` and `/vendor/[id]` already cover browsing depth.
6. **Privacy posture:** no PII in properties (no emails, no names). `identified_only` means anonymous browsers stay anonymous. No cookie banner for v1 (US-only audience, first-party analytics); flag in the PR description that `app/terms` may warrant a one-line mention.

## UTM discipline (goes with every link we post anywhere)

PostHog auto-captures `utm_*` on the pageview — nothing to build, but links must carry them. Registry:

- `utm_source`: `reddit` | `facebook` | `instagram` | `pinterest` | `press` | `ads-reddit` | `ads-meta`
- `utm_medium`: `organic` | `paid`
- `utm_campaign`: one slug per push, e.g. `cost-spreadsheet-aug26`

Note the first-visit middleware redirect (`/` → `/explore`) preserves query strings by design, so UTMs on the bare domain survive.

## Verification (agent, before done)

1. `npm run build` passes; `/` still statically generated.
2. Run dev with the key, click through landing → explore → a vendor page → an external link; confirm all events (2 pageviews + `vendor_link_out`) arrive in PostHog's live-events view.
3. Confirm a visit to `https://localhost/?utm_source=test` shows `utm_source` on the captured pageview after the redirect to `/explore`.

## Dashboard (human or agent via PostHog UI, ~10 min)

One funnel insight: `$pageview` (any) → `$pageview` path `/vendor/*` → `signup_completed` → `recon_saved`, broken down by `utm_source`. One trends insight: weekly unique visitors by `utm_source`. That's the whole pilot dashboard.
