import "server-only";
import type Stripe from "stripe";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { periodEnd } from "./webhook-events";

/**
 * Mirror one Stripe subscription into vendor_subscriptions.
 *
 * The single writer of that table, shared by the webhook route and by the
 * billing action's reconcile path. Both must produce byte-identical state --
 * the reconcile path exists precisely for when the webhook did NOT run, so if
 * the two wrote different shapes the repair would be worse than the gap.
 *
 * Idempotent and order-safe: callers pass a subscription they just RETRIEVED
 * from Stripe, so this always writes current truth, never the stale contents
 * of whichever event happened to arrive.
 *
 * Service role because vendor_subscriptions is deny-all RLS (0044).
 *
 * @returns whether perks are now live for this vendor (status === "active").
 */
export async function mirrorSubscription(
  vendorId: string,
  sub: Stripe.Subscription,
): Promise<boolean> {
  const svc = createServiceRoleClient();
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

  return sub.status === "active";
}

/**
 * Find the newest subscription Stripe holds for a vendor, or null.
 *
 * Reads STRIPE, not our mirror -- this is the backstop for the case where the
 * mirror is empty because a webhook never arrived (a misregistered endpoint, a
 * 308 from the apex domain, a failed delivery nobody replayed). Without it, a
 * vendor who has genuinely paid looks unpaid to us and the portal will happily
 * sell them a SECOND subscription.
 *
 * Search is eventually consistent (roughly a minute for a brand-new object),
 * which is fine for every case this guards: someone coming back to a portal
 * that never registered their payment is minutes-to-days later, not seconds.
 */
export async function findStripeSubscription(
  stripe: Stripe,
  vendorId: string,
): Promise<Stripe.Subscription | null> {
  // vendorId reaches us from an approved-claim lookup, so it is a uuid from
  // our own DB -- but this interpolates into a query language, so prove it
  // rather than trusting the caller.
  if (!/^[0-9a-f-]{36}$/i.test(vendorId)) return null;

  const res = await stripe.subscriptions.search({
    query: `metadata['vendor_id']:'${vendorId}'`,
    limit: 20,
  });
  if (!res.data.length) return null;

  // Prefer a subscription that is actually live; among equals take the newest.
  const rank = (s: Stripe.Subscription) =>
    s.status === "active" || s.status === "trialing" ? 0 : 1;
  return [...res.data].sort(
    (a, b) => rank(a) - rank(b) || b.created - a.created,
  )[0];
}
