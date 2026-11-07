"use client";

import * as React from "react";
import { snapBbox } from "@/lib/map/viewport";
import {
  envelopeFor,
  maxRadius,
  type GuidedCandidate,
  type GuidedType,
  type LatLng,
} from "@/lib/search/guided";

/** Mirrors MAX_ROWS_PER_TYPE in vendor-map.tsx: one under PostgREST's cap. */
const MAX_ROWS = 999;

export type CandidatesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  /** `complete` is false when the response hit the row ceiling. */
  | { status: "ready"; rows: GuidedCandidate[]; complete: boolean };

async function fetchOnce(url: string): Promise<GuidedCandidate[] | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    return (await res.json()) as GuidedCandidate[];
  } catch {
    return null;
  }
}

/**
 * Every vendor of `type` within the top of its radius ladder around `anchor`,
 * with effective filter attributes, from the edge-cached `/api/map/vendors`
 * route (`attrs=1`). Loaded once per type + anchor; moving the radius inside
 * that envelope re-ranks locally with no further request.
 *
 * The envelope is snapped to the same shared grid the map uses, so couples
 * searching from the same town share one cached response.
 */
export function useGuidedCandidates(
  type: GuidedType | null,
  anchor: LatLng | null,
): { state: CandidatesState; retry: () => void } {
  // Tagged with the search it answers, so a new type or anchor never sees the
  // previous search's rows for the moment before its own request starts.
  const [state, setState] = React.useState<CandidatesState & { key?: string }>({ status: "idle" });
  const [retryTick, setRetryTick] = React.useState(0);
  const lat = anchor?.lat;
  const lng = anchor?.lng;

  const key = type && lat !== undefined && lng !== undefined ? `${type}|${lat}|${lng}` : null;

  React.useEffect(() => {
    if (!type || lat === undefined || lng === undefined) return;
    const forKey = `${type}|${lat}|${lng}`;
    let cancelled = false;
    const box = snapBbox(envelopeFor({ lat, lng }, maxRadius(type)));
    const params = new URLSearchParams({
      min_lng: String(box.minLng),
      min_lat: String(box.minLat),
      max_lng: String(box.maxLng),
      max_lat: String(box.maxLat),
      type,
      max_rows: String(MAX_ROWS),
      attrs: "1",
    });
    const url = `/api/map/vendors?${params.toString()}`;
    // Deferred a tick so the loading state is not set synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(async () => {
      setState({ status: "loading" });
      // One retry with a short jittered pause: a transient 503 under load
      // should not read as "no vendors", and should not hammer the pool either.
      let rows = await fetchOnce(url);
      if (!rows && !cancelled) {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
        rows = await fetchOnce(url);
      }
      if (cancelled) return;
      setState(
        rows
          ? { status: "ready", rows, complete: rows.length < MAX_ROWS, key: forKey }
          : { status: "error", key: forKey },
      );
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [type, lat, lng, retryTick]);

  // "Try again" on the error state re-runs the effect with a fresh request.
  const retry = React.useCallback(() => setRetryTick((n) => n + 1), []);
  const current: CandidatesState =
    (state.status === "ready" || state.status === "error") && state.key !== key ? { status: "loading" } : state;
  return { state: current, retry };
}
