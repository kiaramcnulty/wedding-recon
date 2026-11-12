import { NextResponse, type NextRequest } from "next/server";
import { isVendorUuid } from "@/lib/vendors/slug";

const LEGACY_PATH = /^\/vendor\/([^/]+)\/?$/;

/**
 * `/vendor/<uuid>` -> 308 to `/vendor/<slug>`, query string kept.
 *
 * Every link shared before migration 0052 is a uuid URL, and search engines
 * have them indexed. The vendor page redirects them as well, but it cannot send
 * a real 308: its `loading.tsx` boundary streams the shell first, so by the
 * time the page knows the slug the status is already 200 and Next falls back to
 * a `<meta http-equiv="refresh">`. Browsers follow that; crawlers treat it as a
 * weaker signal. Doing it here, before any HTML, gives an honest 308.
 *
 * One cookie-free anon PostgREST read, only on uuid-shaped vendor paths (slug
 * URLs never reach the lookup). Any failure — the migration not applied yet, a
 * vendor that does not exist, a network blip — returns null and the request
 * falls through to the page, which renders or 404s exactly as before.
 */
export async function legacyVendorRedirect(
  request: NextRequest,
): Promise<NextResponse | null> {
  const match = LEGACY_PATH.exec(request.nextUrl.pathname);
  if (!match || !isVendorUuid(match[1])) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/vendors?select=slug&id=eq.${match[1].toLowerCase()}`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { slug?: string | null }[];
    const slug = rows[0]?.slug;
    if (!slug) return null;

    const target = request.nextUrl.clone();
    target.pathname = `/vendor/${slug}`;
    return NextResponse.redirect(target, 308);
  } catch {
    return null;
  }
}
