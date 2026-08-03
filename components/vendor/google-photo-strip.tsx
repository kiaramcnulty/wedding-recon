"use client";

import { PhotoLightbox } from "@/components/vendor/photo-lightbox";

interface GooglePhotoStripProps {
  vendorId: string;
  /** How many tiles to render — the photo count already resolved server-side. */
  count: number;
  /** Combined author attribution shown beside the Google credit (may be null). */
  credit: string | null;
}

/**
 * Venue photos sourced from Google Places, shown as a strip that opens full-size
 * in the shared lightbox. Each tile points at /api/vendor-photo, which resolves
 * the vendor's cached photo reference to bytes on demand (bytes are never stored
 * — CDN-cached instead). Kept visually distinct from the community recon carousel
 * and carries the Google attribution Google's terms require.
 */
export function GooglePhotoStrip({ vendorId, count, credit }: GooglePhotoStripProps) {
  if (count <= 0) return null;

  // Strip tiles are 200x150 CSS, so w=600 covers a 3x screen; the 1200px
  // variant is fetched only when a photo is opened in the lightbox. Both are
  // CDN-cached separately, and the full size is never on the page's baseline.
  const photos = Array.from({ length: count }, (_, i) => ({
    thumb: `/api/vendor-photo/${vendorId}?i=${i}&w=600`,
    full: `/api/vendor-photo/${vendorId}?i=${i}&w=1200`,
  }));

  return (
    <div>
      <PhotoLightbox
        photos={photos}
        alt="Venue photo"
        containerClassName="flex gap-2 overflow-x-auto snap-x snap-mandatory px-4 pb-2 scroll-smooth"
        containerStyle={{ scrollbarWidth: "none" }}
        tileClassName="snap-start w-[200px] h-[150px] rounded-xl ring-1 ring-foreground/10"
      />
      <p className="px-4 pt-1 text-[11px] text-muted-foreground">
        {credit ? `Photos via Google · ${credit}` : "Photos via Google"}
      </p>
    </div>
  );
}
