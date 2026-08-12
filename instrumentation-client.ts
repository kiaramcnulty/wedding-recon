/**
 * Client instrumentation (Next >= 15.3). Runs after the HTML loads and BEFORE
 * React hydration, on every page including the statically-prerendered landing
 * page — which is exactly why analytics init lives here and not in a provider
 * `useEffect`: it's the earliest client hook, it needs no Suspense/`useSearchParams`
 * dance, and `onRouterTransitionStart` gives us client-navigation pageviews for
 * free (no CSR-bailout risk). See docs/analytics-plan.md.
 */
import {
  capturePageview,
  initPostHog,
} from "@/lib/analytics/posthog";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_S,
  attributionFromLocation,
  serializeAttribution,
} from "@/lib/analytics/attribution";

// ── First-touch attribution ──────────────────────────────────────────────────
// Written once, the first time a visit carries a source signal (utm_* or an
// external referrer), and read back server-side at signup to stamp the profile.
// This is the authoritative funnel input — it lives in our own DB, so it can't
// be ad-blocked and doesn't depend on PostHog.

function hasCookie(name: string): boolean {
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${name}=`));
}

function writeFirstTouch(): void {
  try {
    if (hasCookie(ATTRIBUTION_COOKIE)) return; // first-touch: never overwrite
    const attr = attributionFromLocation(window.location.href, document.referrer);
    if (!attr) return;
    const value = encodeURIComponent(serializeAttribution(attr));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    // Not httpOnly (it's written here, client-side) and holds no secret — only
    // campaign provenance. Lax so it survives the top-level navigation from a
    // Reddit/FB link.
    document.cookie = `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${ATTRIBUTION_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // never block startup
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
try {
  writeFirstTouch();
  if (initPostHog()) {
    // Initial load. onRouterTransitionStart (below) covers client navigations.
    capturePageview();
  }
} catch {
  // A broken analytics init must never take the app down with it.
}

/**
 * Fires at the start of every client-side navigation. `url` is the destination;
 * we resolve it to an absolute URL so the pageview records the page being
 * entered, not the one being left.
 */
export function onRouterTransitionStart(url: string): void {
  try {
    const abs = new URL(url, window.location.origin).href;
    capturePageview(abs);
  } catch {
    // ignore
  }
}
