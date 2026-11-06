"use client";

import * as React from "react";
import {
  JOURNEY_STORAGE_KEY,
  loadJourney,
  onJourneyChange,
  saveJourney,
  type JourneyLocation,
  type JourneyState,
} from "@/lib/search/journey-state";

/**
 * The couple's wedding place as the guided journey recorded it: the venue they
 * booked, or the town they are looking in. The Planning Hub shows it as its own
 * card (`components/hub/wedding-place-card.tsx`).
 *
 * Read from the journey state (`wr:journey`), so it is device-local like the
 * rest of the journey: a couple who answered on their phone will not see it on
 * a laptop until journey state syncs to the account.
 */
export type WeddingPlace = {
  kind: "venue" | "city";
  location: JourneyLocation;
  weddingMonth?: number;
  weddingYear?: number;
};

export function weddingPlaceOf(s: JourneyState | null): WeddingPlace | null {
  if (!s) return null;
  const when = { weddingMonth: s.weddingMonth, weddingYear: s.weddingYear };
  if (s.hasVenue === true) {
    const v = s.location?.kind === "venue" ? s.location : s.venueLocation;
    if (v) return { kind: "venue", location: v, ...when };
  }
  if (s.hasVenue === false) {
    const c = s.location?.kind === "city" ? s.location : s.cityLocation;
    if (c) return { kind: "city", location: c, ...when };
  }
  return null;
}

/**
 * The journey with its wedding place taken out. The venue question goes back
 * to unanswered; if that place was the one being searched around, the search
 * has no centre left, so the journey restarts from the welcome screen (other
 * answers such as preferences per type are kept for when they pick again).
 */
export function withoutWeddingPlace(s: JourneyState): JourneyState {
  const place = weddingPlaceOf(s);
  if (!place) return s;
  const next: JourneyState = { ...s, hasVenue: null };
  if (place.kind === "venue") delete next.venueLocation;
  else delete next.cityLocation;
  if (s.location?.kind === place.kind) {
    next.location = null;
    next.step = "welcome";
    next.status = "in_progress";
  }
  return next;
}

// A tiny store over localStorage so every component on the page (the card,
// and the Hub list that leaves the booked venue out) agrees, and a change in
// another tab, or a copy synced down from the account, shows up here too.
const listeners = new Set<() => void>();
let unhookChanges: (() => void) | null = null;
let cachedRaw: string | null | undefined;
let cachedState: JourneyState | null = null;

function snapshot(): JourneyState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
  } catch {
    raw = null;
  }
  // Same string, same object: useSyncExternalStore needs a stable snapshot.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = loadJourney();
  }
  return cachedState;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Any save on this page (local edit, account copy arriving) re-reads.
  unhookChanges ??= onJourneyChange(() => {
    for (const l of listeners) l();
  });
  const onStorage = (e: StorageEvent) => {
    if (e.key === JOURNEY_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The stored journey; null on the server and when there is none. */
export function useJourneySnapshot(): JourneyState | null {
  return React.useSyncExternalStore(subscribe, snapshot, () => null);
}

export function useWeddingPlace(): WeddingPlace | null {
  const s = useJourneySnapshot();
  return React.useMemo(() => weddingPlaceOf(s), [s]);
}

/** Write the journey; subscribers hear about it through `onJourneyChange`. */
export function writeJourney(s: JourneyState) {
  saveJourney(s);
}
