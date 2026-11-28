import type { SupabaseClient } from "@supabase/supabase-js";

import { compressImage } from "@/lib/image-compress";

/** Storage paths for one uploaded photo: full-size, medium and thumbnail. */
export interface ReconMediaUpload {
  path: string;
  thumbPath: string;
  mediumPath: string;
}

// Full-size: the lightbox, opened on tap, without storing originals.
const FULL = { maxDim: 1600, quality: 0.8 };
// Medium: the vendor-page photo strip (240px tall tiles). About twice the
// thumbnail's bytes, a tenth of the full (migration 0053).
export const MEDIUM = { maxDim: 600, quality: 0.72 };
// Thumbnail: list/card previews; tiny so they barely touch egress.
const THUMB = { maxDim: 400, quality: 0.7 };

const BUCKET = "recon-media";

/**
 * Compress each photo to a full-size + thumbnail JPEG and upload both straight
 * from the browser to Supabase Storage — never through the createRecon Server
 * Action body (that's the 1 MB / Vercel 4.5 MB limit we're sidestepping).
 * Returns the stored paths so the caller can record them on recon_media.
 *
 * Uploads land under `${userId}/<submission>/…`; the existing bucket RLS lets
 * any authenticated user insert, and Supabase stamps `owner = auth.uid()` so
 * the owner-only update/delete policies still apply.
 */
export async function uploadReconImages(
  supabase: SupabaseClient,
  userId: string,
  files: File[],
): Promise<ReconMediaUpload[]> {
  const submissionId = crypto.randomUUID();

  return Promise.all(
    files.map(async (file, i): Promise<ReconMediaUpload> => {
      const [full, medium, thumb] = await Promise.all([
        compressImage(file, FULL),
        compressImage(file, MEDIUM),
        compressImage(file, THUMB),
      ]);

      const path = `${userId}/${submissionId}/${i}-full.jpg`;
      const mediumPath = `${userId}/${submissionId}/${i}-medium.jpg`;
      const thumbPath = `${userId}/${submissionId}/${i}-thumb.jpg`;

      const put = (p: string, body: Blob) =>
        supabase.storage
          .from(BUCKET)
          .upload(p, body, { contentType: "image/jpeg", upsert: false });

      const results = await Promise.all([
        put(path, full),
        put(mediumPath, medium),
        put(thumbPath, thumb),
      ]);
      for (const { error } of results) {
        if (error) throw new Error(`Photo upload failed: ${error.message}`);
      }

      return { path, thumbPath, mediumPath };
    }),
  );
}
