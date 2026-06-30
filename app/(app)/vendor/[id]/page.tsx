import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, PlusCircle, ExternalLink, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import type { ReconEntryWithDetails } from "@/lib/types";
import { PhotoCarousel } from "@/components/vendor/photo-carousel";
import { ReconCard } from "@/components/vendor/recon-card";
import { SaveButton } from "@/components/vendor/save-button";
import { ShareButton } from "@/components/vendor/share-button";
import { BackButton } from "@/components/vendor/back-button";
import { BrandFooter } from "@/components/brand-lockup";

interface VendorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VendorPage({
  params,
  searchParams,
}: VendorPageProps) {
  const { id } = await params;

  // Where to send the back button: when navigated from another page (e.g. the
  // Planning Hub) a `from` return path is passed. Restrict to internal paths.
  // If absent, BackButton falls back to browser history (router.back()).
  const { from } = await searchParams;
  const backHref =
    typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
      ? from
      : null;

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

  // Check if the current user already has recon for this vendor
  const { data: { user } } = await supabase.auth.getUser();
  let userHasRecon = false;
  if (user) {
    const { data: existing } = await supabase
      .from("recon_entries")
      .select("id")
      .eq("vendor_id", id)
      .eq("author_id", user.id)
      .neq("status", "removed")
      .limit(1)
      .maybeSingle();
    userHasRecon = !!existing;
  }

  // Fetch active recon entries with author + media
  const { data: rawEntries } = await supabase
    .from("recon_entries")
    .select("*, author:profiles(username), media:recon_media(*)")
    .eq("vendor_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const rawList = (rawEntries ?? []) as ReconEntryWithDetails[];

  // Surface the current user's own entry first. sort() is stable, so entries
  // keep their created_at (newest-first) order within the "mine" / "others"
  // groups.
  const entries = user
    ? [...rawList].sort((a, b) => {
        const aMine = a.author_id === user.id ? 0 : 1;
        const bMine = b.author_id === user.id ? 0 : 1;
        return aMine - bMine;
      })
    : rawList;

  // Media for the carousel: thumbnails inline, full opened in the lightbox so
  // the carousel itself stays cheap on egress.
  const photos = entries.flatMap((entry) =>
    entry.media.map((m) => ({
      thumb: supabase.storage
        .from("recon-media")
        .getPublicUrl(m.thumb_path ?? m.storage_path).data.publicUrl,
      full: supabase.storage
        .from("recon-media")
        .getPublicUrl(m.storage_path).data.publicUrl,
    })),
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
    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-start gap-3">
          <BackButton from={backHref} />
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

        {/* Address + links */}
        <div className="mt-2 flex flex-col gap-1">
          {addressParts && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {vendor.google_place_id ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${vendor.name} ${addressParts}`,
                  )}&query_place_id=${vendor.google_place_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {addressParts}
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              ) : (
                addressParts
              )}
            </div>
          )}
          {vendor.website && (
            <a
              href={vendor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="truncate">Visit website</span>
            </a>
          )}
        </div>
      </div>

      {/* Photo carousel */}
      {photos.length > 0 && (
        <div className="mt-4">
          <PhotoCarousel photos={photos} />
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
          <ReconCard
            key={entry.id}
            entry={entry}
            isMine={!!user && entry.author_id === user.id}
          />
        ))}
      </div>

      {/* Add recon CTA — hidden once the user has already contributed */}
      {!userHasRecon && (
        <div className="mt-6 px-4">
          <Link
            href={`/add?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendor.name)}&vendorType=${vendor.vendor_type}&from=${encodeURIComponent(`/vendor/${vendor.id}`)}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <PlusCircle className="size-4" />
            Add recon
          </Link>
        </div>
      )}

      <BrandFooter />
    </div>
  );
}
