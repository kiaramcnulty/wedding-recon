"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidateVendorPage } from "@/lib/vendors/revalidate";

export type ReportResult = { ok: true } | { ok: false; reason: "signin" | "failed" };

/**
 * Report a recon entry (the flag on a recon card).
 *
 * A Server Action rather than the browser insert it used to be, because of
 * what a report can DO: the second distinct report flips the entry to
 * `flagged` (trigger `handle_new_report`, migration 0004), which takes it off
 * the public list. The vendor page is a cached render (ISR), so that change
 * only shows once the page is expired, and only server code can expire it.
 * Doing the insert here too means the expiry only ever follows a real report
 * by a signed-in person, never a bare "please revalidate" call.
 *
 * A write, so identity is `getUser()`. The insert runs under the reporter's
 * own RLS, exactly as before; the status read afterwards uses the service role
 * because a flagged entry is no longer readable by the reporter.
 */
export async function reportReconEntry(
  reconEntryId: string,
  reason: string,
): Promise<ReportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "signin" };

  const { error } = await supabase.from("reports").insert({
    recon_entry_id: reconEntryId,
    reporter_id: user.id,
    reason: reason.trim() || null,
  });
  if (error) return { ok: false, reason: "failed" };

  const { data: entry } = await createServiceRoleClient()
    .from("recon_entries")
    .select("status, vendor_id, vendor:vendors(slug)")
    .eq("id", reconEntryId)
    .maybeSingle();
  if (entry && entry.status !== "active") {
    // Supabase types the embedded row as an object or a one-item array.
    const vendorRel = entry.vendor as { slug: string | null } | { slug: string | null }[] | null;
    const slug = (Array.isArray(vendorRel) ? vendorRel[0] : vendorRel)?.slug ?? null;
    await revalidateVendorPage({ id: entry.vendor_id as string, slug });
  }

  return { ok: true };
}
