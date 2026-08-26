import { redirect } from "next/navigation";
import { BadgeCheck, Store } from "lucide-react";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import { VerifiedBadge } from "@/components/vendor/verified-badge";
import { ClaimBusiness } from "@/components/portal/claim-business";
import { BillingControl } from "@/components/portal/billing-control";
import Link from "next/link";

/** Stripe statuses that mean a subscription exists (manage, not activate). */
const LIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
]);

/**
 * Vendor portal dashboard. Auth-gated (a signed-out visitor is sent to login,
 * back to /portal). Shows the vendor's claimed businesses, each with a link to
 * edit its listing and a billing control (activate the $120/6-mo verification,
 * or manage an existing subscription), plus the claim flow to add a business.
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

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect("/login?from=/portal");

  // Own approved claims + the vendor row (RLS returns only this user's claims).
  const { data: claimRows } = await supabase
    .from("vendor_claims")
    .select(
      "id, vendor_id, created_at, vendor:vendors(id, name, vendor_type, city, region)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  const claims = (claimRows ?? []) as unknown as ClaimRow[];

  // Which of these are currently verified (approved claim + active subscription
  // + published listing). A public SECURITY DEFINER function.
  const ids = claims.map((c) => c.vendor_id);
  const verifiedSet = new Set<string>();
  // Which claimed vendors already have a subscription on file (any live status),
  // so the card offers "Manage billing" vs "Activate". Read via the service role
  // because vendor_subscriptions is deny-all to clients; scoped to this user's
  // own claimed vendor ids, so nothing leaks.
  const subscribedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: vids } = await supabase.rpc("verified_vendor_ids", { p_ids: ids });
    for (const r of (vids ?? []) as { vendor_id: string }[]) verifiedSet.add(r.vendor_id);

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
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="font-heading text-xl font-semibold">Your businesses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claim your business to keep its information accurate on Wedding Recon.
        </p>
      </div>

      {claims.length > 0 && (
        <div className="flex flex-col gap-3">
          {claims.map((c) => {
            const v = c.vendor;
            const cat = v ? CATEGORIES[v.vendor_type] : null;
            const verified = verifiedSet.has(c.vendor_id);
            const place = [v?.city, v?.region].filter(Boolean).join(", ");
            return (
              <div key={c.id} className="flex flex-col gap-2 rounded-xl border p-4">
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
                  {verified ? (
                    <VerifiedBadge />
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Claimed
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/portal/listing/${c.vendor_id}`}
                    className="text-sm font-medium text-primary no-underline hover:underline"
                  >
                    Edit listing
                  </Link>
                  <BillingControl
                    vendorId={c.vendor_id}
                    hasSubscription={subscribedSet.has(c.vendor_id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClaimBusiness />

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
