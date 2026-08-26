import type { SupabaseClient } from "@supabase/supabase-js";

import { compressImage } from "@/lib/image-compress";

/** Storage paths for one uploaded vendor photo: full-size + thumbnail. */
export interface VendorMediaUpload {
  storagePath: string;
  thumbPath: string;
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
      const [full, thumb] = await Promise.all([
        compressImage(file, FULL),
        compressImage(file, THUMB),
      ]);

      const storagePath = `${vendorId}/${userId}/${submissionId}/${i}-full.jpg`;
      const thumbPath = `${vendorId}/${userId}/${submissionId}/${i}-thumb.jpg`;

      const put = (p: string, body: Blob) =>
        supabase.storage
          .from(BUCKET)
          .upload(p, body, { contentType: "image/jpeg", upsert: false });

      const [{ error: fullErr }, { error: thumbErr }] = await Promise.all([
        put(storagePath, full),
        put(thumbPath, thumb),
      ]);
      if (fullErr) throw new Error(`Photo upload failed: ${fullErr.message}`);
      if (thumbErr) throw new Error(`Photo upload failed: ${thumbErr.message}`);

      return { storagePath, thumbPath };
    }),
  );
}

/** Public URL for a vendor-media object path. */
export function vendorMediaUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
