# Analytics: PostHog plus first-party attribution

Two independent systems, deliberately. PostHog answers "what are people doing";
a first-party attribution cookie stamped onto the profile answers "where did this
account come from". The second exists because the first can be blocked.

Plan and event taxonomy: `docs/analytics-plan.md`. **This was undocumented in
`CLAUDE.md` until 2026-09-12.**

## Init lives in `instrumentation-client.ts`, not a provider

It runs after the HTML loads and **before React hydration**, on every page
including the statically-prerendered landing page. That is why analytics init
lives there rather than in a provider `useEffect`:

- it is the earliest client hook;
- it needs no Suspense / `useSearchParams` dance, so **no CSR-bailout risk** on
  the one page that must stay static; and
- `onRouterTransitionStart` gives client-navigation pageviews for free.

Everything is wrapped so **a broken analytics init can never take the app
down**, and with no `NEXT_PUBLIC_POSTHOG_KEY` nothing initializes and every
helper is a silent no-op (dev without a key sends nothing).

## The reverse proxy is the point, not a nicety

`next.config.ts` rewrites `/ingest/*` to PostHog (note: **static assets and
ingestion have different upstreams**, and `skipTrailingSlashRedirect` is
required). The browser only ever talks to our own origin.

This defeats **host-based ad-blockers**, which run heavy in the launch channels
-- Reddit especially. Without it those sources get undercounted *more than the
others*, which biases exactly the channel comparison the pilot exists to make.
So this is a measurement-validity fix, not a delivery-rate one.

## Client events vs. the two server events

Most events are client-side through the typed helpers in `lib/analytics/posthog.ts`
-- one place, so names and props stay consistent.

The **two conversion events are server-side** (`lib/analytics/posthog-server.ts`):
`signup_completed` and `recon_saved`. Both succeed via a server `redirect()`,
which throws `NEXT_REDIRECT` -- so the client `await` never resolves on success
and **there is no client "success" moment to hook**. Firing them in the Server
Action, where success is authoritative, fixes that and makes them unblockable.
`captureImmediate` awaits the send so the event is delivered before the caller
redirects. `vendor_claim_created` and `vendor_checkout_completed` (the portal)
are server events for the same reason.

Anonymous browsing is stitched to the account **client-side** (`identifyClient` /
`<IdentifyUser>`), which merges the anon `distinct_id` into the `userId`; the
server side just uses `userId` as the distinct id. Person profiles are
`identified_only`.

## First-touch attribution is the authoritative funnel input (migration `0039`)

`lib/analytics/attribution.ts` plus the writer in `instrumentation-client.ts`
record where a visitor **first** came from -- `utm_*` params or an external
referrer host -- into a first-party cookie, and `setUsername` reads it back
server-side at signup to stamp `profiles` (`utm_source`, `utm_medium`,
`utm_campaign`, `referrer_host`, `landing_path`, `attributed_at`).

Why both: **this lives in our own DB, so it cannot be ad-blocked and does not
depend on PostHog being up.** PostHog tells you about sessions; this tells you
about accounts.

Rules that are easy to break:
- **First-touch means never overwrite.** The writer returns early if the cookie
  already exists. A later visit carrying a fresh `utm_source` must not clobber
  the original source.
- It is written only when a visit **carries a signal at all** -- no `utm_*` and
  no external referrer writes nothing, so direct traffic stays null rather than
  being recorded as some default.
- Not `httpOnly` (it is written client-side) and it holds **no secret**, only
  campaign provenance. `SameSite=Lax` so it survives the top-level navigation
  from a Reddit or Facebook link -- `Strict` would drop exactly the case it is
  for.
- Migration `0039` is applied. Note the columns are `utm_*` / `referrer_host` --
  there is **no** `signup_source` column, despite the migration's title.
