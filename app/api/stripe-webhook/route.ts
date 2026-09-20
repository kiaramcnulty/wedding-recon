import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { subscriptionIdFor } from "@/lib/stripe/webhook-events";
import { mirrorSubscription } from "@/lib/stripe/sync";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/posthog-server";

/**
 * Stripe webhook for Vendor Verification billing.
 *
 * Keeps vendor_subscriptions in sync with Stripe and flips a listing to
 * published when its subscription goes active. Order-safe: whatever event
 * arrives, we RETRIEVE the subscription fresh from Stripe and mirror its
 * current truth, so a delayed or out-of-order delivery can never write stale
 * state. Idempotent: the one-time side effects (analytics) are gated on a
 * dedupe insert into stripe_webhook_events; the state upsert runs every time.
 *
 * The subscription carries vendor_id in its metadata (set at checkout), so
 * every event maps back to a vendor without another lookup.
 *
 * REGISTER THIS ON THE CANONICAL HOST. weddingrecon.com answers with a 308 to
 * www.weddingrecon.com, and Stripe does NOT follow redirects -- it records the
 * 3xx as a failed delivery and nothing here ever runs. The endpoint URL must be
 * https://www.weddingrecon.com/api/stripe-webhook, in LIVE mode, subscribed to
 * every type in HANDLED_EVENT_TYPES. `npm run check:stripe-webhook` asserts all
 * three; see docs/notes/admin-and-portal.md for the outage it comes from.
 */

// Stripe needs Node (crypto for signature verification), not the Edge runtime.
export const runtime = "nodejs";
// Never statically optimize; this reads a signed request body per call.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text(); // RAW body — required for signature verification
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    // Bad signature — reject; Stripe will not retry a 400.
    return NextResponse.json(
      { error: `signature: ${e instanceof Error ? e.message : "invalid"}` },
      { status: 400 },
    );
  }

  const subId = subscriptionIdFor(event);
  if (!subId) {
    // An event we do not act on — acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const svc = createServiceRoleClient();

  try {
    // Resolve the current subscription state (order-safe).
    const sub = await stripe.subscriptions.retrieve(subId);
    const vendorId = sub.metadata?.vendor_id;
    if (!vendorId) {
      // A subscription not created by our flow — nothing to map it to.
      return NextResponse.json({ received: true, unmapped: subId });
    }

    await mirrorSubscription(vendorId, sub);

    // One-time side effects: only on the FIRST time we see this event id.
    // ignoreDuplicates makes this INSERT ... ON CONFLICT DO NOTHING, so a
    // retry returns no row (and never throws a unique violation that would
    // make Stripe retry forever).
    const { data: firstSeen } = await svc
      .from("stripe_webhook_events")
      .upsert(
        { stripe_event_id: event.id },
        { onConflict: "stripe_event_id", ignoreDuplicates: true },
      )
      .select("stripe_event_id")
      .maybeSingle();

    if (firstSeen && event.type === "checkout.session.completed") {
      await captureServer(vendorId, "vendor_checkout_completed", {
        vendor_id: vendorId,
      });
    }
  } catch (e) {
    // A transient failure — return 500 so Stripe retries (idempotency above
    // makes a retry safe).
    console.error("[stripe-webhook] handler error", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
