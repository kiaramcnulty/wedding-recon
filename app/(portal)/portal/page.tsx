import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Store } from "lucide-react";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/vendor/verified-badge";
import { ClaimBusiness } from "@/components/portal/claim-business";
import { BillingControl } from "@/components/portal/billing-control";
import { VerificationIntro } from "@/components/portal/verification-intro";
import { Step, type StepStatus } from "@/components/portal/verification-steps";
import { PRICE_PER_MONTH, PRICE_BILLING_NOTE } from "@/lib/portal/verification";

/** Stripe statuses that mean a subscription exists (manage, not activate). */
const LIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
]);

/**
 * Vendor portal dashboard. Auth-gated: a signed-out visitor is sent to the
 * public pitch at /vendors, whose CTA routes them through login and back here.
 * Walks a vendor through three sequential steps —
 *   1. Find or create your business (claim)
 *   2. Create your verified listing (draft)
 *   3. Subscribe to verification (publishes the listing, adds the checkmark)
 * A brand-new vendor starts at step 1; a claimed-but-unverified business shows a
 * per-business stepper resumed at its current step; a verified business collapses
 * to a compact manage card.
 *
 * Deliberately reads NO recon and links to NO public vendor page (portal rule).
 */

interface ClaimRow {
  id: string;
  vendor_id: string;
  created_at: string;
  vendor: {
    id: string;
    name: string;
    vendor_type: VendorType;
    city: string | null;
    region: string | null;
  } | null;
}

interface ListingContentRow {
  vendor_id: string;
  intro: string | null;
  cta_label: string | null;
  website: string | null;
  instagram: string | null;
  pricing: unknown[] | null;
  photos: unknown[] | null;
  filter_overrides: Record<string, unknown> | null;
}

/** Whether a listing row carries any vendor-authored content (step 2 done). */
function listingHasContent(l: ListingContentRow): boolean {
  return Boolean(
    l.intro?.trim() ||
      l.cta_label?.trim() ||
      l.website?.trim() ||
      l.instagram?.trim() ||
      (Array.isArray(l.pricing) && l.pricing.length > 0) ||
      (Array.isArray(l.photos) && l.photos.length > 0) ||
      (l.filter_overrides && Object.keys(l.filter_overrides).length > 0),
  );
}

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  // Signed out: the PITCH, not the sign-in form. /portal is what every vendor
  // entry point in the app links to, so this redirect is what makes those links
  // state-aware for free - a cold vendor reads what verification is at
  // /vendors, while a signed-in one never sees the marketing page at all.
  if (!userId) redirect("/vendors");

  // Own approved claims + the vendor row (RLS returns only this user's claims).
  const { data: claimRows } = await supabase
    .from("vendor_claims")
    .select(
      "id, vendor_id, created_at, vendor:vendors(id, name, vendor_type, city, region)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  const claims = (claimRows ?? []) as unknown as ClaimRow[];

  const ids = claims.map((c) => c.vendor_id);
  // Which claimed vendors are verified (approved claim + active sub + published
  // listing), which carry a listing draft (step 2), and which have a live
  // subscription (step 3). verifiedSet via a public SECURITY DEFINER function;
  // listings via the owner's own RLS; subscriptions via the service role because
  // vendor_subscriptions is deny-all to clients (scoped to this user's own ids).
  const verifiedSet = new Set<string>();
  const listingSet = new Set<string>();
  const subscribedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: vids } = await supabase.rpc("verified_vendor_ids", { p_ids: ids });
    for (const r of (vids ?? []) as { vendor_id: string }[]) verifiedSet.add(r.vendor_id);

    const { data: listings } = await supabase
      .from("vendor_listings")
      .select(
        "vendor_id, intro, cta_label, website, instagram, pricing, photos, filter_overrides",
      )
      .in("vendor_id", ids);
    for (const l of (listings ?? []) as ListingContentRow[]) {
      if (listingHasContent(l)) listingSet.add(l.vendor_id);
    }

    const svc = createServiceRoleClient();
    const { data: subs } = await svc
      .from("vendor_subscriptions")
      .select("vendor_id, status")
      .in("vendor_id", ids);
    for (const s of (subs ?? []) as { vendor_id: string; status: string }[]) {
      if (LIVE_STATUSES.has(s.status)) subscribedSet.add(s.vendor_id);
    }
  }

  const isAdmin = await isAdminUser(supabase, userId);

  return (
    <div className="flex flex-col gap-8 py-2">
      <VerificationIntro />

      {claims.length === 0 ? (
        // Brand-new vendor: the three steps, step 1 active.
        <div className="rounded-xl border p-4">
          <Step
            n={1}
            title="Find or create your business"
            status="current"
            description="Search for your business below. If it is not listed yet, you can add it."
          >
            <ClaimBusiness hideHeading />
          </Step>
          <Step
            n={2}
            title="Create your verified listing"
            status="upcoming"
            description="Add your intro, pricing, photos, and a link for couples to take the next step."
          />
          <Step
            n={3}
            title="Subscribe to verification"
            status="upcoming"
            description={`${PRICE_PER_MONTH}, ${PRICE_BILLING_NOTE}. Publishes your listing and adds your checkmark.`}
            last
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {claims.map((c) => {
            const v = c.vendor;
            const cat = v ? CATEGORIES[v.vendor_type] : null;
            const place = [v?.city, v?.region].filter(Boolean).join(", ");
            const verified = verifiedSet.has(c.vendor_id);
            const hasListing = listingSet.has(c.vendor_id);
            const subscribed = subscribedSet.has(c.vendor_id);

            const header = (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Store className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-heading font-semibold">
                      {v?.name ?? "Your business"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {cat && <span style={{ color: cat.colorHex }}>{cat.label}</span>}
                    {place && <span>· {place}</span>}
                  </div>
                </div>
                {verified && <VerifiedBadge />}
              </div>
            );

            // Verified: nothing left to do — a compact manage card.
            if (verified) {
              return (
                <div key={c.id} className="flex flex-col gap-3 rounded-xl border p-4">
                  {header}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/portal/listing/${c.vendor_id}`}
                      className="text-sm font-medium text-primary no-underline hover:underline"
                    >
                      Edit listing
                    </Link>
                    <BillingControl
                      vendorId={c.vendor_id}
                      hasSubscription={subscribed}
                    />
                  </div>
                </div>
              );
            }

            // In progress: resume the stepper at the first incomplete step.
            const step2: StepStatus = hasListing ? "done" : "current";
            const step3: StepStatus = subscribed
              ? "done"
              : hasListing
                ? "current"
                : "upcoming";

            return (
              <div key={c.id} className="rounded-xl border p-4">
                <div className="mb-5">{header}</div>

                <Step
                  n={1}
                  title="Business found"
                  status="done"
                  description="Claimed and linked to your account."
                />

                <Step
                  n={2}
                  title="Create your verified listing"
                  status={step2}
                  description={
                    hasListing
                      ? "Your listing draft is ready. You can keep editing it."
                      : "Add your intro, pricing, photos, and a link couples can act on."
                  }
                >
                  <Link
                    href={`/portal/listing/${c.vendor_id}`}
                    className={cn(
                      buttonVariants({ size: "sm", variant: hasListing ? "outline" : "default" }),
                      "no-underline!",
                    )}
                  >
                    {hasListing ? "Edit listing" : "Create listing"}
                  </Link>
                </Step>

                <Step
                  n={3}
                  title="Subscribe to verification"
                  status={step3}
                  description={`${PRICE_PER_MONTH}, ${PRICE_BILLING_NOTE}. Publishes your listing and adds your checkmark.`}
                  last
                >
                  {step3 === "upcoming" ? (
                    <p className="text-xs text-muted-foreground">
                      Create your listing first, then subscribe to go live.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <BillingControl
                        vendorId={c.vendor_id}
                        hasSubscription={subscribed}
                      />
                      {subscribed && !hasListing && (
                        <p className="text-xs text-muted-foreground">
                          Subscribed — finish your listing above to go live.
                        </p>
                      )}
                    </div>
                  )}
                </Step>
              </div>
            );
          })}

          {/* Add an additional business, out of the way of the main flow. */}
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Add another business
            </summary>
            <div className="mt-4">
              <ClaimBusiness hideHeading />
            </div>
          </details>
        </div>
      )}

      {isAdmin && (
        <Link
          href="/portal/admin"
          className="flex items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <BadgeCheck className="size-4 shrink-0" />
          Review vendor claims (admin)
        </Link>
      )}
    </div>
  );
}
