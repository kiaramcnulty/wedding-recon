"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxPhoto {
  /** Small variant shown inline in the strip. */
  thumb: string;
  /** Full-size variant, fetched only when the photo is opened. */
  full: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  alt?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  tileClassName?: string;
}

/**
 * A strip of photo thumbnails that open full-size in a tap-to-close overlay.
 * Thumbnails use the small variant; the full image is fetched only when a photo
 * is actually opened, so default page egress is unchanged (the lightbox adds no
 * baseline cost).
 */
export function PhotoLightbox({
  photos,
  alt = "Photo",
  containerClassName,
  containerStyle,
  tileClassName,
}: PhotoLightboxProps) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // Portals need the DOM; defer the mount flag (see CLAUDE.md portal pattern).
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className={containerClassName} style={containerStyle}>
        {photos.map((p, i) => (
          <button
            key={p.full + i}
            type="button"
            onClick={() => setOpenIdx(i)}
            aria-label={`Open ${alt.toLowerCase()} ${i + 1}`}
            className={cn("block shrink-0 cursor-zoom-in overflow-hidden", tileClassName)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumb}
              alt={`${alt} ${i + 1}`}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {mounted &&
        openIdx !== null &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${alt} ${openIdx + 1}`}
            onClick={() => setOpenIdx(null)}
            className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpenIdx(null)}
              className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[openIdx].full}
              alt={`${alt} ${openIdx + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full cursor-default rounded-lg object-contain"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
