import {
  Building2,
  UtensilsCrossed,
  Music,
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
  "music",
  "flowers",
  "dress",
  "planner",
  "photos",
  "other",
] as const;

export type VendorType = (typeof VENDOR_TYPES)[number];

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
  music: { type: "music", label: "Music", icon: Music, colorHex: "#534AB7", textHex: "#3C3489", lightHex: "#EEEDFE" },
  flowers: { type: "flowers", label: "Flowers", icon: Flower2, colorHex: "#D4537E", textHex: "#72243E", lightHex: "#FBEAF0" },
  dress: { type: "dress", label: "Dress", icon: Shirt, colorHex: "#D85A30", textHex: "#712B13", lightHex: "#FAECE7" },
  planner: { type: "planner", label: "Planner", icon: ClipboardList, colorHex: "#639922", textHex: "#27500A", lightHex: "#EAF3DE" },
  photos: { type: "photos", label: "Photos", icon: Camera, colorHex: "#378ADD", textHex: "#0C447C", lightHex: "#E6F1FB" },
  other: { type: "other", label: "Other", icon: MapPin, colorHex: "#888780", textHex: "#444441", lightHex: "#F1EFE8" },
};

export const CATEGORY_LIST: CategoryMeta[] = VENDOR_TYPES.map((t) => CATEGORIES[t]);

export const RECON_TYPES = ["online", "virtual", "in_person"] as const;
export type ReconType = (typeof RECON_TYPES)[number];

export const RECON_TYPE_LABELS: Record<ReconType, string> = {
  online: "Online research",
  virtual: "Virtual call",
  in_person: "In person",
};
