"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { filtersForType } from "@/lib/constants/vendor-filters";
import type { VendorType } from "@/lib/constants/categories";

const CTA_LABELS = ["Book a tour", "Check availability", "Contact us", "Get a quote"] as const;
type CtaLabel = (typeof CTA_LABELS)[number];

export interface PricingRowInput {
  label: string;
  price: string;
  unit: string;
}

export interface PhotoInput {
  storage_path: string;
  thumb_path: string;
}

export interface SaveListingInput {
  vendorId: string;
  intro: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  website: string | null;
  instagram: string | null;
  pricing: PricingRowInput[];
  filterOverrides: Record<string, unknown>;
  photos: PhotoInput[];
}

const MAX_PHOTOS = 4;

/**
 * Keep only photos whose paths are namespaced under THIS vendor's folder — the
 * same ownership the bucket RLS enforces at upload, re-checked here before the
 * paths are recorded, so a client cannot record a path it does not own.
 */
function sanitizePhotos(vendorId: string, raw: PhotoInput[]): PhotoInput[] {
  const prefix = `${vendorId}/`;
  return (raw ?? [])
    .filter(
      (p) =>
        typeof p?.storage_path === "string" &&
        typeof p?.thumb_path === "string" &&
        p.storage_path.startsWith(prefix) &&
        p.thumb_path.startsWith(prefix),
    )
    .slice(0, MAX_PHOTOS)
    .map((p) => ({ storage_path: p.storage_path, thumb_path: p.thumb_path }));
}

/**
 * Keep only the keys/values that this vendor type's filters legitimately hold,
 * in the exact jsonb shape the matcher reads. Anything else the client sent is
 * dropped, so a listing save can never inject arbitrary jsonb into the merge:
 *   multi  -> string[] of known option values (dropped if empty)
 *   bool   -> boolean
 *   range  -> finite number(s) at the def's key (point) or lo/hi (overlap)
 */
function sanitizeFilterOverrides(
  vendorType: VendorType,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of filtersForType(vendorType)) {
    if (def.kind === "multi") {
      const v = raw[def.key];
      const allowed = new Set((def.options ?? []).map((o) => o.value));
      if (Array.isArray(v)) {
        const clean = v.filter((x): x is string => typeof x === "string" && allowed.has(x));
        if (clean.length) out[def.key] = clean;
      }
    } else if (def.kind === "bool") {
      const v = raw[def.key];
      if (typeof v === "boolean") out[def.key] = v;
    } else if (def.kind === "range") {
      const keys = def.mode === "point" ? [def.key] : [def.lo ?? def.key, def.hi ?? def.key];
      for (const k of keys) {
        const n = raw[k];
        if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
      }
    }
  }
  return out;
}

export type SaveListingResult =
  | { ok: true; published: boolean }
  | { ok: false; error: string };

const MAX_INTRO = 600;
const MAX_PRICING_ROWS = 20;

/** Bare Instagram handle from a handle, @handle, or profile URL. */
function normalizeInstagram(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  const m = s.match(/instagram\.com\/([^/?#]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, "").trim();
  return s || null;
}

/** A website with a scheme (ExternalLink needs a valid absolute URL). */
function normalizeWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Save a claimed vendor's listing. Draft-then-activate: any approved claimant
 * may save, and `published` tracks the subscription — an unpaid save persists
 * as a draft (published=false), a save while the subscription is active
 * publishes. The RLS insert/update policy already requires the approved claim,
 * so this cannot write a listing for a vendor the caller does not hold.
 *
 * Note published=true does NOT by itself grant perks: verified_vendor_ids also
 * requires an active subscription, so the subscription is the real gate. We set
 * published here so the state is correct the moment billing activates (the
 * Stripe webhook, later, flips it on activation for a vendor who drafted first).
 */
export async function saveListing(input: SaveListingInput): Promise<SaveListingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?from=/portal");

  // Must hold the approved claim (also enforced by RLS on the upsert below; this
  // is the friendly error).
  const { data: claim } = await supabase
    .from("vendor_claims")
    .select("id")
    .eq("vendor_id", input.vendorId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (!claim) return { ok: false, error: "You do not manage this business." };

  // Vendor type is canonical vendor data; the sanitizer reads it (not the
  // client) to decide which override keys are valid for this vendor.
  const { data: vendorRow } = await supabase
    .from("vendors")
    .select("vendor_type")
    .eq("id", input.vendorId)
    .maybeSingle();
  const vendorType = vendorRow?.vendor_type as VendorType | undefined;
  const filterOverrides = vendorType
    ? sanitizeFilterOverrides(vendorType, input.filterOverrides ?? {})
    : {};
  const photos = sanitizePhotos(input.vendorId, input.photos);

  // Validate.
  const intro = input.intro.trim().slice(0, MAX_INTRO);
  const ctaLabel: CtaLabel | null =
    input.ctaLabel && (CTA_LABELS as readonly string[]).includes(input.ctaLabel)
      ? (input.ctaLabel as CtaLabel)
      : null;
  const ctaUrl = normalizeWebsite(input.ctaUrl);
  if (ctaUrl && !/^https:\/\//i.test(ctaUrl)) {
    return { ok: false, error: "The CTA link must be a secure https URL." };
  }
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
    return { ok: false, error: "A CTA needs both a label and a link." };
  }
  const website = normalizeWebsite(input.website);
  const instagram = normalizeInstagram(input.instagram);
  const pricing = input.pricing
    .map((r) => ({
      label: r.label.trim(),
      price: r.price.trim(),
      unit: r.unit.trim(),
    }))
    .filter((r) => r.label || r.price)
    .slice(0, MAX_PRICING_ROWS);

  // Determine published from the real subscription status (service role: the
  // subscriptions table is deny-all to clients). No sub yet in this slice, so
  // this is false until billing lands.
  const svc = createServiceRoleClient();
  const { data: sub } = await svc
    .from("vendor_subscriptions")
    .select("status")
    .eq("vendor_id", input.vendorId)
    .maybeSingle();
  const published = sub?.status === "active";

  const { error } = await supabase.from("vendor_listings").upsert(
    {
      vendor_id: input.vendorId,
      intro: intro || null,
      cta_label: ctaLabel,
      cta_url: ctaUrl,
      website,
      instagram,
      pricing,
      photos,
      filter_overrides: filterOverrides,
      published,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vendor_id" },
  );
  if (error) return { ok: false, error: `Could not save: ${error.message}` };

  revalidatePath("/portal");
  revalidatePath(`/portal/listing/${input.vendorId}`);
  revalidatePath(`/vendor/${input.vendorId}`);
  return { ok: true, published };
}
