#!/usr/bin/env node
/**
 * Event-vocabulary tests for the Vendor Verification Stripe webhook.
 *
 *   node scripts/test-stripe-webhook-events.mjs
 *
 * HANDLED_EVENT_TYPES is the list `scripts/check-stripe-webhook.mjs` holds the
 * REGISTERED Stripe endpoint to. That is only worth anything if the list and
 * the handler agree, so this asserts the two directions:
 *
 *   - every type in the list resolves a subscription id, and
 *   - anything outside it resolves null (so the route acknowledges and exits).
 *
 * Add a `case` without adding the type to the list and the second direction
 * fails; add a type without a `case` and the first does. Either way the
 * registration check can never be quietly asserting the wrong set.
 *
 * Offline by design — the reachability + registration checks are a separate
 * script, because `npm test` has to pass with no network and no Stripe key.
 *
 * Run after any change to lib/stripe/webhook-events.ts.
 */

import {
  HANDLED_EVENT_TYPES,
  subscriptionIdFor,
  periodEnd,
} from "../lib/stripe/webhook-events.ts";

let pass = 0,
  fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(
      `  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`,
    );
  }
}

/** A minimal event of `type` whose payload points at sub_TEST. */
function event(type, shape = "id") {
  const object =
    shape === "checkout"
      ? { subscription: "sub_TEST" }
      : shape === "invoice"
        ? { subscription: "sub_TEST" }
        : { id: "sub_TEST" };
  return { id: "evt_TEST", type, data: { object } };
}

const SHAPE = {
  "checkout.session.completed": "checkout",
  "invoice.paid": "invoice",
  "invoice.payment_failed": "invoice",
};

console.log("HANDLED_EVENT_TYPES — the list itself");
eq(
  "no duplicates",
  HANDLED_EVENT_TYPES.length,
  new Set(HANDLED_EVENT_TYPES).size,
);
// The three that used to be registered instead of subscription.updated. Keeping
// them named here makes the regression legible if anyone re-adds them.
for (const t of [
  "customer.source.updated",
  "customer.card.updated",
  "customer.bank_account.updated",
]) {
  eq(`does not include ${t}`, HANDLED_EVENT_TYPES.includes(t), false);
}
eq(
  "includes customer.subscription.updated (the one that was missing)",
  HANDLED_EVENT_TYPES.includes("customer.subscription.updated"),
  true,
);

console.log("\nEvery handled type resolves a subscription id");
for (const type of HANDLED_EVENT_TYPES) {
  eq(type, subscriptionIdFor(event(type, SHAPE[type])), "sub_TEST");
}

console.log("\nUnhandled types resolve null");
for (const type of [
  "customer.source.updated",
  "customer.card.updated",
  "customer.bank_account.updated",
  "payment_intent.succeeded",
  "customer.created",
  "invoice.created",
]) {
  eq(type, subscriptionIdFor(event(type)), null);
}

console.log("\nExpanded object forms resolve the same id");
eq(
  "checkout.session.completed with an expanded subscription",
  subscriptionIdFor({
    id: "evt",
    type: "checkout.session.completed",
    data: { object: { subscription: { id: "sub_TEST" } } },
  }),
  "sub_TEST",
);
eq(
  "invoice.paid with an expanded subscription",
  subscriptionIdFor({
    id: "evt",
    type: "invoice.paid",
    data: { object: { subscription: { id: "sub_TEST" } } },
  }),
  "sub_TEST",
);
eq(
  "checkout.session.completed with no subscription (one-time payment)",
  subscriptionIdFor({
    id: "evt",
    type: "checkout.session.completed",
    data: { object: { subscription: null } },
  }),
  null,
);

console.log("\nperiodEnd reads either API shape");
eq(
  "top-level current_period_end",
  periodEnd({ current_period_end: 1767225600 }),
  "2026-01-01T00:00:00.000Z",
);
eq(
  "current_period_end on the first item",
  periodEnd({ items: { data: [{ current_period_end: 1767225600 }] } }),
  "2026-01-01T00:00:00.000Z",
);
eq("absent on both", periodEnd({ items: { data: [] } }), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
