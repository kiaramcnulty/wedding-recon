/**
 * Absolute base for canonical URLs, sitemap entries, and social image URLs.
 *
 * Social crawlers (iMessage, X, Facebook) require absolute image URLs, and a
 * sitemap must list absolute ones, so both resolve against this. Set
 * NEXT_PUBLIC_SITE_URL per environment; production is the fallback.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://weddingrecon.com";
