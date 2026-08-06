import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

import { SITE_URL } from "@/lib/site";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
      lastModified: new Date(),
    },
    { url: `${SITE_URL}/explore`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
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
    const { data, error } = await supabase
      .from("vendors")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(VENDOR_LIMIT);

    if (error || !data) return staticRoutes;

    return [
      ...staticRoutes,
      ...data.map((vendor) => ({
        url: `${SITE_URL}/vendor/${vendor.id}`,
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
