-- 0048_stripe_webhook_events.sql
-- Vendor Verification billing: idempotency ledger for the Stripe webhook.
--
-- Stripe retries deliveries and can send events out of order, so the webhook
-- records each processed event id here BEFORE running side effects (the claim
-- report, the PostHog event). A duplicate delivery finds the id already present
-- and is acknowledged without repeating them. Subscription STATE is upserted on
-- every delivery regardless, so a later authoritative subscription event still
-- wins - this ledger only guards the one-time side effects.
--
-- Written only by the webhook on the service role. RLS on, no policies, which is
-- deny-all for every client role - correct, nothing client-side reads it.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file.
-- Not auto-applied - hand-apply in the Supabase SQL editor. Idempotent.

create table if not exists stripe_webhook_events (
  stripe_event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;
