import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
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
 */

// Stripe needs Node (crypto for signature verification), not the Edge runtime.
export const runtime = "nodejs";
// Never statically optimize; this reads a signed request body per call.
export const dynamic = "force-dynamic";

/** current_period_end moved onto items in recent API versions; check both. */
function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
}

/** Extract the subscription id an event refers to, or null if none applies. */
function subscriptionIdFor(event: Stripe.Event): string | null {
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
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    await svc.from("vendor_subscriptions").upsert(
      {
        vendor_id: vendorId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: periodEnd(sub),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vendor_id" },
    );

    // Activation publishes a draft listing (if one exists). Never unpublishes:
    // the perks predicate already gates on status = active, and leaving
    // published sticky means a re-subscribe relights the listing instantly.
    if (sub.status === "active") {
      await svc
        .from("vendor_listings")
        .update({ published: true })
        .eq("vendor_id", vendorId);
    }

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
