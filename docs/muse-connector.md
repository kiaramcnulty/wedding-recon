# Muse connector operations

The connector is a read-only, API-key-authenticated surface at
`/api/connectors/v1`. Public integration docs live at `/developers/connectors`
and the OpenAPI 3.0.3 document at `/openapi.json`.

## Deployment order

1. Apply `supabase/migrations/0049_connector_candidates.sql` after migrations
   0042–0046. The candidate RPC is `SECURITY INVOKER`; the narrow published
   listing projection is the only definer boundary it consumes.
2. Generate a long random connector key. Store only its SHA-256 hex digest in
   `MUSE_CONNECTOR_API_KEY_HASHES`. The variable accepts up to two comma-separated
   digests for a short rotation overlap.
3. Set a separate long random `CONNECTOR_CURSOR_SECRET`, plus the minute and
   daily quota variables documented in `.env.example`.
4. Deploy, then call `/capabilities`, `/vendors`, and `/vendors/{vendor_id}` from
   a fresh client that has no browser cookies. Confirm no connector response
   includes `Set-Cookie` and every data response includes `Cache-Control:
   private, no-store`.
5. Provide the plaintext connector credential to Muse only through its
   designated secure credential flow. Never put it in the form URL, repository,
   logs, screenshots, or issue tracker.

One way to produce the stored digest locally is:

```sh
printf '%s' "$WEDDING_RECON_CONNECTOR_KEY" | shasum -a 256
```

## Required staging checks

- Run the repository test suite, lint, and production build.
- Exercise the three example prompts in the public docs against an authorized
  staging database, including a qualifying vendor beyond the first database
  page.
- With a real anon-role client, confirm removed/flagged recon, saves, reports,
  profiles beyond the selected bot provenance label, unpublished listings,
  claims, subscriptions, and billing identifiers never appear.
- Remove or flag a recon entry and confirm a dirty vendor's derived attributes
  become unknown while a currently eligible published override still applies.
- Withdraw publication or deactivate a subscription and confirm the listing,
  override, verified flag, and ranking effect disappear.
- Test missing, bad, first rotation, second rotation, and retired keys. Simulate
  both quota exhaustion and a limiter failure; the latter must return 503.
- Confirm identical cursor pages have no duplicates. Change relevant data or
  wait 60 seconds and confirm the old cursor asks the caller to restart.
- Inspect PostHog to confirm connector telemetry contains only the documented
  coarse properties, and that a real Muse-tagged browser visit emits
  `muse_arrival` without overwriting an existing first-touch attribution.

PGlite tests cannot prove hosted Supabase RLS boundaries, so the anon-role check
above is a release gate rather than an optional smoke test.

## Monitoring and pilot review

Monitor request volume, successful and zero-result searches, partial-match
rate, latency, errors, and rate limits separately from website outcomes. Review
Muse-tagged visits, account creation, saves, outbound clicks, recon
contributions, and return visits after 30 days. Agent retries and prefetches are
API activity, not people or qualified vendor leads.

Review connector operational analytics at the end of the pilot and delete or
aggregate records before their 12-month retention limit. Stale fixed-window
quota rows can be removed during routine database maintenance.

## Submission values

- API URL: `https://www.weddingrecon.com/api/connectors/v1`
- OpenAPI: `https://www.weddingrecon.com/openapi.json`
- Documentation: `https://www.weddingrecon.com/developers/connectors`
- Terms: `https://www.weddingrecon.com/terms`
- Privacy: `https://www.weddingrecon.com/privacy`
- Authentication: API key, subject to Muse confirming its partner-credential
  flow. Do not claim OAuth support in v1.
- Payments: none through the connector; Vendor Verification is a separate
  website subscription.
