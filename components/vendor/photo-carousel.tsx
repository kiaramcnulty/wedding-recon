"use client";

interface PhotoCarouselProps {
  imageUrls: string[];
}

export function PhotoCarousel({ imageUrls }: PhotoCarouselProps) {
  if (imageUrls.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-4 pb-2 scroll-smooth"
      style={{ scrollbarWidth: "none" }}
    >
      {imageUrls.map((url, i) => (
        <div
          key={url + i}
          className="snap-start shrink-0 rounded-xl overflow-hidden w-[200px] h-[150px] ring-1 ring-foreground/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Vendor photo ${i + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
