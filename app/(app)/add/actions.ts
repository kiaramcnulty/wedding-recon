"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // Images are handled as FormData — the caller passes this action a FormData
  // object and we fish out `images[]` entries separately.
}

/**
 * Server Action: resolve canonical vendor, insert recon entry, upload images,
 * auto-save vendor to hub, then redirect to the vendor page.
 *
 * Client should call via FormData so image File objects survive the
 * serialisation boundary. Non-image fields are encoded as JSON in the
 * `__input` key.
 */
export async function createRecon(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── Parse structured input from FormData ─────────────────────────────────
  const raw = formData.get("__input");
  if (!raw || typeof raw !== "string") {
    throw new Error("Missing __input field in FormData");
  }
  const input: CreateReconInput = JSON.parse(raw);

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
            region: input.placeRegion ?? null,
            location: locationEwkt,
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
            region: input.manualRegion ?? null,
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

  // ── 3. Upload images → recon_media rows ───────────────────────────────────
  const imageFiles = formData.getAll("images[]");

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    if (!(file instanceof File) || file.size === 0) continue;

    // Sanitise filename: strip spaces/special chars, keep extension
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${reconId}/${i}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("recon-media")
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      // Non-fatal: log and continue so the recon still publishes
      console.error(`[createRecon] image upload failed (${safeName}):`, uploadError.message);
      continue;
    }

    const { error: mediaError } = await supabase.from("recon_media").insert({
      recon_entry_id: reconId,
      storage_path: storagePath,
      media_type: "image",
    });

    if (mediaError) {
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
