"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorFeed } from "@/components/map/vendor-feed";
import { SaveButton } from "@/components/vendor/save-button";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";
import { captureClient } from "@/lib/analytics/posthog";
import { CATEGORIES } from "@/lib/constants/categories";
import { filtersForType } from "@/lib/constants/vendor-filters";
import {
  guidedSelection,
  runGuidedSearch,
  suggestionsOf,
  type GuidedType,
} from "@/lib/search/guided";
import type { JourneyState } from "@/lib/search/journey-state";
import { useGuidedCandidates } from "./use-guided-candidates";

export type ResultsView = "suggestions" | "list";

const SCROLL_KEY = "wr:journeyScroll";
const STYLE_KEY: Record<GuidedType, string> = { venue: "setting", photos: "style" };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

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
  const previews = useVendorPreviews(suggestionIds);
  const c = CATEGORIES[type];

  const pills = preferencePills(type, prefs, state);
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
      <div className="mt-3 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <SlidersHorizontal className="size-3.5" /> Edit search
        </Button>
      </div>
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
          <span className="text-sm font-medium">Finding {c.label.toLowerCase()} near {location.label}…</span>
        </div>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-0 mx-auto flex w-full max-w-[480px] flex-col">
          <div className="px-3 pt-3">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => onViewChange("suggestions")}>
              <ChevronLeft className="size-4" /> Top matches
            </Button>
          </div>
          <p className="px-5 pt-1 text-sm text-muted-foreground">
            {result.confirmedCount} {result.confirmedCount === 1 ? "match" : "matches"}
            {result.partialCount > 0 && `, ${result.partialCount} partial`} within {result.radiusMiles} miles of{" "}
            {location.label}
          </p>
          <VendorFeed
            entries={result.ranked.map((r) => ({ id: r.id, vendorType: type, rank: r.rank }))}
            scrollKey={SCROLL_KEY}
            selections={{ [type]: selection }}
            returnTo="/start?restore=list"
            emptyText="Nothing nearby yet. Try fewer preferences."
            className="min-h-0 flex-1"
            footnote={
              incomplete
                ? "There may be more vendors than shown here."
                : "Partial matches are missing a price, guest count or style we could check."
            }
          />
        </div>
      </div>
    );
  }

  const suggestions = suggestionsOf(result);
  return (
    <div className="mx-auto w-full max-w-[480px] pb-10">
      {header}
      <div className="px-5 pt-5">
        {result.confirmedCount === 0 ? (
          <div className="rounded-xl border px-4 py-6 text-center">
            <h1 className="text-lg font-semibold">No exact matches yet</h1>
            <p className="mt-1 text-sm text-muted-foreground">Try a higher budget or fewer preferences.</p>
            <Button className="mt-4" onClick={onEdit}>
              Adjust filters
            </Button>
            {result.partialCount > 0 && (
              <button
                type="button"
                className="mt-3 block w-full text-sm text-muted-foreground underline underline-offset-4"
                onClick={() => onViewChange("list")}
              >
                See {result.partialCount} partial {result.partialCount === 1 ? "match" : "matches"}
              </button>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Here are the top options we found</h1>
            <ul className="mt-4 flex flex-col gap-3">
              {previews === null
                ? suggestions.map((s) => (
                    <li key={s.id} className="h-28 animate-pulse rounded-xl bg-muted" />
                  ))
                : previews.map((item) => (
                    <li key={item.id}>
                      <VendorPreviewCard
                        item={item}
                        vendorType={type}
                        href={`/vendor/${item.id}?from=${encodeURIComponent("/start?restore=suggestions")}`}
                        selection={selection}
                        showCategoryPill={false}
                        photoAction={
                          <SaveButton
                            vendorId={item.id}
                            vendorType={type}
                            returnTo="/start?restore=suggestions"
                            variant="overlay"
                          />
                        }
                      />
                    </li>
                  ))}
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
        {incomplete && (
          <p className="mt-3 text-xs text-muted-foreground">
            We couldn&apos;t load every vendor in this area, so counts may be low.
          </p>
        )}
      </div>
      <p className="px-5 pt-6 text-center text-sm">
        <Link
          href={`/explore?types=${type}`}
          className="text-muted-foreground underline underline-offset-4"
        >
          Browse the map instead
        </Link>
      </p>
    </div>
  );
}

/** The couple's answers as short pills over the results. */
function preferencePills(type: GuidedType, prefs: { budget?: number; styles?: string[] }, state: JourneyState): string[] {
  const out: string[] = [];
  if (prefs.budget) out.push(`Up to ${money(prefs.budget)}`);
  if (type === "venue" && state.guestCount) out.push(`${state.guestCount} guests`);
  const def = filtersForType(type).find((d) => d.key === STYLE_KEY[type]);
  for (const v of prefs.styles ?? []) {
    out.push(def?.options?.find((o) => o.value === v)?.label ?? v);
  }
  return out;
}
