"use client";

import { PhotoLightbox, type LightboxPhoto } from "@/components/vendor/photo-lightbox";

/**
 * Every photo on a vendor page, in ONE horizontal strip.
 *
 * It used to be two stacked strips — Google Places photos, then a separate
 * carousel of the ones couples uploaded with their recon — kept apart so
 * community snaps never read as official marketing. They rendered identical
 * tiles, though, so the split was invisible: it just looked like two rows of the
 * same thing, and together with the map it ate the whole first screen before any
 * recon was reachable (Kiara, 2026-08-04). Provenance is now carried per-tile by
 * a "Google" chip, which is a clearer signal than a row break ever was, and it
 * buys back ~170px.
 *
 * Recon photos lead. They are the differentiated content — evidence a real
 * couple actually went — and most vendors have none, so on the common page this
 * is identical to leading with Google.
 *
 * One strip also means one lightbox sequence: opening any photo now pages
 * through all of them instead of stopping at the row boundary.
 */
interface VendorPhotosProps {
  vendorId: string;
  /** How many Google photos were resolved server-side. */
  googleCount: number;
  /** Combined Google author attribution (may be null). */
  googleCredit: string | null;
  /** Photos attached to this vendor's recon entries. */
  reconPhotos: LightboxPhoto[];
}

export function VendorPhotos({
  vendorId,
  googleCount,
  googleCredit,
  reconPhotos,
}: VendorPhotosProps) {
  // Tiles are 150x112 CSS, so w=600 still covers a 3x screen (450px); the 1200px
  // variant is fetched only when a photo is opened. `defer` holds each billed
  // Google tile's fetch until it is scrolled into view — and Google photos sort
  // AFTER recon photos, so on a vendor with recon photos the Google tile starts
  // off-screen and costs nothing unless the couple actually scrolls to it.
  const googlePhotos: LightboxPhoto[] = Array.from(
    { length: googleCount },
    (_, i) => ({
      thumb: `/api/vendor-photo/${vendorId}?i=${i}&w=600`,
      full: `/api/vendor-photo/${vendorId}?i=${i}&w=1200`,
      badge: "Google",
      defer: true,
    }),
  );

  const photos = [...reconPhotos, ...googlePhotos];
  if (photos.length === 0) return null;

  return (
    <div>
      <PhotoLightbox
        photos={photos}
        alt="Vendor photo"
        // scroll-px-4 matches the px-4 gutter: without it snap-mandatory aligns
        // the first tile to the container edge and scrolls the padding away, so
        // the strip bleeds to the screen edge while the rest of the page keeps
        // its 16px margin. (Same reason the map preview card uses scroll-pl-2.)
        containerClassName="flex gap-2 overflow-x-auto snap-x snap-mandatory px-4 scroll-px-4 pb-2 scroll-smooth"
        containerStyle={{ scrollbarWidth: "none" }}
        tileClassName="snap-start w-[150px] h-[112px] rounded-xl ring-1 ring-foreground/10"
      />
      {googleCount > 0 && (
        // Google's terms require showing the attributions returned with a photo.
        // Worded to credit the badged tiles specifically, since the strip now
        // also holds photos that are not theirs.
        <p className="px-4 pt-1 text-[11px] text-muted-foreground">
          {googleCredit ? `Google photos · ${googleCredit}` : "Photos via Google"}
        </p>
      )}
    </div>
  );
}
