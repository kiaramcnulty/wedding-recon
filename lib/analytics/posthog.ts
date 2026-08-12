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

/**
 * The three client-side engagement events and their property shapes. Conversions
 * are intentionally absent — they live server-side.
 */
type ClientEvents = {
  vendor_saved: { vendor_type: string };
  share_clicked: { vendor_id: string };
  vendor_link_out: { kind: "website" | "instagram" | "maps"; vendor_id: string };
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
