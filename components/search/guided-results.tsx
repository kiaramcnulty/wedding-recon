"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorFeed, ViewToggle } from "@/components/map/vendor-feed";
import { VendorMap } from "@/components/map/vendor-map";
import { VendorPinPreview } from "@/components/map/vendor-pin-preview";
import { SaveButton } from "@/components/vendor/save-button";
import {
  VendorPreviewCard,
  useVendorPreviews,
  type VendorPreview,
} from "@/components/map/vendor-preview-card";
import { captureClient } from "@/lib/analytics/posthog";
import { writeExploreAnchor, writeMapView } from "@/lib/map/map-view";
import { zoomToFitRing } from "@/lib/map/ring";
import { CATEGORIES, CATEGORY_PLURAL } from "@/lib/constants/categories";
import { filtersForType } from "@/lib/constants/vendor-filters";
import {
  GUIDED_CONTROLS,
  advancedCount,
  guidedSelection,
  hasGuidedQuestions,
  runGuidedSearch,
  partialFillOf,
  suggestionsOf,
  type GuidedPrefs,
  type GuidedType,
} from "@/lib/search/guided";
import type { JourneyState } from "@/lib/search/journey-state";
import { useGuidedCandidates } from "./use-guided-candidates";

export type ResultsView = "suggestions" | "list" | "map";

const SCROLL_KEY = "wr:journeyScroll";
/** Same words the full feed uses over its partial tier (vendor-feed.tsx). */
const PARTIAL_LABEL = "Partial matches in the area";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

// "Browse the map instead" zoom: about 25 miles across on a phone, the size of
// the first radius step.
const MAP_ZOOM = 10;

/**
 * Suggestions (up to three confirmed matches) and the full feed behind them,
 * both cut from ONE ranked result so the count on "View all" and the list it
 * opens can never disagree.
 */
export function GuidedResults({
  state,
  view,
  onViewChange,
  onEdit,
  onEditLocation,
  onChangeType,
  onShown,
}: {
  state: JourneyState;
  view: ResultsView;
  onViewChange: (v: ResultsView) => void;
  onEdit: () => void;
  onEditLocation: () => void;
  onChangeType: () => void;
  onShown: () => void;
}) {
  const type = state.selectedVendorType as GuidedType;
  const location = state.location!;
  const prefs = React.useMemo(() => state.byType[type] ?? {}, [state.byType, type]);
  const anchor = React.useMemo(
    () => ({ lat: location.lat, lng: location.lng }),
    [location.lat, location.lng],
  );
  const { state: candidates, retry } = useGuidedCandidates(type, anchor);

  const selection = React.useMemo(
    () =>
      guidedSelection(type, prefs, {
        guestCount: state.guestCount,
        weddingMonth: state.weddingMonth,
      }),
    [type, prefs, state.guestCount, state.weddingMonth],
  );

  const result = React.useMemo(() => {
    if (candidates.status !== "ready") return null;
    return runGuidedSearch(
      candidates.rows,
      type,
      selection,
      anchor,
      { mode: "auto" },
    );
  }, [candidates, type, selection, anchor]);

  // Mark the search completed and log it once per distinct result.
  const resultKey = result
    ? `${type}|${result.radiusMiles}|${result.confirmedCount}|${result.partialCount}`
    : null;
  React.useEffect(() => {
    if (!result || !resultKey) return;
    onShown();
    captureClient("journey_results", {
      vendor_type: type,
      confirmed: result.confirmedCount,
      partial: result.partialCount,
      radius_miles: result.radiusMiles,
      expanded: result.expanded,
    });
    // resultKey stands in for `result`, which is a new object on every recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  const suggestionIds = React.useMemo(
    () => (result ? suggestionsOf(result).map((r) => r.id) : []),
    [result],
  );
  const partialIds = React.useMemo(
    () => (result ? partialFillOf(result).map((r) => r.id) : []),
    [result],
  );
  // One fetch for both groups, split back apart by id.
  const allPreviews = useVendorPreviews(React.useMemo(() => [...suggestionIds, ...partialIds], [suggestionIds, partialIds]));
  const previews = React.useMemo(
    () => allPreviews && allPreviews.filter((p) => suggestionIds.includes(p.id)),
    [allPreviews, suggestionIds],
  );
  const partialPreviews = React.useMemo(
    () => allPreviews && allPreviews.filter((p) => partialIds.includes(p.id)),
    [allPreviews, partialIds],
  );
  const c = CATEGORIES[type];

  const pills = preferencePills(type, prefs, state);
  const asks = hasGuidedQuestions(type);
  const incomplete = candidates.status === "ready" && !candidates.complete;

  const header = (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: c.textHex }}>
          {c.label}
        </p>
        <button
          type="button"
          onClick={onChangeType}
          className="shrink-0 text-sm text-muted-foreground underline underline-offset-4"
        >
          Change type
        </button>
      </div>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        Near{" "}
        <button type="button" onClick={onEditLocation} className="underline underline-offset-4">
          {location.label}
        </button>
      </p>
      {pills.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Your preferences">
          {pills.map((p) => (
            <li
              key={p}
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: c.lightHex, color: c.textHex }}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
      {asks && (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <SlidersHorizontal className="size-3.5" /> Edit search
          </Button>
        </div>
      )}
    </div>
  );

  if (candidates.status === "error") {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        {header}
        <div className="px-5 py-12 text-center">
          <p className="font-medium">We couldn&apos;t load vendors just now.</p>
          <p className="mt-1 text-sm text-muted-foreground">Your answers are saved.</p>
          <Button className="mt-4" onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        {header}
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-muted-foreground" role="status">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm font-medium">Finding {CATEGORY_PLURAL[type]} near {location.label}…</span>
        </div>
      </div>
    );
  }

  if (view === "list" || view === "map") {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-0 mx-auto flex w-full max-w-[480px] flex-col">
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => onViewChange("suggestions")}>
              <ChevronLeft className="size-4" /> Top matches
            </Button>
            <ViewToggle view={view} onChange={onViewChange} />
          </div>
          <p className="px-5 pb-2 pt-1 text-sm text-muted-foreground">
            {result.confirmedCount} {result.confirmedCount === 1 ? "match" : "matches"}
            {result.partialCount > 0 && `, ${result.partialCount} partial`} within {result.radiusMiles} miles of{" "}
            {location.label}
          </p>
          {view === "map" ? (
            <ResultsMap
              type={type}
              center={anchor}
              miles={result.radiusMiles}
              ranked={result.ranked}
              selection={selection}
            />
          ) : (
          <VendorFeed
            entries={result.ranked.map((r) => ({ id: r.id, vendorType: type, rank: r.rank }))}
            scrollKey={SCROLL_KEY}
            showCategoryPill={false}
            selections={{ [type]: selection }}
            returnTo="/start?restore=list"
            emptyText="Nothing nearby yet. Try fewer preferences."
            className="min-h-0 flex-1"
            footnote={
              incomplete
                ? "There may be more vendors than shown here."
                : "Partial matches are missing details we could check."
            }
          />
          )}
        </div>
      </div>
    );
  }

  const suggestions = suggestionsOf(result);
  const card = (item: VendorPreview) => (
    <VendorPreviewCard
      item={item}
      vendorType={type}
      href={`/vendor/${item.id}?from=${encodeURIComponent("/start?restore=suggestions")}`}
      selection={selection}
      showCategoryPill={false}
      cornerAction={
        <SaveButton
          vendorId={item.id}
          vendorType={type}
          returnTo="/start?restore=suggestions"
          variant="overlay"
        />
      }
    />
  );
  // Fewer confirmed matches than suggestion slots: the best partial matches
  // fill the screen to three cards, in the feed's own order, under the same
  // divider the full feed draws over its partial tier, so they never read as
  // matches.
  const partialRows =
    partialIds.length === 0 ? null : (
      <>
        <li className="flex items-center gap-3 pt-1">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {PARTIAL_LABEL}
          </span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </li>
        {partialPreviews === null
          ? partialIds.map((id) => <li key={id} className="h-[213px] animate-pulse rounded-xl bg-muted" />)
          : partialPreviews.map((item) => <li key={item.id}>{card(item)}</li>)}
      </>
    );
  return (
    <div className="mx-auto w-full max-w-[480px] pb-10">
      {header}
      <div className="px-5 pt-5">
        {result.confirmedCount === 0 && !asks ? (
          <div className="rounded-xl border px-4 py-6 text-center">
            <h1 className="font-display text-2xl font-semibold">No {CATEGORY_PLURAL[type]} nearby yet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing within {result.radiusMiles} miles of {location.label}.
            </p>
            <Button className="mt-4" onClick={onChangeType}>
              Try another vendor type
            </Button>
          </div>
        ) : result.confirmedCount === 0 ? (
          <div className="rounded-xl border px-4 py-6 text-center">
            <h1 className="font-display text-2xl font-semibold">No exact matches yet</h1>
            <p className="mt-1 text-sm text-muted-foreground">Try a higher budget or fewer preferences.</p>
            <Button className="mt-4" onClick={onEdit}>
              Adjust filters
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight">Here are the top options we found</h1>
            <ul className="mt-4 flex flex-col gap-3">
              {previews === null
                ? suggestions.map((s) => (
                    <li key={s.id} className="h-[213px] animate-pulse rounded-xl bg-muted" />
                  ))
                : previews.map((item) => <li key={item.id}>{card(item)}</li>)}
              {partialRows}
            </ul>
            <Button
              size="lg"
              variant="outline"
              className="mt-4 h-11 w-full"
              onClick={() => onViewChange("list")}
            >
              View all {result.confirmedCount} {result.confirmedCount === 1 ? "match" : "matches"}
              {result.partialCount > 0 && ` + ${result.partialCount} partial`}
            </Button>
          </>
        )}
        {result.confirmedCount === 0 && partialRows && (
          <>
            <ul className="mt-4 flex flex-col gap-3">{partialRows}</ul>
            <Button
              size="lg"
              variant="outline"
              className="mt-4 h-11 w-full"
              onClick={() => onViewChange("list")}
            >
              View all {result.partialCount} partial
            </Button>
          </>
        )}
        {incomplete && (
          <p className="mt-3 text-xs text-muted-foreground">
            We couldn&apos;t load every vendor in this area, so counts may be low.
          </p>
        )}
      </div>
      <p className="px-5 pt-6 text-center text-sm">
        <Link
          href={`/explore?types=${type}`}
          // Open the map on this search, not on Explore's Denver default.
          onClick={() => {
            writeMapView({ center: [location.lng, location.lat], zoom: MAP_ZOOM });
            writeExploreAnchor({ lat: location.lat, lng: location.lng, label: location.label });
          }}
          className="text-muted-foreground underline underline-offset-4"
        >
          Browse the map instead
        </Link>
      </p>
    </div>
  );
}

/**
 * The result set on the shared map: only these vendors get pins, with the
 * journey's own match/partial verdicts, inside a ring at the search radius.
 * Framed on the ring when it opens; panning never moves the search.
 */
function ResultsMap({
  type,
  center,
  miles,
  ranked,
  selection,
}: {
  type: GuidedType;
  center: { lat: number; lng: number };
  miles: number;
  ranked: readonly { id: string; rank: 0 | 1 }[];
  selection: ReturnType<typeof guidedSelection>;
}) {
  const [pin, setPin] = React.useState<string | null>(null);
  const results = React.useMemo(() => new Map(ranked.map((r) => [r.id, r.rank])), [ranked]);
  const ring = React.useMemo(() => ({ lng: center.lng, lat: center.lat, miles }), [center.lng, center.lat, miles]);
  const selectedTypes = React.useMemo(() => [type], [type]);
  // Read once: the map takes its starting view at init only. The frame is the
  // app column (max 480px) under the header and above the bottom nav.
  const [initialView] = React.useState(() => ({
    lng: center.lng,
    lat: center.lat,
    zoom:
      typeof window === "undefined"
        ? 8
        : zoomToFitRing(center.lat, miles, Math.min(window.innerWidth, 480), window.innerHeight - 220),
  }));
  const closePin = React.useCallback(() => setPin(null), []);

  return (
    <div className="relative min-h-0 flex-1">
      <VendorMap
        initialView={initialView}
        selectedTypes={selectedTypes}
        results={results}
        ring={ring}
        selectedVendorId={pin}
        onVendorOpen={(p) => setPin(p.id)}
        onBackgroundTap={closePin}
      />
      {pin && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-9 pt-3">
          <VendorPinPreview
            vendorId={pin}
            vendorType={type}
            selection={selection}
            onClose={closePin}
            returnTo="/start?restore=map"
          />
        </div>
      )}
    </div>
  );
}

/** The couple's answers as short pills over the results. */
function preferencePills(type: GuidedType, prefs: GuidedPrefs, state: JourneyState): string[] {
  const controls = GUIDED_CONTROLS[type];
  const defs = filtersForType(type);
  const out: string[] = [];
  if (controls.budget && prefs.budget) out.push(controls.budget.pill(money(prefs.budget)));
  // The guest count is asked on the location step; caterers use it too, to
  // divide a package price per guest.
  if ((controls.guests || type === "food") && state.guestCount) out.push(`${state.guestCount} guests`);
  for (const { key } of controls.picks) {
    const def = defs.find((d) => d.key === key);
    for (const v of prefs.picks?.[key] ?? []) {
      out.push(def?.options?.find((o) => o.value === v)?.label ?? v);
    }
  }
  for (const { key, label } of controls.flags) {
    if (prefs.flags?.[key]) out.push(label ?? defs.find((d) => d.key === key)?.label ?? key);
  }
  // Advanced filters set on Explore narrow these results too; say so.
  const more = advancedCount(type, prefs);
  if (more) out.push(`+${more} more ${more === 1 ? "filter" : "filters"}`);
  return out;
}
