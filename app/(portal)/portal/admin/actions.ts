"use server";

import { revalidatePath } from "next/cache";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { revalidateVendorPage } from "@/lib/vendors/revalidate";

export type RevokeResult = { ok: true } | { ok: false; error: string };

/**
 * Revoke a vendor claim. Admin-only, enforced server-side on the caller's
 * identity (isAdminUser) before the service role touches the row. Revoking sets
 * status = revoked + revoked_at; the partial unique index then frees the vendor
 * for a re-claim, and the perks predicate stops treating it as verified
 * (kills the badge / sort boost instantly if it was live).
 */
export async function revokeClaim(claimId: string): Promise<RevokeResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? null;

  if (!(await isAdminUser(supabase, userId))) {
    return { ok: false, error: "Not authorized." };
  }

  const svc = createServiceRoleClient();
  const { data: revoked, error } = await svc
    .from("vendor_claims")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", claimId)
    .select("vendor_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/admin");
  // A revoked claim ends verification, so the cached vendor page must drop
  // its badge and listing now, not within the hour.
  if (revoked?.vendor_id) {
    await revalidateVendorPage({ id: revoked.vendor_id as string });
  }
  return { ok: true };
}
