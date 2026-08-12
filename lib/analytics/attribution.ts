/**
 * First-touch marketing attribution.
 *
 * Captured in the browser on the very first visit that carries a source signal
 * (a `utm_*` param or an external referrer), stashed in a first-party cookie,
 * and read back server-side at signup to stamp the `profiles` row. That makes
 * the whole funnel — source -> account -> recon — answerable directly off
 * Supabase (and therefore in Hex), with **no** dependency on PostHog and no
 * exposure to ad-blockers. PostHog is the secondary, behavioral layer; this is
 * the authoritative one.
 *
 * This module is deliberately DOM-free and framework-free so it can be imported
 * from both the browser (instrumentation-client.ts) and a Server Action. The
 * cookie is read/written with `document.cookie` on the client and `cookies()`
 * on the server by the callers, never here.
 */

/** First-party cookie holding the serialized first-touch record. */
export const ATTRIBUTION_COOKIE = "wr_attribution";

/** First-touch is kept ~90 days: long enough to cover a "saw the Reddit post,
 *  signed up a month later" gap, short enough not to linger indefinitely. */
export const ATTRIBUTION_MAX_AGE_S = 90 * 24 * 60 * 60;

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** Referrer HOST only (e.g. "www.reddit.com") — never the full URL, whose
   *  query string can carry PII. */
  referrer_host?: string;
  /** Path the visitor first landed on (no query string). */
  landing_path?: string;
}

/** All persisted keys, in one place so parse/stamp stay in lockstep. */
export const ATTRIBUTION_KEYS = [
  ...UTM_KEYS,
  "referrer_host",
  "landing_path",
] as const satisfies readonly (keyof Attribution)[];

// Cap every stored string so a hand-crafted link cannot bloat the cookie or the
// DB column.
const MAX_LEN = 200;

function clean(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim().slice(0, MAX_LEN);
  return t.length > 0 ? t : undefined;
}

/**
 * External referrer host, or undefined for a same-site / direct / empty
 * referrer. `selfHost` is the current page's host, used to drop internal
 * navigations (which is what makes this "first-touch from OUTSIDE").
 */
export function referrerHost(
  referrer: string | null | undefined,
  selfHost: string,
): string | undefined {
  const r = clean(referrer);
  if (!r) return undefined;
  try {
    const host = new URL(r).host;
    if (!host || host === selfHost) return undefined;
    return host.slice(0, MAX_LEN);
  } catch {
    return undefined;
  }
}

/**
 * Build a first-touch record from a full URL + `document.referrer`. Returns
 * null when there is nothing worth recording — no `utm_*` and no external
 * referrer — so a plain direct/organic visit writes no cookie (it reads as
 * "direct" later by its absence, which is correct).
 */
export function attributionFromLocation(
  url: string,
  referrer: string | null | undefined,
): Attribution | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const attr: Attribution = {};
  for (const k of UTM_KEYS) {
    const val = clean(u.searchParams.get(k));
    if (val) attr[k] = val;
  }
  const refHost = referrerHost(referrer, u.host);
  if (refHost) attr.referrer_host = refHost;

  const hasSignal = UTM_KEYS.some((k) => attr[k] !== undefined) || attr.referrer_host;
  if (!hasSignal) return null;

  attr.landing_path = clean(u.pathname) ?? "/";
  return attr;
}

export function serializeAttribution(a: Attribution): string {
  return JSON.stringify(a);
}

/** Parse a stored cookie value back into an Attribution, tolerating garbage. */
export function parseAttribution(
  raw: string | null | undefined,
): Attribution | null {
  if (!raw) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;

  const a: Attribution = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = obj[k];
    if (typeof v === "string") {
      const c = clean(v);
      if (c) a[k as UtmKey | "referrer_host" | "landing_path"] = c;
    }
  }
  return Object.keys(a).length > 0 ? a : null;
}
