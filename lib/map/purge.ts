import "server-only";
import { dangerouslyDeleteByTag } from "@vercel/functions";

/**
 * The Vercel CDN cache tag on every `/api/map/vendors` success response.
 *
 * The map is CDN-cached for an hour (the function-CPU budget,
 * docs/notes/function-cpu.md). That is fine for everything except a change a
 * vendor is watching for -- above all becoming verified, where the webhook is
 * server-to-server so there is no browser to mark the way `lib/map/fresh.ts`
 * marks a couple who just saved recon. Tagging the responses lets those few
 * writes drop the whole map cache at once instead.
 */
export const MAP_CACHE_TAG = "map-vendors";

/**
 * Drop every cached map response, in every region, so the NEXT request for
 * each one is rebuilt from the database (not served stale first, which is what
 * the gentler `invalidateByTag` would do -- the vendor checking for their badge
 * is usually that next request).
 *
 * "Dangerously" is Vercel's warning about a stampede of misses on a busy
 * site. Here it is about 13 requests per region, and it fires only when
 * verification or a verified listing changes -- a handful of times a month.
 * Do NOT call it on routine writes (recon saves use the per-browser cookie in
 * `lib/map/fresh.ts`): each call refills the map cache for everyone, which is
 * the CPU the hour-long cache exists to save.
 *
 * Outside a Vercel function (local dev, `next start`, scripts) the package
 * has no request context and this resolves without doing anything. Never
 * throws: a failed purge only means the map catches up within the hour, which
 * must not fail the write that already succeeded (or make Stripe retry).
 */
export async function purgeMapCache(reason: string): Promise<void> {
  try {
    await dangerouslyDeleteByTag(MAP_CACHE_TAG);
  } catch (e) {
    console.error(`[map-purge] ${reason}: purge failed`, e);
  }
}
