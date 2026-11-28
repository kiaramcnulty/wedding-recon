import type { SupabaseClient } from "@supabase/supabase-js";

import { compressImage } from "@/lib/image-compress";
import { MEDIUM } from "@/lib/recon-upload";

/** Storage paths for one uploaded vendor photo: full-size, medium and thumbnail. */
export interface VendorMediaUpload {
  storagePath: string;
  thumbPath: string;
  mediumPath: string;
}

const FULL = { maxDim: 1600, quality: 0.8 };
const THUMB = { maxDim: 400, quality: 0.7 };
const BUCKET = "vendor-media";

/**
 * Compress each photo to a full-size + thumbnail JPEG and upload both straight
 * from the browser to the vendor-media bucket — never through a Server Action
 * body. Mirrors uploadReconImages, but the path is namespaced
 * `<vendorId>/<userId>/<submission>/…` so the bucket RLS (migration 0047) can
 * require an approved claim on that vendor for the write. Returns the stored
 * paths so the caller can record them on vendor_listings.photos.
 */
export async function uploadVendorImages(
  supabase: SupabaseClient,
  vendorId: string,
  userId: string,
  files: File[],
): Promise<VendorMediaUpload[]> {
  const submissionId = crypto.randomUUID();

  return Promise.all(
    files.map(async (file, i): Promise<VendorMediaUpload> => {
      const [full, medium, thumb] = await Promise.all([
        compressImage(file, FULL),
        compressImage(file, MEDIUM),
        compressImage(file, THUMB),
      ]);

      const storagePath = `${vendorId}/${userId}/${submissionId}/${i}-full.jpg`;
      const mediumPath = `${vendorId}/${userId}/${submissionId}/${i}-medium.jpg`;
      const thumbPath = `${vendorId}/${userId}/${submissionId}/${i}-thumb.jpg`;

      const put = (p: string, body: Blob) =>
        supabase.storage
          .from(BUCKET)
          .upload(p, body, { contentType: "image/jpeg", upsert: false });

      const results = await Promise.all([
        put(storagePath, full),
        put(mediumPath, medium),
        put(thumbPath, thumb),
      ]);
      for (const { error } of results) {
        if (error) throw new Error(`Photo upload failed: ${error.message}`);
      }

      return { storagePath, thumbPath, mediumPath };
    }),
  );
}

/** Public URL for a vendor-media object path. */
export function vendorMediaUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
