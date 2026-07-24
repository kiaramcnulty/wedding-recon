import {
  Building2,
  UtensilsCrossed,
  Music,
  Disc3,
  Flower2,
  Shirt,
  ClipboardList,
  Camera,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export const VENDOR_TYPES = [
  "venue",
  "food",
  "dj",
  "band",
  "flowers",
  "dress",
  "planner",
  "photos",
  "other",
] as const;

/**
 * Legacy vendor-type values that still exist in the DB enum but are no longer
 * offered anywhere in the UI. `music` was split into `dj` + `band` ("Live
 * music") — see migrations 0019/0020. Kept here (and given a CATEGORIES entry
 * below) so any straggler `music` row still renders its icon/color/label
 * instead of crashing a `CATEGORIES[...]` lookup; deliberately excluded from
 * VENDOR_TYPES so it never appears in the type picker, Explore filter, or Hub.
 */
export const LEGACY_VENDOR_TYPES = ["music"] as const;

export type VendorType =
  | (typeof VENDOR_TYPES)[number]
  | (typeof LEGACY_VENDOR_TYPES)[number];

/**
 * Every valid `vendor_type` enum value, selectable + legacy. Use this to
 * validate data that may reference a retired type (e.g. an existing vendor's
 * canonical type arriving from the DB). UI that offers a *choice* — the type
 * picker, Explore filter, Hub — uses VENDOR_TYPES (selectable only) instead.
 */
export const ALL_VENDOR_TYPES = [
  ...VENDOR_TYPES,
  ...LEGACY_VENDOR_TYPES,
] as const;

export interface CategoryMeta {
  type: VendorType;
  label: string;
  icon: LucideIcon;
  /** Strong fill used for map markers and active states. */
  colorHex: string;
  /** Dark text color for use on the light background. */
  textHex: string;
  /** Light background for pills/chips. */
  lightHex: string;
}

/**
 * Single source of truth for vendor categories. The same icon + color pairing
 * is reused across map pins, type chips, accordion headers, and recon tags.
 */
export const CATEGORIES: Record<VendorType, CategoryMeta> = {
  venue: { type: "venue", label: "Venue", icon: Building2, colorHex: "#1D9E75", textHex: "#085041", lightHex: "#E1F5EE" },
  food: { type: "food", label: "Food", icon: UtensilsCrossed, colorHex: "#BA7517", textHex: "#633806", lightHex: "#FAEEDA" },
  // DJs — DJ-led acts. New carve-out from Music, so it gets its own (violet) hue
  // + turntable icon to read distinctly from the Live-music pins beside it.
  dj: { type: "dj", label: "DJs", icon: Disc3, colorHex: "#8B41C4", textHex: "#5C2A85", lightHex: "#F3E9FB" },
  // "Live music" — ALL live performers (bands, string quartets, soloists,
  // pianists, ceremony ensembles), as opposed to DJs. Inherits the old Music
  // palette + note icon: it's the majority successor to Music, so its pins look
  // unchanged for existing users.
  band: { type: "band", label: "Live music", icon: Music, colorHex: "#534AB7", textHex: "#3C3489", lightHex: "#EEEDFE" },
  flowers: { type: "flowers", label: "Flowers", icon: Flower2, colorHex: "#D4537E", textHex: "#72243E", lightHex: "#FBEAF0" },
  dress: { type: "dress", label: "Dress", icon: Shirt, colorHex: "#D85A30", textHex: "#712B13", lightHex: "#FAECE7" },
  planner: { type: "planner", label: "Planner", icon: ClipboardList, colorHex: "#639922", textHex: "#27500A", lightHex: "#EAF3DE" },
  photos: { type: "photos", label: "Photos", icon: Camera, colorHex: "#378ADD", textHex: "#0C447C", lightHex: "#E6F1FB" },
  other: { type: "other", label: "Other", icon: MapPin, colorHex: "#888780", textHex: "#444441", lightHex: "#F1EFE8" },
  // Legacy — split into dj + band (see LEGACY_VENDOR_TYPES). Retained ONLY so a
  // straggler `music` row still renders; never surfaced in pickers/filters/hub.
  music: { type: "music", label: "Music", icon: Music, colorHex: "#534AB7", textHex: "#3C3489", lightHex: "#EEEDFE" },
};

export const CATEGORY_LIST: CategoryMeta[] = VENDOR_TYPES.map((t) => CATEGORIES[t]);

/**
 * Human plural nouns per vendor type, for counting headers (e.g. "12
 * photographers available"). CategoryMeta.label is a UI category name
 * ("Photos", "Music") that doesn't pluralize as a noun — use this when the copy
 * counts vendors of a type.
 */
export const CATEGORY_PLURAL: Record<VendorType, string> = {
  venue: "venues",
  food: "caterers",
  dj: "DJs",
  band: "musicians",
  flowers: "florists",
  dress: "dress shops",
  planner: "planners",
  photos: "photographers",
  other: "vendors",
  music: "musicians", // legacy — see LEGACY_VENDOR_TYPES
};

export const RECON_TYPES = ["online", "virtual", "in_person"] as const;
export type ReconType = (typeof RECON_TYPES)[number];

export const RECON_TYPE_LABELS: Record<ReconType, string> = {
  online: "Online research",
  virtual: "Virtual call",
  in_person: "In person",
};
