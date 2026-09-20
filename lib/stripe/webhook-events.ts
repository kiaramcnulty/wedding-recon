import type Stripe from "stripe";

/**
 * The Stripe event vocabulary of the verification webhook, in one place.
 *
 * Extracted from the route so three things can be checked against the SAME
 * list instead of drifting: the handler itself, the offline test
 * (`scripts/test-stripe-webhook-events.mjs`), and the registration check
 * against the live Stripe endpoint (`scripts/check-stripe-webhook.mjs`).
 *
 * That drift is not hypothetical. The endpoint registered in Stripe subscribed
 * to `customer.source.updated`, `customer.card.updated` and
 * `customer.bank_account.updated` -- none of which the handler acts on -- while
 * OMITTING `customer.subscription.updated`, which it does. A plan change or a
 * status flip outside an invoice therefore never reached us.
 *
 * Type-only Stripe import on purpose: no runtime dependency, so a plain
 * `node scripts/*.mjs` can import this module directly.
 */
export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

/** current_period_end moved onto items in recent API versions; check both. */
export function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
}

/**
 * Extract the subscription id an event refers to, or null if none applies.
 *
 * Every type in HANDLED_EVENT_TYPES must resolve an id here, and every other
 * type must return null -- that is exactly what the offline test asserts, so
 * adding a case without adding it to the list (or the reverse) fails `npm test`.
 */
export function subscriptionIdFor(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      return typeof s.subscription === "string"
        ? s.subscription
        : (s.subscription?.id ?? null);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return (event.data.object as Stripe.Subscription).id;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = event.data.object as unknown as {
        subscription?: string | { id: string } | null;
      };
      return typeof inv.subscription === "string"
        ? inv.subscription
        : (inv.subscription?.id ?? null);
    }
    default:
      return null;
  }
}
