/**
 * Client-side PostHog surface.
 *
 * Init happens once in `instrumentation-client.ts` (before hydration, the Next
 * 16 idiom) via `initPostHog()`. Everything else in the browser goes through the
 * typed helpers here so event names/props stay consistent and there is a single
 * no-op guard: with no `NEXT_PUBLIC_POSTHOG_KEY` we never init, `ready` stays
 * false, and every call is a silent no-op (dev without a key sends nothing).
 *
 * The two CONVERSION events (`signup_completed`, `recon_saved`) are fired
 * SERVER-side instead — see `lib/analytics/posthog-server.ts` — because both
 * success paths end in a server `redirect()`, so there is no client "success"
 * moment to hook, and server events cannot be ad-blocked.
 */
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let ready = false;

/** Initialize PostHog. Safe to call more than once; no-ops without a key. */
export function initPostHog(): boolean {
  if (ready) return true;
  if (typeof window === "undefined" || !POSTHOG_KEY) return false;

  posthog.init(POSTHOG_KEY, {
    // Same-origin reverse proxy (next.config.ts) so host-based ad-blockers
    // don't drop events; the toolbar/links still point at the real host.
    api_host: "/ingest",
    ui_host: POSTHOG_HOST,
    // We capture pageviews manually (initial load here + client navigations via
    // onRouterTransitionStart), so autocapture of history changes stays off.
    capture_pageview: false,
    capture_pageleave: false,
    // Only our named events + pageviews. No blanket click autocapture: it would
    // burn the free event budget and widen the privacy surface for no funnel
    // gain.
    autocapture: false,
    disable_session_recording: true,
    // Anonymous browsers stay anonymous (no person profile) until we identify
    // them at sign-in — see identifyClient / the server conversion events.
    person_profiles: "identified_only",
  });
  ready = true;
  return true;
}

/** Capture a pageview. `url` is the destination for a client navigation; on the
 *  initial load it's omitted and PostHog reads `window.location`. */
export function capturePageview(url?: string): void {
  if (!ready) return;
  try {
    posthog.capture("$pageview", url ? { $current_url: url } : undefined);
  } catch {
    // Analytics must never break navigation.
  }
}

/** Merge the current anonymous browsing session into the signed-in account.
 *  Idempotent: no-ops if already identified as this user. */
export function identifyClient(userId: string): void {
  if (!ready || !userId) return;
  try {
    if (posthog.get_distinct_id() === userId) return;
    posthog.identify(userId);
  } catch {
    // ignore
  }
}

/** Reset identity on sign-out so the next user isn't merged into this account. */
export function resetClient(): void {
  if (!ready) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}

/** The feeds a listing card can be shown in. */
export type ListingSurface = "explore_list" | "explore_cluster" | "start_list";
/** The maps whose pins open a peek card. */
export type PeekSurface = "explore_peek" | "start_peek";

/**
 * Listings already reported as seen on a surface. Module-level so it survives
 * client navigation: going to a vendor page and back re-mounts the feed, and
 * counting the same cards again on every round trip would make heavy browsers
 * look like more exposure. A full reload starts it over.
 */
const seenListings = new Set<string>();

/** `vendor_impression`, deduped to once per listing per surface per page load. */
export function captureImpression(
  properties: ClientEvents["vendor_impression"],
): void {
  const key = `${properties.surface}:${properties.vendor_id}`;
  if (seenListings.has(key)) return;
  seenListings.add(key);
  captureClient("vendor_impression", properties);
}

/**
 * The client-side engagement events and their property shapes. Conversions
 * are intentionally absent — they live server-side.
 */
type ClientEvents = {
  vendor_saved: { vendor_type: string };
  share_clicked: { vendor_id: string };
  vendor_link_out: { kind: "website" | "instagram" | "maps"; vendor_id: string };
  /** A couple/vendor clicked a "verify your business" acquisition link. */
  vendor_verify_link_clicked: {
    source: "vendor_page" | "landing_footer" | "profile_menu";
  };
  /** A vendor clicked a CTA on the public /for-vendors page (the step after the
   *  acquisition link, and the last one before sign-in). */
  vendor_portal_cta_clicked: { placement: "hero" | "closing" | "signin" };
  /** A couple clicked a verified vendor's CTA button on the vendor page. */
  vendor_cta_clicked: { vendor_id: string; cta_label: string };
  /**
   * A listing card was actually SEEN in a feed (at least half on screen), at
   * most once per listing per surface per page load. The denominator for
   * "does verification earn more attention": a verified vendor sorts first
   * (`lib/map/rank.ts`), and before this event that only showed up as page
   * views, which are downstream of it. `position` is 0-based in the feed.
   */
  vendor_impression: {
    vendor_id: string;
    vendor_type: string;
    surface: ListingSurface;
    position: number;
    verified: boolean;
  };
  /** A map pin was tapped and its peek card shown (the map impression). */
  vendor_peek_opened: {
    vendor_id: string;
    vendor_type: string;
    surface: PeekSurface;
    verified: boolean;
  };
  /**
   * A feed or peek card was tapped through to the vendor page. The pageview
   * that follows cannot tell list from map (both carry the same `from`), so
   * this is what pairs with the two events above into a click-through rate.
   */
  vendor_card_clicked: {
    vendor_id: string;
    vendor_type: string;
    surface: ListingSurface | PeekSurface;
    position: number | null;
    verified: boolean;
  };
  /** Real browser arrival from a Muse connector result; separate from first-touch. */
  muse_arrival: { landing_path: string; campaign: string | null };
  /** Guided journey (/start): a screen was reached. Coarse on purpose, no location. */
  journey_step: { step: string; vendor_type: string | null; resumed: boolean };
  /** Guided journey: a result set was shown. Counts and radius only. */
  journey_results: {
    vendor_type: string;
    confirmed: number;
    partial: number;
    radius_miles: number;
    expanded: boolean;
  };
};

export function captureClient<E extends keyof ClientEvents>(
  event: E,
  properties: ClientEvents[E],
): void {
  if (!ready) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break a user action.
  }
}
