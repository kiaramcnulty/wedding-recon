"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { normalizeRegion } from "@/lib/normalize-region";
import { captureServer } from "@/lib/analytics/posthog-server";
import { sendClaimReport, emailMatchesWebsite } from "@/lib/notify/claim-report";
import type { VendorType } from "@/lib/constants/categories";

export interface ClaimVendorInput {
  // Exactly one resolution scenario applies (mirrors createRecon):
  /** Existing Wedding Recon vendor picked from search. */
  vendorId?: string;
  /** Google Places result. */
  placeId?: string;
  placeName?: string;
  placeAddress?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeWebsite?: string | null;
  /** Manual entry (geocoded client-side). */
  manualName?: string;
  manualCity?: string;
  manualAddress?: string | null;
  manualRegion?: string | null;
  manualLat?: number | null;
  manualLng?: number | null;

  /** Required for the create-new paths (google/manual); ignored for existing. */
  vendorType?: VendorType;
  /** Optional self-described role, e.g. owner / manager. */
  role?: string;
}

export type ClaimResult =
  | { ok: true; vendorId: string; alreadyYours: boolean }
  | { ok: false; error: string };

const CONTACT = "kiaramcnulty@gmail.com";

/**
 * Claim a business for the signed-in vendor. Auto-approved. Resolves (or
 * creates) the vendor exactly like the Add Recon flow, then inserts a
 * vendor_claims row under the caller's own RLS (user_id must be self). A second
 * claim on a vendor someone else already holds is refused via the partial
 * unique index (23505); the caller re-claiming their own vendor is a no-op.
 *
 * Fires an optional owner email + a PostHog event for retroactive review;
 * neither can fail the claim.
 */
export async function claimVendor(input: ClaimVendorInput): Promise<ClaimResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?from=/portal");

  const contactEmail = user.email ?? "";

  // ── Resolve the vendor id (create if new) ────────────────────────────────
  let vendorId = input.vendorId;

  if (!vendorId) {
    if (input.placeId) {
      const { data: existing } = await supabase
        .from("vendors")
        .select("id")
        .eq("google_place_id", input.placeId)
        .maybeSingle();
      if (existing) {
        vendorId = existing.id as string;
      } else {
        if (!input.vendorType) return { ok: false, error: "Pick a vendor category." };
        const parts = (input.placeAddress ?? "").split(",").map((s) => s.trim());
        const city = parts[parts.length - 3] ?? parts[0] ?? null;
        const region = parts[parts.length - 2] ?? null;
        const location =
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
            city,
            region: normalizeRegion(region ?? undefined),
            location,
            website: input.placeWebsite ?? null,
            source: "google",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: `Could not create vendor: ${error.message}` };
        vendorId = inserted.id as string;
      }
    } else {
      const name = (input.manualName ?? "").trim();
      const city = (input.manualCity ?? "").trim();
      if (!name) return { ok: false, error: "Enter your business name." };
      if (!input.vendorType) return { ok: false, error: "Pick a vendor category." };
      const { data: existing } = await supabase
        .from("vendors")
        .select("id")
        .ilike("name", name)
        .ilike("city", city || "")
        .maybeSingle();
      if (existing) {
        vendorId = existing.id as string;
      } else {
        const location =
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
            region: normalizeRegion(input.manualRegion ?? undefined),
            source: "user",
            created_by: user.id,
            location,
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: `Could not create vendor: ${error.message}` };
        vendorId = inserted.id as string;
      }
    }
  }

  if (!vendorId) return { ok: false, error: "Could not resolve the business." };

  // ── Already yours? (idempotent) ──────────────────────────────────────────
  const { data: mine } = await supabase
    .from("vendor_claims")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (mine) {
    return { ok: true, vendorId, alreadyYours: true };
  }

  // ── Read the vendor for the report + the domain-match signal ─────────────
  const { data: vendor } = await supabase
    .from("vendors")
    .select("name, city, vendor_type, website")
    .eq("id", vendorId)
    .single();

  const domainMatch = emailMatchesWebsite(contactEmail, vendor?.website ?? null);

  // ── Insert the claim ─────────────────────────────────────────────────────
  const { error: claimErr } = await supabase.from("vendor_claims").insert({
    vendor_id: vendorId,
    user_id: user.id,
    status: "approved",
    contact_email: contactEmail,
    claimant_role: input.role?.trim() || null,
    email_domain_matches_website: domainMatch,
  });

  if (claimErr) {
    // 23505 = the partial unique index: someone else already holds this vendor.
    if (claimErr.code === "23505") {
      return {
        ok: false,
        error: `This business has already been claimed. If it is yours, contact ${CONTACT}.`,
      };
    }
    return { ok: false, error: `Could not claim: ${claimErr.message}` };
  }

  // ── Retroactive-review notifications (never block the claim) ─────────────
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    (hdrs.get("host") ? `https://${hdrs.get("host")}` : "");
  await Promise.all([
    captureServer(user.id, "vendor_claim_created", {
      vendor_id: vendorId,
      vendor_type: vendor?.vendor_type ?? null,
      email_domain_matches_website: domainMatch,
    }),
    sendClaimReport({
      vendorName: vendor?.name ?? "(unknown)",
      vendorType: vendor?.vendor_type ?? "(unknown)",
      city: vendor?.city ?? null,
      claimantEmail: contactEmail,
      emailDomainMatchesWebsite: domainMatch,
      adminUrl: `${origin}/portal/admin`,
    }),
  ]);

  revalidatePath("/portal");
  return { ok: true, vendorId, alreadyYours: false };
}
