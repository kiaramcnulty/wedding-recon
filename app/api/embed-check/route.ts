import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/embed-check?vendorId=<uuid>&kind=website
 *   -> { embeddable: boolean }
 *
 * Whether the vendor's external destination allows being shown in an iframe
 * (X-Frame-Options / CSP frame-ancestors). The browser hides these headers
 * from cross-origin JS, so the check has to happen server-side. The URL is
 * looked up from the vendors row — clients never pass a raw URL, so the
 * endpoint can't be used to probe arbitrary (e.g. internal) hosts.
 *
 * Any failure (bad URL, timeout, network error) reports `embeddable: false`:
 * the link then behaves as a plain new-tab link, which is always safe.
 */

// Which vendor column each check kind reads. Extend as link types grow.
const KIND_COLUMNS: Record<string, string> = {
  website: "website",
};

const CHECK_TIMEOUT_MS = 4000;

// Some small-business sites 403 unfamiliar user agents; a browser UA keeps
// false "not embeddable" results rare. Wrong answers only cost the overlay.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Frame-blocking check on the final (post-redirect) response headers. */
function headersAllowFraming(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.trim().toUpperCase();
  // DENY, SAMEORIGIN, or the obsolete ALLOW-FROM all exclude us.
  if (xfo && xfo !== "ALLOWALL") return false;

  const csp = headers.get("content-security-policy");
  if (csp) {
    const directive = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
    if (directive) {
      // Any frame-ancestors list that isn't a wildcard excludes third-party
      // origins like ours ('self', explicit hosts, or 'none').
      const sources = directive.split(/\s+/).slice(1);
      if (!sources.includes("*")) return false;
    }
  }
  return true;
}

async function checkUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  // HEAD first (cheap); some servers reject it (405 etc.), then retry as GET —
  // the body is cancelled unread, we only want the headers.
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(parsed, {
        method,
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      res.body?.cancel().catch(() => {});
      if (res.ok) return headersAllowFraming(res.headers);
      // Non-2xx on GET (or both): treat as unknown -> not embeddable.
    } catch {
      // Timeout / network error: fall through to the GET retry, then give up.
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const vendorId = searchParams.get("vendorId");
  const kind = searchParams.get("kind") ?? "website";
  const column = KIND_COLUMNS[kind];

  if (!vendorId || !column) {
    return NextResponse.json(
      { error: "Provide ?vendorId= and a known ?kind=" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select(column)
    .eq("id", vendorId)
    .maybeSingle();

  const url = (data as Record<string, string | null> | null)?.[column];
  const embeddable = url ? await checkUrl(url) : false;

  return NextResponse.json(
    { embeddable },
    {
      headers: {
        // Site headers change rarely; let browsers reuse for an hour and the
        // CDN for a day so repeat vendor-page visits skip the origin probe.
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
