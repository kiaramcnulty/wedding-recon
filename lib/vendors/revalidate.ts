import "server-only";

import { revalidatePath } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { vendorPath, type VendorRef } from "@/lib/vendors/slug";

/**
 * Expire one vendor page's cached render, so the next visit renders it fresh.
 *
 * The vendor page is ISR (app/(app)/vendor/[id]/page.tsx): a render is shared
 * by everyone for up to an hour. EVERY app write that changes what that page
 * shows calls this, so the person who made the change sees it at once and so
 * does everyone after them. In Next 16 `revalidatePath` (no profile) EXPIRES
 * rather than marks stale, so the next request waits for a fresh render
 * instead of being handed the old one: an author redirected to the page after
 * saving reads their own write.
 *
 * Writes that do NOT come through the app (seed and enrich scripts, the
 * reconcile writers, a moderator editing a row in the Supabase dashboard) do
 * not call this, and their changes show within the hour, when the render ages
 * out.
 *
 * One page only, by its slug URL: `revalidatePath("/vendor/[id]", "page")`
 * would expire every vendor page at once, so every crawler hit after a single
 * listing save would be a full render again. The slug is looked up when the
 * caller does not have it. Legacy uuid URLs need nothing: proxy.ts 308s them
 * before the page runs.
 *
 * Callable only from a Server Action or Route Handler (the same rule as
 * `revalidatePath`). Never throws: a failed slug lookup falls back to the id
 * path, and a page that misses its expiry still refreshes within the hour.
 */
export async function revalidateVendorPage(vendor: VendorRef): Promise<void> {
  let slug = vendor.slug ?? null;
  if (!slug) {
    try {
      const { data } = await createPublicClient()
        .from("vendors")
        .select("slug")
        .eq("id", vendor.id)
        .maybeSingle();
      slug = (data as { slug?: string | null } | null)?.slug ?? null;
    } catch {
      // fall through to the id path
    }
  }
  revalidatePath(vendorPath({ id: vendor.id, slug }));
}
