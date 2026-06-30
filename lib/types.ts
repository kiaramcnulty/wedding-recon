import type { VendorType, ReconType } from "@/lib/constants/categories";

export type VendorSource = "google" | "user" | "seed";
export type ReconStatus = "active" | "flagged" | "removed";
export type ReportStatus = "open" | "reviewed" | "dismissed";

export interface Profile {
  id: string;
  username: string;
  created_at: string;
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
  /** GeoJSON-style longitude/latitude, surfaced by the vendors_in_bbox RPC. */
  lng: number | null;
  lat: number | null;
  source: VendorSource;
  created_by: string | null;
  created_at: string;
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
  author: Pick<Profile, "username">;
  media: ReconMedia[];
}
