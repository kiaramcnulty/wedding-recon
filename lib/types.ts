import type { VendorType, ReconType } from "@/lib/constants/categories";

export type VendorSource = "google" | "user" | "seed";
export type ReconStatus = "active" | "flagged" | "removed";
export type ReportStatus = "open" | "reviewed" | "dismissed";

export interface Profile {
  id: string;
  username: string;
  created_at: string;
  /** Internal flag for seeded/curator bot accounts (enrichvenues pipeline). */
  is_bot: boolean;
  /** Site admin — currently grants editing of bot-authored recon (migration 0041). */
  is_admin: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  vendor_type: VendorType;
  google_place_id: string | null;
  address_text: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  /** Bare Instagram handle (no @/URL). Research-sourced by the launch/enrich pipelines; rendered as a link next to the website. */
  instagram: string | null;
  /** GeoJSON-style longitude/latitude, surfaced by the vendors_in_bbox RPC. */
  lng: number | null;
  lat: number | null;
  source: VendorSource;
  created_by: string | null;
  created_at: string;
  /** Cached references (not bytes) to the venue's top ≤3 Google Places photos; null until first resolved. See lib/google-photos.ts. */
  google_photos: GooglePhotoRef[] | null;
  /** When google_photos was last resolved; rows older than ~30d are re-resolved on next view. */
  google_photos_fetched_at: string | null;
  /**
   * Extracted filter attributes, keyed per vendor type — see
   * `lib/constants/vendor-filters.ts` for the shape and
   * `docs/vendor-filter-coverage.md` for how much of it is populated.
   *
   * Absent keys mean nobody wrote the fact down, NOT that the vendor lacks the
   * thing, which is why `lib/filters/match.ts` demotes rather than excludes on
   * a missing key. The `vendors_in_bbox` RPC strips the verbatim evidence
   * quotes from this on the way out (migration 0033), so a map row carries the
   * matchable values only.
   */
  filters?: Record<string, unknown> | null;
  /**
   * Whether this vendor's pin sits on a city/region centroid rather than a
   * street address — the dashed pin outline. Computed server-side by the
   * `vendors_in_bbox` RPC (migration 0034) so the map payload can drop the
   * three columns `isApproximateLocation()` would otherwise need.
   *
   * Present only on rows from that RPC, and only once 0034 is applied; every
   * other caller leaves it undefined and uses the client-side heuristic in
   * `lib/map/vendor-location.ts`, which is its deliberate twin.
   */
  approximate?: boolean;
  /**
   * Whether this vendor has an extracted price, and whether its card will draw
   * a photo — the first two keys the Explore list view orders on, ahead of
   * distance. Both are computed server-side by `vendors_in_bbox` (migration
   * `0035`), because the sort runs over the whole viewport before the feed
   * pages it, so they cannot come from the per-card fetch.
   *
   * Undefined on rows from anywhere else, and on every row until `0035` is
   * applied. The comparator tests `=== true`, so a missing flag is false for
   * all rows alike and both keys quietly become no-ops rather than throwing the
   * order away.
   */
  has_price?: boolean;
  has_photo?: boolean;
  /**
   * Whether this vendor is a paying, verified vendor (Vendor Verification tier)
   * — the key the Explore list order sorts on immediately after `rank`, within
   * the partition. Computed server-side by `vendors_in_bbox` (migration `0045`)
   * as a set-based left join against `verified_vendor_ids()`, so the busiest
   * query pays for it once, not once per row.
   *
   * Undefined on rows from anywhere else, and on every row until `0045` is
   * applied. The comparator tests `=== true`, so a missing flag is false for
   * all rows alike and the key quietly becomes a no-op.
   *
   * Note: this drives ORDER only. The verified BADGE on preview cards comes
   * from a separate `verified_vendor_ids` RPC call in `useVendorPreviews`,
   * because that fetch is a plain table select that cannot read the deny-all
   * subscriptions table under caller RLS.
   */
  verified?: boolean;
}

/**
 * One Google Places photo reference cached on a vendor. The image bytes are
 * fetched on demand via /api/vendor-photo and CDN-cached — never stored — to
 * stay within Google's no-caching terms and off Supabase Storage.
 */
export interface GooglePhotoRef {
  /** Places photo resource name, e.g. "places/<place_id>/photos/<ref>". */
  name: string;
  /** First author attribution display name (Google requires showing it). */
  attrib: string | null;
  attribUri: string | null;
}

export interface ReconEntry {
  id: string;
  vendor_id: string;
  author_id: string;
  recon_type: ReconType;
  recon_collected_month: number;
  recon_collected_year: number;
  price_text: string | null;
  price_details: string | null;
  service_region: string | null;
  notes: string | null;
  status: ReconStatus;
  created_at: string;
}

export interface ReconMedia {
  id: string;
  recon_entry_id: string;
  storage_path: string;
  /** Small (~400px) variant for list/card previews; null on pre-thumbnail rows. */
  thumb_path: string | null;
  media_type: "image";
  created_at: string;
}

export interface SavedVendor {
  id: string;
  user_id: string;
  vendor_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  recon_entry_id: string;
  reporter_id: string;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
}

/** A recon entry joined with its author username and media, as rendered on vendor pages. */
export interface ReconEntryWithDetails extends ReconEntry {
  author: Pick<Profile, "username" | "is_bot">;
  media: ReconMedia[];
}
