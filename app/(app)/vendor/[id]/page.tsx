import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  MapPin,
  ExternalLink as ExternalLinkIcon,
  Globe,
  Waypoints,
} from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { getVendorGooglePhotos } from "@/lib/google-photos";
import {
  CATEGORIES,
  usesServiceRegion,
  type VendorType,
} from "@/lib/constants/categories";
import { isApproximateLocation } from "@/lib/map/vendor-location";
import { sortReconEntries } from "@/lib/recon-sort";
import { vendorTags } from "@/lib/filters/vendor-tags";
import { VendorTagList } from "@/components/vendor/vendor-tags";
import { VendorMapPreview } from "@/components/vendor/vendor-map-preview";
import type { ReconEntryWithDetails } from "@/lib/types";
import { VendorPhotos } from "@/components/vendor/vendor-photos";
import { ReconCard } from "@/components/vendor/recon-card";
import { AddReconLink, ReconSlot } from "@/components/vendor/recon-slot";
import { VerifiedBadge } from "@/components/vendor/verified-badge";
import { VerifyBusinessLink } from "@/components/portal/verify-business-link";
import {
  VendorListingContent,
  type PricingRow,
} from "@/components/vendor/listing-content";
import { SaveButton } from "@/components/vendor/save-button";
import { ShareButton } from "@/components/vendor/share-button";
import { BackButton } from "@/components/vendor/back-button";
import { ExternalLink } from "@/components/external-link";
import { BrandFooter } from "@/components/brand-lockup";
import { cn } from "@/lib/utils";
import { isVendorUuid, vendorPath } from "@/lib/vendors/slug";

/** One row of a verified vendor's published listing (RPC verified_listing_public). */
interface VerifiedListingRow {
  vendor_id: string;
  intro: string | null;
  cta_label: string | null;
  cta_url: string | null;
  website: string | null;
  instagram: string | null;
  pricing: PricingRow[] | null;
  photos: { storage_path: string; thumb_path: string }[] | null;
}

/** Instagram glyph — lucide v1 dropped brand icons, so this is drawn inline to lucide's stroke conventions. */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface VendorPageProps {
  params: Promise<{ id: string }>;
}

/*
 * CACHED (ISR): one render per vendor is shared by every visitor and crawler,
 * served from Vercel's CDN, and re-rendered at most hourly or when a write
 * calls `revalidateVendorPage()` (lib/vendors/revalidate.ts). A full render
 * was ~37 ms of billed function CPU on every view (docs/notes/function-cpu.md).
 *
 * That only holds while the render reads NOTHING per-request: no cookies (so
 * no `createClient()` from lib/supabase/server -- `createPublicClient()`
 * instead), no `searchParams`, no `headers()`, no `cache: "no-store"` fetch.
 * Any one of those turns the whole route back into a per-request render, and
 * nothing errors when it does. The viewer-specific parts live in Client
 * Components that read the session in the browser (lib/viewer.ts), and the
 * `from` return path is read there too. `scripts/test-vendor-page-static.mjs`
 * guards the obvious regressions; `x-nextjs-cache: HIT` on a second request is
 * the real check.
 */
export const revalidate = 3600;

/**
 * Nothing is prerendered at build time; each vendor renders on its first visit
 * and is cached from then on. Returning an empty list (rather than omitting
 * this) is what makes a dynamic segment ISR instead of dynamic.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

/**
 * The vendor row, fetched at most ONCE per request.
 *
 * generateMetadata and the page component both need it, and they used to issue
 * a query each — two Supabase round trips for one row, on every vendor page
 * view. React's `cache()` dedupes within a single request render, so the second
 * caller gets the first one's promise. It has to be the full `select("*")` the
 * page needs (metadata reads three of those columns), which is why metadata now
 * over-fetches slightly: one wider query beats two narrow ones when the cost is
 * a network round trip, not bytes.
 */
const getVendor = cache(async (ref: string) => {
  const supabase = createPublicClient();
  // The segment is a slug (`/vendor/dj-blnce`) or, for a link shared before
  // slugs existed, the uuid. The page redirects the uuid form to the slug, so
  // the id lookup only ever serves that redirect. See lib/vendors/slug.ts.
  return supabase
    .from("vendors")
    .select("*")
    .eq(isVendorUuid(ref) ? "id" : "slug", ref.toLowerCase())
    .maybeSingle();
});

// Per-vendor social metadata: a shared /vendor/[id] link (SMS, X, etc.) should
// preview with the vendor's name + a real description, not the static root
// title. The brand og:image (app/opengraph-image.png) is inherited from the
// root layout since we don't override openGraph.images here.
export async function generateMetadata({
  params,
}: VendorPageProps): Promise<Metadata> {
  const { id: ref } = await params;
  const { data: vendor } = await getVendor(ref);

  if (!vendor) {
    return { title: "Vendor not found" };
  }

  const label = CATEGORIES[vendor.vendor_type as VendorType]?.label ?? "vendor";
  const where = vendor.city ? ` in ${vendor.city}` : "";
  const description = `Recon on ${vendor.name}, a ${label.toLowerCase()}${where} — real price quotes, notes, and photos from couples on Wedding Recon.`;

  return {
    title: vendor.name,
    description,
    openGraph: {
      title: `${vendor.name} · Wedding Recon`,
      description,
      type: "article",
      url: vendorPath(vendor),
    },
    twitter: {
      card: "summary_large_image",
      title: `${vendor.name} · Wedding Recon`,
      description,
    },
    // One canonical URL per vendor however it was reached (slug, a `from`
    // return path, a tracking param), so search engines index one page.
    alternates: { canonical: vendorPath(vendor) },
  };
}

export default async function VendorPage({ params }: VendorPageProps) {
  const { id: ref } = await params;
  const supabase = createPublicClient();

  // Stage 1 — independent fetches in parallel: the vendor row and its active
  // recon entries. (The viewer's identity is not read here: this render is
  // shared by everyone. See the note above `revalidate`.)
  //
  // The recon query keys on the vendor through an inner join on the slug, not
  // on vendor_id, so it does not have to wait for the vendor row to learn the
  // id. A legacy uuid segment skips it: that request only redirects.
  const legacyId = isVendorUuid(ref);
  const [vendorRes, entriesRes] = await Promise.all([
    // Deduped with generateMetadata's fetch via React cache() — see getVendor.
    getVendor(ref),
    legacyId
      ? null
      : supabase
          .from("recon_entries")
          .select(
            "*, author:profiles(username, is_bot), media:recon_media(*), vendor:vendors!inner(slug)",
          )
          .eq("vendor.slug", ref.toLowerCase())
          .eq("status", "active")
          .order("created_at", { ascending: false }),
  ]);

  const vendor = vendorRes.data;
  if (vendorRes.error || !vendor) {
    notFound();
  }
  const id = vendor.id as string;

  // An old /vendor/<uuid> link (or a slug typed in capitals): send it to the
  // canonical slug URL. A FALLBACK: proxy.ts already 308s every uuid URL,
  // query string kept, before this page runs (lib/vendors/legacy-redirect.ts).
  // This one cannot keep the query string, because a cached render never sees
  // it; it only fires when that lookup failed, or for a capitalized slug.
  if (vendor.slug && ref !== vendor.slug) {
    permanentRedirect(vendorPath(vendor));
  }

  // Only reached with a uuid segment when the row has no slug, i.e. before
  // migration 0052 is applied: fetch the entries by id as the page always did.
  const entriesData = entriesRes
    ? entriesRes.data
    : (
        await supabase
          .from("recon_entries")
          .select("*, author:profiles(username, is_bot), media:recon_media(*)")
          .eq("vendor_id", id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
      ).data;

  // A fixed-location vendor (a venue, a hotel, a bridal shop) IS a property at
  // an address, so its pin is the fact and it gets a map preview. A
  // service-region vendor's pin marks a base they travel out from — mapping
  // that at street zoom would assert a precision the row does not have, so they
  // get their service area in words instead. Same split the Explore map draws
  // with the halo, and the same list that gates the Add Recon form field:
  // `FIXED_LOCATION_TYPES` in lib/constants/categories.ts.
  const fixedLocation = !usesServiceRegion(vendor.vendor_type as VendorType);

  // Stage 2 — all need stage-1 results. getVendorGooglePhotos only touches
  // the network on a cache miss, so it's usually free. (The viewer's own
  // entries, flagged ones included, and the admin flag are read in the
  // browser now: lib/viewer.ts.)
  const [googlePhotos, coordsRes, verifiedRes, overridesRes] =
    await Promise.all([
      getVendorGooglePhotos(vendor),
      // vendors.location is PostGIS geography, which PostgREST hands back as hex
      // EWKB — the RPC (migration 0029) is what flattens it to lng/lat. Errors
      // are swallowed by design: until that migration is hand-applied the call
      // fails, `data` is null, and the page renders exactly as it did before.
      fixedLocation
        ? supabase.rpc("vendor_location", { p_id: id }).maybeSingle()
        : Promise.resolve({ data: null }),
      // A verified vendor's published listing (intro / CTA / pricing / links).
      // A SECURITY DEFINER function (migration 0046) that returns a row ONLY for
      // a verified vendor, so it doubles as the badge signal. Errors are
      // swallowed by design: until 0046 is applied the call fails, `data` is
      // null/empty, and the page renders with no badge or block, as today.
      supabase.rpc("verified_listing_public", { p_vendor_id: id }),
      // A verified vendor's published filter overrides (migration 0044), merged
      // over the extracted tags below so the chips match what the map shows.
      supabase.rpc("verified_listing_overrides", { p_ids: [id] }),
    ]);
  const coords = coordsRes.data as { lng: number; lat: number } | null;
  const listing = ((verifiedRes.data ?? []) as VerifiedListingRow[])[0] ?? null;
  const isVerified = !!listing;
  // The vendor's own maintained links win over extracted ones while verified.
  const effectiveWebsite = listing?.website || vendor.website;
  const effectiveInstagram = listing?.instagram || vendor.instagram;
  // Merge the vendor's published filter overrides over the extracted filters,
  // exactly as vendor_filters_in_bbox does for the map (0045), so the chips and
  // the map agree. Override keys win; extracted keys survive where not set.
  const overrideRow = ((overridesRes.data ?? []) as {
    vendor_id: string;
    filter_overrides: Record<string, unknown> | null;
  }[])[0];
  const filterOverrides = overrideRow?.filter_overrides ?? {};
  const hasOverrides = Object.keys(filterOverrides).length > 0;
  const effectiveFilters = hasOverrides
    ? { ...(vendor.filters ?? {}), ...filterOverrides }
    : vendor.filters;

  // Distinct author names for the "Photos via Google" caption.
  const googleCredit =
    [
      ...new Set(googlePhotos.map((p) => p.attrib).filter((a): a is string => !!a)),
    ].join(", ") || null;

  const rawList = (entriesData ?? []) as ReconEntryWithDetails[];

  // Entries that state a price first, then most recently collected. The SAME
  // order for every viewer (the page is cached); the viewer's own entry is
  // marked where it falls, not moved. Shared with the preview card's carousel
  // so the entry a card leads with is the entry this page leads with — see
  // lib/recon-sort.ts.
  const entries = sortReconEntries(rawList);

  // Media: thumbnails inline, full opened in the lightbox so the strip itself
  // stays cheap on egress. Public bucket, so no network call. Resolved once
  // per entry and shared by the strip and that entry's card.
  const entryPhotos = new Map(
    entries.map((entry) => [
      entry.id,
      entry.media.map((m) => ({
        thumb: supabase.storage
          .from("recon-media")
          .getPublicUrl(m.thumb_path ?? m.storage_path).data.publicUrl,
        full: supabase.storage
          .from("recon-media")
          .getPublicUrl(m.storage_path).data.publicUrl,
      })),
    ]),
  );
  const photos = entries.flatMap((entry) => entryPhotos.get(entry.id) ?? []);

  // A verified vendor's own uploaded photos, badged and slotted between recon
  // and Google in the strip (see VendorPhotos). Public bucket, so the URLs are
  // resolved here server-side with no network call.
  const vendorPhotos =
    (isVerified &&
      (listing?.photos as { storage_path: string; thumb_path: string }[] | null)?.map(
        (p) => ({
          thumb: supabase.storage
            .from("vendor-media")
            .getPublicUrl(p.thumb_path).data.publicUrl,
          full: supabase.storage
            .from("vendor-media")
            .getPublicUrl(p.storage_path).data.publicUrl,
          badge: "Provided by vendor",
        }),
      )) ||
    [];

  // Service areas as reported by the recon on this vendor, deduped. Shown in
  // place of the map for service-region types — it explains why there is no pin
  // here, and it is real data rather than decoration, so it renders only when
  // someone has actually filled the field in.
  const serviceRegions = fixedLocation
    ? []
    : [
        ...new Set(
          entries
            .map((e) => e.service_region?.trim())
            .filter((r): r is string => !!r),
        ),
      ].slice(0, 3);

  // Full list of the vendor's filter attributes as pills — the same facets the
  // Explore filter sheet is built from. No active selection on this page, so
  // they render in importance order (see lib/filters/vendor-tags.ts).
  const tags = vendorTags(vendor.vendor_type, effectiveFilters);

  const category = CATEGORIES[vendor.vendor_type as VendorType];
  const CategoryIcon = category?.icon ?? MapPin;
  const colorHex = category?.colorHex ?? "#888780";
  const lightHex = category?.lightHex ?? "#F1EFE8";
  const textHex = category?.textHex ?? "#444441";
  const categoryLabel = category?.label ?? vendor.vendor_type;

  // The fields the client-side recon slot and cards need, and nothing more:
  // every prop of a Client Component is serialized into the page payload.
  const slotVendor = {
    id,
    slug: (vendor.slug as string | null) ?? null,
    name: vendor.name as string,
    vendor_type: vendor.vendor_type as string,
  };

  // Centroid-fallback vendors store "City, ST" as address_text; don't append
  // the city again ("Littleton, CO, Littleton").
  const addressParts = [
    vendor.address_text,
    vendor.address_text?.toLowerCase().includes((vendor.city ?? "").toLowerCase())
      ? null
      : vendor.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-6">
      {/* Header. A verified vendor's gets a soft blue wash and a blue rule —
          both stops opaque, since the header is sticky and content scrolls
          under it. */}
      <div
        className={cn(
          "sticky top-0 z-10 px-4 py-3",
          isVerified
            ? "border-b-2 border-verified-line bg-linear-to-b from-verified-wash to-background"
            : "border-b bg-background",
        )}
      >
        <div className="flex items-start gap-3">
          <BackButton />
          {/* Category icon chip */}
          <div
            className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg p-2"
            style={{ backgroundColor: lightHex, color: textHex }}
          >
            <CategoryIcon className="size-5" />
          </div>

          {/* Name + category label, with the Vendor Verification badge under
              the name when this is a paying verified vendor. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="font-display text-[1.45rem] font-semibold leading-[1.1] line-clamp-2 break-words">
              {vendor.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium" style={{ color: colorHex }}>
                {categoryLabel}
              </span>
              {isVerified && <VerifiedBadge />}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <SaveButton vendorId={vendor.id} vendorType={vendor.vendor_type} />
            <ShareButton
              vendorId={vendor.id}
              slug={vendor.slug ?? null}
              vendorType={vendor.vendor_type}
              name={vendor.name}
            />
          </div>
        </div>

        {/* Address + links */}
        <div className="mt-2 flex flex-col gap-1">
          {addressParts && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {vendor.google_place_id ? (
                // Overlay shows Google's iframe-embeddable map view (keyless
                // output=embed, matched by name+address); href keeps the
                // precise query_place_id URL for the open-in-new-tab hatch.
                <ExternalLink
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${vendor.name} ${addressParts}`,
                  )}&query_place_id=${vendor.google_place_id}`}
                  embed
                  embedSrc={`https://maps.google.com/maps?q=${encodeURIComponent(
                    `${vendor.name} ${addressParts}`,
                  )}&output=embed`}
                  overlayTitle="Google Maps"
                  track={{ kind: "maps", vendorId: vendor.id }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {addressParts}
                  <ExternalLinkIcon className="size-3.5 shrink-0" />
                </ExternalLink>
              ) : (
                addressParts
              )}
            </div>
          )}
          {(effectiveWebsite || effectiveInstagram) && (
            <div className="flex items-center gap-4">
              {effectiveWebsite && (
                // A verified vendor's own website (listing) wins over the
                // extracted one. Embeddability varies per site; checked in the
                // background via /api/embed-check — blocked sites stay new-tab.
                <ExternalLink
                  href={effectiveWebsite}
                  embed={{ vendorId: vendor.id, kind: "website" }}
                  track={{ kind: "website", vendorId: vendor.id }}
                  className="flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
                >
                  <Globe className="size-3.5 shrink-0" />
                  <span className="truncate">Visit website</span>
                </ExternalLink>
              )}
              {effectiveInstagram && (
                // Instagram blocks framing on all profile pages — always a
                // plain new-tab link (embed defaults to false).
                <ExternalLink
                  href={`https://www.instagram.com/${effectiveInstagram}`}
                  track={{ kind: "instagram", vendorId: vendor.id }}
                  className="flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
                >
                  <InstagramIcon className="size-3.5 shrink-0" />
                  <span className="truncate">Instagram</span>
                </ExternalLink>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter tags — the vendor's attributes as pills, wrapping across as many
          lines as needed. Hidden when nothing has been extracted for it. A
          verified vendor's own overrides are merged in above; when present, a
          small note credits them. */}
      {tags.length > 0 && (
        <div className="mt-4 px-4">
          <VendorTagList tags={tags} />
          {isVerified && hasOverrides && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Some details provided by the vendor
            </p>
          )}
        </div>
      )}

      {/* All photos in ONE strip — recon first, then the verified vendor's own
          uploads, then Google (badged per tile). Two stacked strips plus the map
          used to fill the whole first screen before any recon was reachable. */}
      {(photos.length > 0 || vendorPhotos.length > 0 || googlePhotos.length > 0) && (
        <div className="mt-4">
          <VendorPhotos
            vendorId={vendor.id}
            googleCount={googlePhotos.length}
            googleCredit={googleCredit}
            reconPhotos={photos}
            vendorPhotos={vendorPhotos}
          />
        </div>
      )}

      {/* Verified vendor's own listing content — intro, a CTA button, and a
          pricing block (collapsed). Below the photos, above the map, so the
          couple sees the vendor's pitch after the photos but the recon stays
          the page's job. Renders nothing unless the vendor is verified AND has
          content. Re-measure the fold once vendor photos land (deferred). */}
      {isVerified && listing && (
        <div className="mt-4 px-4">
          <VendorListingContent
            vendorId={vendor.id}
            content={{
              intro: listing.intro,
              ctaLabel: listing.cta_label,
              ctaUrl: listing.cta_url,
              pricing: (listing.pricing ?? []).map((r) => ({
                label: r.label ?? "",
                price: r.price ?? "",
                unit: r.unit ?? "",
              })),
            }}
          />
        </div>
      )}

      {/* Where it is. A fixed-location vendor gets the pin on a real map; a
          service-region vendor gets its service area in words, since its pin is
          only a base. Sits below the photos so they stay the hero, and above
          the recon so "where" is settled before "what people found out". */}
      {fixedLocation && coords && (
        <div className="mt-4">
          <VendorMapPreview
            vendorId={vendor.id}
            lng={coords.lng}
            lat={coords.lat}
            vendorType={vendor.vendor_type}
            approximate={isApproximateLocation(vendor)}
            name={vendor.name}
            addressText={addressParts || null}
            googlePlaceId={vendor.google_place_id}
          />
        </div>
      )}

      {serviceRegions.length > 0 && (
        <div className="mt-4 px-4">
          <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
            <Waypoints className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium">Service area</p>
              <p className="line-clamp-2 text-muted-foreground">
                {serviceRegions.join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recon entries section */}
      <div className="mt-5 flex flex-col gap-3 px-4">
        <p className="text-sm text-muted-foreground">
          {entries.length === 0
            ? "No recon entries yet — be the first to add one."
            : entries.length === 1
              ? "1 recon entry"
              : `${entries.length} recon entries`}
        </p>

        {/* Add recon — or "Edit my recon" for someone who already has recon
            here — at the top of the entries so it's reachable without
            scrolling past the list. Decided in the browser (ReconSlot); the
            cached HTML is the public button, the same box either way. The
            Suspense is for `useSearchParams` (the `from` the form returns to). */}
        <Suspense
          fallback={
            <AddReconLink
              vendor={slotVendor}
              colorHex={colorHex}
              selfHref={vendorPath(vendor)}
            />
          }
        >
          <ReconSlot
            vendor={slotVendor}
            colorHex={colorHex}
            entries={entries.map((e) => ({ id: e.id, author_id: e.author_id }))}
          />
        </Suspense>

        {entries.map((entry) => (
          <ReconCard
            key={entry.id}
            entry={entry}
            photos={entryPhotos.get(entry.id) ?? []}
            vendor={slotVendor}
          />
        ))}
      </div>

      {/* Acquisition: the highest-intent surface for a vendor googling
          themselves. Quiet line, tracked by source. Hidden once verified. */}
      {!isVerified && (
        <div className="mt-6 px-4 text-center">
          <VerifyBusinessLink
            source="vendor_page"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Are you the owner? Verify this business
          </VerifyBusinessLink>
        </div>
      )}

      <BrandFooter />
    </div>
  );
}
