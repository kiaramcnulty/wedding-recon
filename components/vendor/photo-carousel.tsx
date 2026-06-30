"use client";

import { PhotoLightbox, type LightboxPhoto } from "@/components/vendor/photo-lightbox";

interface PhotoCarouselProps {
  photos: LightboxPhoto[];
}

export function PhotoCarousel({ photos }: PhotoCarouselProps) {
  if (photos.length === 0) return null;

  return (
    <PhotoLightbox
      photos={photos}
      alt="Vendor photo"
      containerClassName="flex gap-2 overflow-x-auto snap-x snap-mandatory px-4 pb-2 scroll-smooth"
      containerStyle={{ scrollbarWidth: "none" }}
      tileClassName="snap-start w-[200px] h-[150px] rounded-xl ring-1 ring-foreground/10"
    />
  );
}
