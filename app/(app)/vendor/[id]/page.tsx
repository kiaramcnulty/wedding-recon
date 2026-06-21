import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import type { ReconEntryWithDetails } from "@/lib/types";
import { PhotoCarousel } from "@/components/vendor/photo-carousel";
import { ReconCard } from "@/components/vendor/recon-card";
import { SaveButton } from "@/components/vendor/save-button";
import { ShareButton } from "@/components/vendor/share-button";

interface VendorPageProps {
  params: Promise<{ id: string }>;
}

export default async function VendorPage({ params }: VendorPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch vendor
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .single();

  if (vendorError || !vendor) {
    notFound();
  }

  // Fetch active recon entries with author + media
  const { data: rawEntries } = await supabase
    .from("recon_entries")
    .select("*, author:profiles(username), media:recon_media(*)")
    .eq("vendor_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const entries = (rawEntries ?? []) as ReconEntryWithDetails[];

  // Collect all media public URLs for the carousel
  const allImageUrls = entries.flatMap((entry) =>
    entry.media.map(
      (m) =>
        supabase.storage.from("recon-media").getPublicUrl(m.storage_path).data
          .publicUrl,
    ),
  );

  const category = CATEGORIES[vendor.vendor_type as VendorType];
  const CategoryIcon = category?.icon ?? MapPin;
  const colorHex = category?.colorHex ?? "#888780";
  const lightHex = category?.lightHex ?? "#F1EFE8";
  const textHex = category?.textHex ?? "#444441";
  const categoryLabel = category?.label ?? vendor.vendor_type;

  const addressParts = [vendor.address_text, vendor.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Category icon chip */}
          <div
            className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg p-2"
            style={{ backgroundColor: lightHex, color: textHex }}
          >
            <CategoryIcon className="size-5" />
          </div>

          {/* Name + category label */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="font-heading text-lg font-semibold leading-tight truncate">
              {vendor.name}
            </h1>
            <span className="text-xs font-medium" style={{ color: colorHex }}>
              {categoryLabel}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <SaveButton vendorId={vendor.id} />
            <ShareButton
              vendorId={vendor.id}
              vendorType={vendor.vendor_type}
              name={vendor.name}
            />
          </div>
        </div>

        {/* Address */}
        {addressParts && (
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {addressParts}
          </p>
        )}
      </div>

      {/* Photo carousel */}
      {allImageUrls.length > 0 && (
        <div className="mt-4">
          <PhotoCarousel imageUrls={allImageUrls} />
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

        {entries.map((entry) => (
          <ReconCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
