"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRegion } from "@/lib/normalize-region";
import type { VendorType, ReconType } from "@/lib/constants/categories";

export interface CreateReconInput {
  // Vendor resolution — exactly one of these scenarios applies:
  /** Pre-resolved vendor id (user came from hub "Add Recon" button) */
  vendorId?: string;
  /** Google Places data (user selected from autocomplete) */
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  placeCity?: string;
  placeRegion?: string;
  placeLat?: number | null;
  placeLng?: number | null;
  placeWebsite?: string;
  /** Manual entry (location geocoded client-side and required) */
  manualName?: string;
  manualCity?: string;
  manualAddress?: string | null;
  manualRegion?: string | null;
  manualLat?: number | null;
  manualLng?: number | null;

  // Common vendor metadata
  vendorType: VendorType;

  // Recon entry fields
  reconType: ReconType;
  collectedMonth: number;
  collectedYear: number;
  priceText?: string;
  priceDetails?: string;
  serviceRegion?: string;
  notes?: string;

  /**
   * Photos already compressed + uploaded to Storage client-side (see
   * lib/recon-upload.ts); we only record their paths here. Image bytes never
   * pass through this action.
   */
  media?: { path: string; thumbPath: string | null }[];
}

/**
 * Server Action: resolve canonical vendor, insert the recon entry, record its
 * (already-uploaded) media, auto-save the vendor to the hub, then redirect to
 * the vendor page.
 *
 * Photos are compressed and uploaded to Storage client-side (see
 * lib/recon-upload.ts); this action receives only their storage paths in
 * `input.media`, so image bytes never hit the Server Action body limit.
 */
export async function createRecon(input: CreateReconInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── 1. Resolve canonical vendor id ───────────────────────────────────────
  let vendorId = input.vendorId;

  if (!vendorId) {
    if (input.placeId) {
      // --- Google Places path: upsert by google_place_id ---
      const { data: existing } = await supabase
        .from("vendors")
        .select("id")
        .eq("google_place_id", input.placeId)
        .maybeSingle();

      if (existing) {
        vendorId = existing.id as string;
      } else {
        // Build location EWKT string if coords present
        const locationEwkt =
          input.placeLng != null && input.placeLat != null
            ? `SRID=4326;POINT(${input.placeLng} ${input.placeLat})`
            : null;

        const { data: inserted, error } = await supabase
          .from("vendors")
          .insert({
            name: input.placeName ?? "",
            vendor_type: input.vendorType,
            google_place_id: input.placeId,
            address_text: input.placeAddress ?? null,
            city: input.placeCity ?? null,
            region: normalizeRegion(input.placeRegion),
            location: locationEwkt,
            website: input.placeWebsite ?? null,
            source: "google",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (error) throw new Error(`Vendor insert error: ${error.message}`);
        vendorId = inserted.id as string;
      }
    } else {
      // --- Manual entry path: soft-dedup by name + city ---
      const name = (input.manualName ?? "").trim();
      const city = (input.manualCity ?? "").trim();

      if (!name) throw new Error("Vendor name is required");

      const { data: existing } = await supabase
        .from("vendors")
        .select("id")
        .ilike("name", name)
        .ilike("city", city || "")
        .maybeSingle();

      if (existing) {
        vendorId = existing.id as string;
      } else {
        // Manual entries now carry a geocoded location so they appear on the map.
        const locationEwkt =
          input.manualLng != null && input.manualLat != null
            ? `SRID=4326;POINT(${input.manualLng} ${input.manualLat})`
            : null;

        const { data: inserted, error } = await supabase
          .from("vendors")
          .insert({
            name,
            vendor_type: input.vendorType,
            city: city || null,
            address_text: input.manualAddress ?? (city || null),
            region: normalizeRegion(input.manualRegion),
            source: "user",
            created_by: user.id,
            location: locationEwkt,
          })
          .select("id")
          .single();

        if (error) throw new Error(`Vendor insert error: ${error.message}`);
        vendorId = inserted.id as string;
      }
    }
  }

  if (!vendorId) throw new Error("Could not resolve vendor");

  // ── 2. Insert recon_entry ─────────────────────────────────────────────────
  const { data: reconEntry, error: reconError } = await supabase
    .from("recon_entries")
    .insert({
      vendor_id: vendorId,
      author_id: user.id,
      recon_type: input.reconType,
      recon_collected_month: input.collectedMonth,
      recon_collected_year: input.collectedYear,
      price_text: input.priceText?.trim() || null,
      price_details: input.priceDetails?.trim() || null,
      service_region: input.serviceRegion?.trim() || null,
      notes: input.notes?.trim() || null,
      status: "active",
    })
    .select("id")
    .single();

  if (reconError) throw new Error(`Recon insert error: ${reconError.message}`);
  const reconId = reconEntry.id as string;

  // ── 3. Record uploaded media → recon_media rows ───────────────────────────
  // Photos were compressed + uploaded client-side; we just persist their paths.
  const mediaRows = (input.media ?? [])
    .filter((m) => m.path)
    .map((m) => ({
      recon_entry_id: reconId,
      storage_path: m.path,
      thumb_path: m.thumbPath,
      media_type: "image",
    }));

  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabase
      .from("recon_media")
      .insert(mediaRows);
    if (mediaError) {
      // Non-fatal: the recon still publishes even if media rows fail.
      console.error(`[createRecon] recon_media insert failed:`, mediaError.message);
    }
  }

  // ── 4. Auto-save vendor to hub (ignore conflict) ──────────────────────────
  await supabase
    .from("saved_vendors")
    .upsert({ user_id: user.id, vendor_id: vendorId }, { onConflict: "user_id,vendor_id" });

  // ── 5. Redirect to vendor page ────────────────────────────────────────────
  redirect(`/vendor/${vendorId}`);
}
