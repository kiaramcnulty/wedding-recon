import { isGuidedType, type GuidedPrefs, type GuidedType } from "./guided";

/**
 * The guided journey's saved state: what the couple has answered, and where in
 * the flow they are. Kept on THIS device only (localStorage) in the first
 * slice; signed-in cross-device sync is a later milestone, so nothing here
 * should be described to the couple as following them to another device.
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
  guestCount?: number;
  /** Optional; 1-12. Picks the season price tier. */
  weddingMonth?: number;
  weddingYear?: number;
  selectedVendorType: GuidedType | null;
  /** Answers per type, kept when the couple switches type and back. */
  byType: Partial<Record<GuidedType, GuidedPrefs>>;
  /** null = automatic ladder; a number = the couple moved the slider. */
  manualRadius: number | null;
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
    manualRadius: null,
    step: "welcome",
    status: "in_progress",
    updatedAt: Date.now(),
  };
}

const STEPS: readonly JourneyStep[] = ["welcome", "venue", "city", "category", "prefs", "results"];

function finitePositive(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

function parsePrefs(raw: unknown): GuidedPrefs {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const styles = Array.isArray(r.styles)
    ? r.styles.filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    ...(finitePositive(r.budget) && { budget: r.budget as number }),
    ...(styles?.length && { styles }),
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

  let location: JourneyLocation | null = null;
  const l = r.location as Record<string, unknown> | null | undefined;
  if (
    l &&
    (l.kind === "city" || l.kind === "venue") &&
    typeof l.label === "string" &&
    typeof l.lat === "number" &&
    typeof l.lng === "number" &&
    Number.isFinite(l.lat) &&
    Number.isFinite(l.lng)
  ) {
    location = {
      kind: l.kind,
      label: l.label,
      lat: l.lat,
      lng: l.lng,
      ...(typeof l.vendorId === "string" && { vendorId: l.vendorId }),
    };
  }

  const byType: Partial<Record<GuidedType, GuidedPrefs>> = {};
  if (r.byType && typeof r.byType === "object") {
    for (const [t, p] of Object.entries(r.byType as Record<string, unknown>)) {
      if (isGuidedType(t)) byType[t] = parsePrefs(p);
    }
  }

  const month = finitePositive(r.weddingMonth);
  const step = STEPS.includes(r.step as JourneyStep) ? (r.step as JourneyStep) : "welcome";
  return {
    version: 1,
    hasVenue: typeof r.hasVenue === "boolean" ? r.hasVenue : null,
    location,
    guestCount: finitePositive(r.guestCount),
    weddingMonth: month && month <= 12 ? Math.round(month) : undefined,
    weddingYear: finitePositive(r.weddingYear),
    selectedVendorType: isGuidedType(r.selectedVendorType) ? r.selectedVendorType : null,
    byType,
    manualRadius: finitePositive(r.manualRadius) ?? null,
    // A step that needs a location cannot be resumed without one.
    step: !location && (step === "category" || step === "prefs" || step === "results") ? "welcome" : step,
    status: r.status === "completed" ? "completed" : "in_progress",
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

export function loadJourney(): JourneyState | null {
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
    return raw ? parseJourney(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveJourney(state: JourneyState): void {
  try {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {
    // Storage unavailable (private mode, quota): the journey still works for
    // this visit, it just cannot be resumed.
  }
}

export function clearJourney(): void {
  try {
    localStorage.removeItem(JOURNEY_STORAGE_KEY);
  } catch {
    // nothing stored to clear
  }
}
