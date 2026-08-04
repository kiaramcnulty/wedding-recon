"use server";

import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { usesServiceRegion } from "@/lib/constants/categories";
import type { ReconType, VendorType } from "@/lib/constants/categories";

export interface UpdateReconInput {
  reconId: string;
  /**
   * Where to land after saving — the originating vendor page URL, carrying its
   * own `from`. Validated as an internal path below (never trusted as-is).
   * Falls back to the plain vendor page.
   */
  returnTo?: string;
  reconType: ReconType;
  collectedMonth: number;
  collectedYear: number;
  priceText?: string;
  priceDetails?: string;
  serviceRegion?: string;
  notes?: string;
}

/**
 * Server Action: update one recon entry the caller authored, then redirect back
 * to the vendor page.
 *
 * Deliberately NOT in the input: the vendor and its type. Both are canonical
 * vendor data the edit form only displays, so they are read from the row here
 * rather than accepted from the client — the locked chip is enforced, not just
 * rendered. Photos are likewise untouched: editing is text-only for now, so
 * existing recon_media rows survive unchanged.
 */
export async function updateRecon(input: UpdateReconInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Re-read the row rather than trusting the client for vendor/ownership. RLS
  // would block a foreign update anyway, but this yields a real error instead
  // of a silent zero-row write, and gives us the vendor type below.
  const { data: entry, error: fetchError } = await supabase
    .from("recon_entries")
    .select("id, author_id, vendor_id, status, vendor:vendors(vendor_type)")
    .eq("id", input.reconId)
    .single();

  if (fetchError || !entry) throw new Error("Recon entry not found");
  if (entry.author_id !== user.id) {
    throw new Error("You can only edit your own recon");
  }
  if (entry.status === "removed") {
    throw new Error("This entry was removed and can no longer be edited");
  }

  // Supabase types the embedded row as an object or single-item array.
  const vendorRel = entry.vendor as
    | { vendor_type: VendorType }
    | { vendor_type: VendorType }[]
    | null;
  const vendorType = (Array.isArray(vendorRel) ? vendorRel[0] : vendorRel)
    ?.vendor_type;

  const { error: updateError } = await supabase
    .from("recon_entries")
    .update({
      recon_type: input.reconType,
      recon_collected_month: input.collectedMonth,
      recon_collected_year: input.collectedYear,
      price_text: input.priceText?.trim() || null,
      price_details: input.priceDetails?.trim() || null,
      // Venues and hotel blocks are a fixed property, so the form hides this
      // field for them. Write null rather than preserving a stale value the
      // author cannot see (same cleanup migration 0024 did for hotels).
      service_region: usesServiceRegion(vendorType)
        ? input.serviceRegion?.trim() || null
        : null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.reconId);

  if (updateError) throw new Error(`Recon update error: ${updateError.message}`);

  // Both pages are dynamic (cookie-based client), so there is no full-route
  // cache to bust — this clears Next's client-side Router Cache so a back-nav
  // after saving does not show the pre-edit copy.
  revalidatePath(`/vendor/${entry.vendor_id}`);
  revalidatePath("/hub");

  // Internal paths only — a caller-supplied target is an open-redirect vector.
  const target =
    input.returnTo?.startsWith("/") && !input.returnTo.startsWith("//")
      ? input.returnTo
      : `/vendor/${entry.vendor_id}`;

  // `replace`, not push: a saved form should not be reachable by pressing back.
  redirect(target, RedirectType.replace);
}
