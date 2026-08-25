import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { RevokeClaimButton } from "@/components/portal/revoke-claim-button";

/**
 * Retroactive claim review, admin-only. Claims auto-approve, so this is the
 * queue Kiara reviews after the fact: newest first, the email-domain-match
 * signal precomputed, current subscription status, and a Revoke control.
 *
 * Reads via the service role because vendor_claims RLS returns only the
 * caller's own claims and vendor_subscriptions is deny-all — an admin needs the
 * whole set. The role gate is isAdminUser on the CALLER before any of that.
 */

interface ClaimAdminRow {
  id: string;
  vendor_id: string;
  user_id: string;
  status: string;
  contact_email: string;
  claimant_role: string | null;
  email_domain_matches_website: boolean | null;
  created_at: string;
  vendor: { name: string; vendor_type: string; city: string | null; website: string | null } | null;
}

function matchLabel(m: boolean | null): { text: string; cls: string } {
  if (m === true) return { text: "domain match", cls: "bg-emerald-100 text-emerald-800" };
  if (m === false) return { text: "free/other email", cls: "bg-amber-100 text-amber-900" };
  return { text: "no website", cls: "bg-muted text-muted-foreground" };
}

export default async function AdminClaimsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? null;
  if (!userId) redirect("/login?from=/portal/admin");
  // A non-admin should not learn this route exists.
  if (!(await isAdminUser(supabase, userId))) notFound();

  const svc = createServiceRoleClient();
  const { data: rows } = await svc
    .from("vendor_claims")
    .select(
      "id, vendor_id, user_id, status, contact_email, claimant_role, email_domain_matches_website, created_at, vendor:vendors(name, vendor_type, city, website)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  const list = (rows ?? []) as unknown as ClaimAdminRow[];

  const ids = list.map((r) => r.vendor_id);
  const subByVendor = new Map<string, string>();
  if (ids.length > 0) {
    const { data: subs } = await svc
      .from("vendor_subscriptions")
      .select("vendor_id, status")
      .in("vendor_id", ids);
    for (const s of (subs ?? []) as { vendor_id: string; status: string }[]) {
      subByVendor.set(s.vendor_id, s.status);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <Link
        href="/portal"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to portal
      </Link>

      <div>
        <h1 className="font-heading text-xl font-semibold">Vendor claims</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.length} claim{list.length === 1 ? "" : "s"}, newest first. Claims
          auto-approve; revoke any that are not legitimate.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {list.map((r) => {
          const m = matchLabel(r.email_domain_matches_website);
          const sub = subByVendor.get(r.vendor_id) ?? "none";
          const revoked = r.status === "revoked";
          return (
            <div
              key={r.id}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${revoked ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-heading font-semibold">
                    {r.vendor?.name ?? "(vendor gone)"}
                  </span>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.vendor?.vendor_type}
                    {r.vendor?.city ? ` · ${r.vendor.city}` : ""}
                    {r.claimant_role ? ` · role: ${r.claimant_role}` : ""}
                  </div>
                </div>
                {!revoked && <RevokeClaimButton claimId={r.id} />}
                {revoked && (
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    revoked
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{r.contact_email}</span>
                <span className={`rounded-full px-2 py-0.5 ${m.cls}`}>{m.text}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  subscription: {sub}
                </span>
                {r.vendor?.website && (
                  <span className="truncate text-muted-foreground">
                    {r.vendor.website}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">No claims yet.</p>
        )}
      </div>
    </div>
  );
}
