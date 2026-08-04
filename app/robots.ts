import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * Crawl rules. The landing page, Explore, vendor pages and the terms page are
 * the public surface; everything listed under `disallow` is either a personal
 * workspace (the Hub), a form, or machinery with nothing to index.
 *
 * Note `/vendor/` is deliberately NOT disallowed — those pages carry the unique
 * recon content and are the long-tail of this site's search traffic.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/add",
          "/hub",
          "/login",
          "/onboarding",
          "/recon/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
