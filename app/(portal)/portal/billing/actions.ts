"use server";

import { redirect } from "next/navigation";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

export type BillingResult = { url: string } | { error: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Subscription statuses that mean "already has billing" — don't double-charge. */
const LIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
]);

/** Whether the caller holds the approved claim on this vendor. */
async function hasApprovedClaim(vendorId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?from=/portal");
  const { data: claim } = await supabase
    .from("vendor_claims")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  return !!claim;
}

/**
 * Start (or resume) the $120 / 6-month subscription for a claimed vendor.
 *
 * If the vendor already has a live subscription we do NOT open a second
 * Checkout — we return a Customer Portal link instead, so a double-charge is
 * impossible. The subscription carries vendor_id in its metadata so every later
 * webhook event can map back to the vendor.
 */
export async function startCheckout(vendorId: string): Promise<BillingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?from=/portal");
  const { data: claim } = await supabase
    .from("vendor_claims")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (!claim) return { error: "You do not manage this business." };

  const price = process.env.STRIPE_PRICE_6MO;
  if (!price) return { error: "Billing is not configured yet." };

  const svc = createServiceRoleClient();
  const { data: sub } = await svc
    .from("vendor_subscriptions")
    .select("status, stripe_customer_id")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  const stripe = getStripe();

  // Already paying (or mid-payment): send them to manage, never re-checkout.
  if (sub && LIVE_STATUSES.has(sub.status) && sub.stripe_customer_id) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${SITE_URL}/portal`,
    });
    return { url: portal.url };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: vendorId,
    customer_email: user.email ?? undefined,
    subscription_data: { metadata: { vendor_id: vendorId } },
    success_url: `${SITE_URL}/portal?checkout=success`,
    cancel_url: `${SITE_URL}/portal?checkout=cancel`,
  });
  if (!session.url) return { error: "Could not start checkout." };
  return { url: session.url };
}

/** Open the Stripe Customer Portal for a claimed vendor's subscription. */
export async function openBillingPortal(vendorId: string): Promise<BillingResult> {
  if (!(await hasApprovedClaim(vendorId)))
    return { error: "You do not manage this business." };

  const svc = createServiceRoleClient();
  const { data: sub } = await svc
    .from("vendor_subscriptions")
    .select("stripe_customer_id")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) return { error: "No billing on file yet." };

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${SITE_URL}/portal`,
  });
  return { url: portal.url };
}
