import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

import { SITE_URL } from "@/lib/site";
import { vendorPath } from "@/lib/vendors/slug";

/**
 * Regenerated daily. Vendor rows change as launch/enrich runs land, and a
 * sitemap that only refreshes on deploy would lag a whole seeding campaign.
 */
export const revalidate = 86400;

/**
 * Cap on vendor URLs. Google's per-sitemap ceiling is 50k entries / 50 MB; this
 * sits well inside it. If the directory ever outgrows the cap, split with
 * Next's `generateSitemaps` rather than raising it.
 */
const VENDOR_LIMIT = 20000;

/**
 * Rows asked for per request. PostgREST caps a single response at the
 * project's max-rows setting (1000 on Supabase), and a `.limit()` above it is
 * silently clamped -- which is how this sitemap listed exactly 1,000 of ~2,300
 * vendors until 2026-11-14. So it pages, and advances by the rows actually
 * returned, so a lower server cap still pages correctly instead of stopping.
 */
const PAGE_SIZE = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
      lastModified: new Date(),
    },
    { url: `${SITE_URL}/explore`, changeFrequency: "daily", priority: 0.8 },
    // The vendor-side marketing page. Public, static, and the only vendor URL
    // worth indexing - /portal behind it is auth-gated and disallowed.
    { url: `${SITE_URL}/for-vendors`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/developers/connectors`, changeFrequency: "monthly", priority: 0.2 },
  ];

  // Vendor pages are public and each carries unique recon, so they belong in
  // the sitemap. A plain anon client is used rather than lib/supabase/server's
  // cookie-bound one: reading cookies here would force the route dynamic, and
  // there is no session to honour — public RLS serves these rows to anyone.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return staticRoutes;

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    type Row = { id: string; slug: string | null; created_at: string | null };
    const rows: Row[] = [];
    while (rows.length < VENDOR_LIMIT) {
      const from = rows.length;
      const { data, error } = await supabase
        .from("vendors")
        .select("id, slug, created_at")
        .order("created_at", { ascending: false })
        // Tie-break: a bulk launch upload inserts hundreds of rows with one
        // created_at, and offset paging over an unstable order can skip or
        // repeat rows across page boundaries.
        .order("id", { ascending: true })
        .range(from, Math.min(from + PAGE_SIZE, VENDOR_LIMIT) - 1);
      if (error || !data) {
        // First page failed: same as before, static routes only. A later page
        // failed: keep what we have -- a partial list beats dropping every
        // vendor URL until the next daily regeneration.
        if (rows.length === 0) return staticRoutes;
        console.error("[sitemap] vendor page failed at offset", from, error?.message);
        break;
      }
      rows.push(...(data as Row[]));
      if (data.length === 0) break;
    }

    // Defensive: one URL per vendor even if paging ever overlapped.
    const seen = new Set<string>();
    const vendors = rows.filter((v) => !seen.has(v.id) && !!seen.add(v.id));

    return [
      ...staticRoutes,
      ...vendors.map((vendor) => ({
        url: `${SITE_URL}${vendorPath(vendor)}`,
        lastModified: vendor.created_at ? new Date(vendor.created_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // A paused free-tier project, a network blip, or a missing table must not
    // fail the build or serve a 500 — the static routes are still a valid
    // sitemap, and the next revalidation picks the vendors back up.
    return staticRoutes;
  }
}
