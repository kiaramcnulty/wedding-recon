import { DAY_TYPES, filtersForType } from "@/lib/constants/vendor-filters";
import {
  GUIDED_CONTROLS,
  isGuidedType,
  type GuidedPrefs,
  type GuidedType,
} from "@/lib/search/guided";

/**
 * The guided journey's saved state: what the couple has answered, and where in
 * the flow they are. Kept in this browser (localStorage) for everyone; for a
 * signed-in couple `lib/search/journey-sync.ts` also keeps a copy on the
 * account (table `planning_contexts`, migration 0051) and brings it to their
 * other devices. Anonymous progress stays on this device only.
 *
 * Separate from the map's per-tab sessionStorage keys (`wr:mapView`,
 * `wr:vendorFilters`, ...), which restore a view across a vendor round trip.
 * This is the wedding's planning context, which outlives a tab.
 */

export const JOURNEY_STORAGE_KEY = "wr:journey";

export { JOURNEY_HREF } from "@/lib/landing/nav";

export type JourneyStep =
  | "welcome"
  | "venue"
  | "city"
  | "category"
  | "prefs"
  | "results";

export interface JourneyLocation {
  kind: "city" | "venue";
  label: string;
  lat: number;
  lng: number;
  /** The booked venue, when it is one of ours. */
  vendorId?: string;
}

export interface JourneyState {
  version: 1;
  hasVenue: boolean | null;
  location: JourneyLocation | null;
  /**
   * The last venue and the last town picked, kept apart from `location` (the
   * one in use) so switching between "search our venue" and "pick a town"
   * never throws away the other answer.
   */
  venueLocation?: JourneyLocation;
  cityLocation?: JourneyLocation;
  guestCount?: number;
  /** Optional; 1-12. Picks the season price tier. */
  weddingMonth?: number;
  weddingYear?: number;
  selectedVendorType: GuidedType | null;
  /** Answers per type, kept when the couple switches type and back. */
  byType: Partial<Record<GuidedType, GuidedPrefs>>;
  step: JourneyStep;
  status: "in_progress" | "completed";
  updatedAt: number;
}

export function emptyJourney(): JourneyState {
  return {
    version: 1,
    hasVenue: null,
    location: null,
    selectedVendorType: null,
    byType: {},
    step: "welcome",
    status: "in_progress",
    updatedAt: Date.now(),
  };
}

const STEPS: readonly JourneyStep[] = ["welcome", "venue", "city", "category", "prefs", "results"];

function finitePositive(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * One type's answers, keeping only keys that are still a filter of that type,
 * of the right kind (default controls and Advanced alike). A journey saved
 * before the per-type controls kept the one chip group in `styles` (venue
 * setting, photo style); it is read into that type's first pick.
 */
function parsePrefs(type: GuidedType, raw: unknown): GuidedPrefs {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const controls = GUIDED_CONTROLS[type];
  const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const rawPicks = obj(r.picks);
  const rawFlags = obj(r.flags);
  const rawLimits = obj(r.limits);
  const firstPick = controls.picks[0]?.key;
  const picks: Record<string, string[]> = {};
  const flags: Record<string, true> = {};
  const limits: Record<string, number> = {};
  for (const d of filtersForType(type)) {
    if (d.kind === "multi") {
      const known = new Set((d.options ?? []).map((o) => o.value));
      const v = strings(rawPicks[d.key] ?? (d.key === firstPick ? r.styles : undefined)).filter((x) =>
        known.has(x),
      );
      if (v.length) picks[d.key] = v;
    } else if (d.kind === "bool") {
      if (rawFlags[d.key] === true) flags[d.key] = true;
    } else if (d.key !== controls.budget?.key) {
      const n = finitePositive(rawLimits[d.key]);
      if (n !== undefined) limits[d.key] = n;
    }
  }
  const day = typeof r.day === "string" && DAY_TYPES.some((d) => d.value === r.day) ? r.day : undefined;
  return {
    ...(controls.budget && finitePositive(r.budget) && { budget: r.budget as number }),
    ...(Object.keys(picks).length && { picks }),
    ...(Object.keys(flags).length && { flags }),
    ...(Object.keys(limits).length && { limits }),
    ...(day && { day }),
  };
}

function parseLocation(raw: unknown): JourneyLocation | null {
  const l = raw as Record<string, unknown> | null | undefined;
  if (
    !l ||
    typeof l !== "object" ||
    (l.kind !== "city" && l.kind !== "venue") ||
    typeof l.label !== "string" ||
    typeof l.lat !== "number" ||
    typeof l.lng !== "number" ||
    !Number.isFinite(l.lat) ||
    !Number.isFinite(l.lng)
  ) {
    return null;
  }
  return {
    kind: l.kind,
    label: l.label,
    lat: l.lat,
    lng: l.lng,
    ...(typeof l.vendorId === "string" && { vendorId: l.vendorId }),
  };
}

/**
 * Validate a stored payload. Anything malformed degrades to a fresh journey
 * rather than throwing, so a corrupt or outdated entry can never stop the app.
 */
export function parseJourney(raw: unknown): JourneyState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;

  const location = parseLocation(r.location);
  const venueLocation = parseLocation(r.venueLocation);
  const cityLocation = parseLocation(r.cityLocation);

  const byType: Partial<Record<GuidedType, GuidedPrefs>> = {};
  if (r.byType && typeof r.byType === "object") {
    for (const [t, p] of Object.entries(r.byType as Record<string, unknown>)) {
      if (isGuidedType(t)) byType[t] = parsePrefs(t, p);
    }
  }

  const month = finitePositive(r.weddingMonth);
  const step = STEPS.includes(r.step as JourneyStep) ? (r.step as JourneyStep) : "welcome";
  return {
    version: 1,
    hasVenue: typeof r.hasVenue === "boolean" ? r.hasVenue : null,
    location,
    ...(venueLocation?.kind === "venue" && { venueLocation }),
    ...(cityLocation?.kind === "city" && { cityLocation }),
    guestCount: finitePositive(r.guestCount),
    weddingMonth: month && month <= 12 ? Math.round(month) : undefined,
    weddingYear: finitePositive(r.weddingYear),
    selectedVendorType: isGuidedType(r.selectedVendorType) ? r.selectedVendorType : null,
    byType,
    // A step that needs a location cannot be resumed without one.
    step: !location && (step === "category" || step === "prefs" || step === "results") ? "welcome" : step,
    status: r.status === "completed" ? "completed" : "in_progress",
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

/**
 * Whether the couple has actually begun the guided journey (answered the venue
 * question or picked a place). A stored journey can exist without that: Explore
 * keeps its filters in it as the shared per-type answers.
 */
export function journeyStarted(s: JourneyState | null): boolean {
  return !!s && (s.hasVenue !== null || !!s.location);
}

export function loadJourney(): JourneyState | null {
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
    return raw ? parseJourney(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Where a change came from, for the listeners below:
 * - `local`: the couple changed something here (the sync pushes it up);
 * - `remote`: the account copy replaced this one (screens already showing the
 *   journey may pick it up; nothing is pushed back);
 * - `cleared`: the couple started over (the sync deletes the account copy, or
 *   it would come straight back on the next load).
 */
export type JourneyChange = "local" | "remote" | "cleared";
const changeListeners = new Set<(c: JourneyChange, s: JourneyState | null) => void>();

export function onJourneyChange(cb: (c: JourneyChange, s: JourneyState | null) => void): () => void {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

function emitChange(c: JourneyChange, s: JourneyState | null) {
  for (const cb of changeListeners) cb(c, s);
}

/**
 * Store the journey. A local save stamps `updatedAt` (the clock the sync
 * compares); a remote one keeps the stamp it arrived with, so the copy the
 * account had and the copy here stay recognisably the same version.
 */
export function saveJourney(state: JourneyState, opts: { remote?: boolean } = {}): void {
  const next = opts.remote ? state : { ...state, updatedAt: Date.now() };
  try {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, quota): the journey still works for
    // this visit, it just cannot be resumed.
  }
  emitChange(opts.remote ? "remote" : "local", next);
}

/**
 * Which copy of the journey wins when a signed-in page loads (see
 * `lib/search/journey-sync.ts`). Pure, so `scripts/test-journey-sync.mjs` can
 * check every case.
 *
 * - `drop-local` first, separately: a browser copy owned by a different
 *   account is never uploaded or kept;
 * - then the newer `updatedAt` wins: `pull` writes the account copy here,
 *   `push` sends the browser copy up, `none` when they match or both are
 *   missing. A tie keeps both as they are.
 */
export function syncDecision(
  local: { updatedAt: number; started?: boolean } | null,
  remote: { updatedAt: number; started?: boolean } | null,
  owner: string | null,
  accountId: string,
): { dropLocal: boolean; action: "pull" | "push" | "none" } {
  const dropLocal = !!local && !!owner && owner !== accountId;
  const mine = dropLocal ? null : local;
  // A browser copy that was never started holds only Explore filters. It is
  // newer by the clock the moment a filter is touched, but it must not replace
  // a real journey on the account (the caller folds its filters in).
  if (remote?.started && mine && mine.started === false) return { dropLocal, action: "pull" };
  // And the other way round: a never-started account copy (Explore filters
  // touched on another device) must not wipe a real journey in this browser.
  if (mine?.started && remote && remote.started === false) return { dropLocal, action: "push" };
  if (remote && (!mine || remote.updatedAt > mine.updatedAt)) return { dropLocal, action: "pull" };
  if (mine && (!remote || mine.updatedAt > remote.updatedAt)) return { dropLocal, action: "push" };
  return { dropLocal, action: "none" };
}

/** Start over: forget the journey here AND on the account. */
export function clearJourney(): void {
  clearLocalJourney();
  emitChange("cleared", null);
}

/**
 * Forget the journey in this browser only (sign-out): the account copy stays,
 * and the next person on a shared device does not see this couple's venue.
 */
export function clearLocalJourney(): void {
  try {
    localStorage.removeItem(JOURNEY_STORAGE_KEY);
  } catch {
    // nothing stored to clear
  }
}
