/**
 * Client-side image compression. Recon photos are reference shots, not archival
 * originals, so we downscale + re-encode to JPEG before upload. This keeps each
 * stored photo at ~200-400 KB (vs multi-MB originals) — the single biggest
 * lever on Supabase Storage + egress cost — and keeps uploads far below any
 * file-size limit.
 *
 * Browser-only (uses <img> + canvas); import from Client Components only.
 */

export interface CompressOptions {
  /** Longest-edge cap in px; the image is scaled down to fit (never up). */
  maxDim: number;
  /** JPEG quality, 0–1. */
  quality: number;
}

/**
 * Load a File into an <img>. Modern browsers apply EXIF orientation to <img>
 * rendering by default, so drawing it to a canvas yields a correctly-rotated
 * result without manual EXIF parsing.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/** Downscale + re-encode an image File to a JPEG Blob. */
export async function compressImage(
  file: File,
  { maxDim, quality }: CompressOptions,
): Promise<Blob> {
  const img = await loadImage(file);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Image compression failed");
  return blob;
}
