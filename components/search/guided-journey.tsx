"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarHeart, ChevronLeft, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";
import { ChoiceCard } from "@/components/search/choice-card";
import { captureClient } from "@/lib/analytics/posthog";
import { CATEGORIES, VENDOR_TYPES } from "@/lib/constants/categories";
import { filtersForType } from "@/lib/constants/vendor-filters";
import {
  GUIDED_CONTROLS,
  hasGuidedQuestions,
  isGuidedType,
  type GuidedPrefs,
  type GuidedType,
} from "@/lib/search/guided";
import {
  clearJourney,
  onJourneyChange,
  emptyJourney,
  loadJourney,
  saveJourney,
  type JourneyLocation,
  type JourneyState,
  type JourneyStep,
} from "@/lib/search/journey-state";
import { COLORADO_PLACES, foldPlaceName } from "@/lib/search/places";
import { cn } from "@/lib/utils";
import { GuidedResults, type ResultsView } from "./guided-results";

/**
 * The guided first-visit journey (`/start`): venue or town, vendor type, a few
 * preferences, then three suggestions backed by the full feed. Every vendor
 * type is covered and asks its own questions (GUIDED_CONTROLS in
 * lib/search/guided.ts); hotel blocks and Other ask none and go straight from
 * the type grid to results.
 *
 * All answers live in one `JourneyState`, saved to this device on every change
 * (lib/search/journey-state.ts), which is what makes resume, back and a vendor
 * round trip lossless.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A filter's label and options, from the shared filter definitions. */
function filterDef(t: GuidedType, key: string) {
  return filtersForType(t).find((d) => d.key === key);
}

function parseMoney(raw: string): number | undefined {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function GuidedJourney() {
  // null until the stored journey has been read after mount, so the first
  // client render matches the server's (which has no storage to read).
  const [state, setState] = React.useState<JourneyState | null>(null);
  const [resumeOffer, setResumeOffer] = React.useState<JourneyState | null>(null);
  const [view, setView] = React.useState<ResultsView>("suggestions");
  // What the couple typed into the town box before switching to venue search.
  const [venueQuery, setVenueQuery] = React.useState<string | undefined>();
  const resumedRef = React.useRef(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const stored = loadJourney();
      const params = new URLSearchParams(window.location.search);
      const restore = params.get("restore");
      const venueParam = params.get("venue");
      const typeParam = params.get("type");
      const editParam = params.get("edit");
      if (venueParam || typeParam || editParam) window.history.replaceState(null, "", "/start");
      // From the Planning Hub's venue / town card: straight to that step, no
      // resume prompt. Continue then goes where an edit always does
      // (afterLocation): back to results when there are answers already.
      if (editParam === "venue" || editParam === "city") {
        const next: JourneyState = {
          ...(stored ?? emptyJourney()),
          hasVenue: editParam === "venue",
          step: editParam,
        };
        saveJourney(next);
        setState(next);
        return;
      }
      // From the welcome popup: the venue question is already answered.
      if ((venueParam === "yes" || venueParam === "no") && !stored) {
        const hasVenue = venueParam === "yes";
        const next = {
          ...emptyJourney(),
          hasVenue,
          selectedVendorType: hasVenue ? null : ("venue" as const),
          step: (hasVenue ? "venue" : "city") as JourneyStep,
        };
        saveJourney(next);
        setState(next);
        return;
      }
      // From the welcome-back popup: straight to that type's preferences.
      if (isGuidedType(typeParam) && stored?.location) {
        resumedRef.current = true;
        const next = { ...stored, ...pickType(stored, typeParam) };
        saveJourney(next);
        setState(next);
        return;
      }
      if (restore && stored?.step === "results") {
        // Back from a vendor page: straight to where the couple was.
        setView(restore === "list" || restore === "map" ? restore : "suggestions");
        setState(stored);
        window.history.replaceState(null, "", "/start");
        return;
      }
      if (stored?.status === "completed" && stored.location) {
        // Returning with a finished search: pick the next vendor type.
        resumedRef.current = true;
        setState({ ...stored, step: "category" });
      } else if (stored && stored.step !== "welcome") {
        setResumeOffer(stored);
        setState(stored);
      } else {
        setState(emptyJourney());
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // A journey synced down from the account after this page loaded (a second
  // device): adopt it, but only while this screen still holds nothing of its
  // own. Someone mid-answer is never yanked to another copy.
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  });
  React.useEffect(
    () =>
      onJourneyChange((change, s) => {
        if (change !== "remote" || !s) return;
        const prev = stateRef.current;
        const fresh = !prev || (prev.hasVenue === null && !prev.location && prev.step === "welcome");
        if (!fresh) return;
        if (s.status === "completed" && s.location) {
          resumedRef.current = true;
          setState({ ...s, step: "category" });
        } else if (s.step !== "welcome") {
          setResumeOffer(s);
          setState(s);
        }
      }),
    [],
  );

  const update = React.useCallback((patch: Partial<JourneyState>) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveJourney(next);
      return next;
    });
  }, []);

  const go = React.useCallback(
    (step: JourneyStep, patch: Partial<JourneyState> = {}) => {
      update({ ...patch, step });
      if (step !== "results") setView("suggestions");
      window.scrollTo({ top: 0 });
    },
    [update],
  );

  const step = state?.step;
  const vendorType = state?.selectedVendorType ?? null;
  React.useEffect(() => {
    if (!step || resumeOffer) return;
    captureClient("journey_step", {
      step,
      vendor_type: vendorType,
      resumed: resumedRef.current,
    });
  }, [step, vendorType, resumeOffer]);

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (resumeOffer) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">
          Pick up where you left off?
          {resumeOffer.location && ` You were searching near ${resumeOffer.location.label}.`}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            size="lg"
            className="h-12 text-base"
            onClick={() => {
              resumedRef.current = true;
              setResumeOffer(null);
            }}
          >
            Pick up where I left off
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 text-base"
            onClick={() => {
              clearJourney();
              setResumeOffer(null);
              setState(emptyJourney());
            }}
          >
            Start a new search
          </Button>
        </div>
      </Shell>
    );
  }

  const back = backStep(state);

  switch (state.step) {
    case "welcome":
      return (
        <Shell>
          {/* -mt-16 pulls the wash up under the empty back-button row of Shell. */}
          <div className="-mx-5 -mt-16 bg-gradient-to-b from-brand-soft via-brand-soft/40 to-background px-5 pb-2 pt-16 text-center">
            <BrandMark className="mx-auto size-14" />
            <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-ink">
              Welcome to Wedding Recon
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-balance">
              Let&rsquo;s find vendors you&rsquo;ll love
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground text-balance">
              Real prices and intel from couples and vendor websites.
            </p>
          </div>
          <p className="mt-6 text-center text-sm font-medium">Do you have a venue yet?</p>
          <div className="mt-3 grid gap-2.5">
            <ChoiceCard
              icon={CalendarHeart}
              title="Yes, we’ve booked one"
              hint="We’ll look for nearby vendors"
              onClick={() => go("venue", { hasVenue: true, selectedVendorType: null })}
            />
            <ChoiceCard
              icon={Search}
              title="Not yet"
              hint="We’ll help you find the one"
              // The answer here sets the vendor type: a type left over from an
              // earlier pass (Back to this screen after picking Photos) would
              // otherwise send a venue hunt to the Photos questions.
              onClick={() => go("city", { hasVenue: false, selectedVendorType: "venue" })}
            />
          </div>
          <Link
            href="/explore"
            className="mt-8 self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip and browse the map
          </Link>
        </Shell>
      );

    case "venue":
      return (
        <Shell onBack={() => go(back)}>
          <VenueStep
            state={state}
            initialQuery={venueQuery}
            onPick={(location) => update({ location, venueLocation: location })}
            onDate={(weddingMonth, weddingYear) => update({ weddingMonth, weddingYear })}
            onGuests={(guestCount) => update({ guestCount })}
            onCityInstead={() => go("city")}
            onContinue={(location) => go(afterLocation(state), { location })}
          />
        </Shell>
      );

    case "city":
      return (
        <Shell onBack={() => go(back)}>
          <CityStep
            state={state}
            onPick={(location) => update({ location, cityLocation: location })}
            onDate={(weddingMonth, weddingYear) => update({ weddingMonth, weddingYear })}
            onGuests={(guestCount) => update({ guestCount })}
            onVenueInstead={(query) => {
              setVenueQuery(query);
              go("venue", { hasVenue: true });
            }}
            onContinue={(location) =>
              go(afterLocation(state), {
                location,
                // No venue yet: they are looking for one, so skip the type grid.
                ...(!state.selectedVendorType && state.hasVenue === false && { selectedVendorType: "venue" }),
              })
            }
          />
        </Shell>
      );

    case "category":
      return (
        <Shell onBack={state.status === "completed" ? undefined : () => go(back)}>
          <CategoryStep
            state={state}
            onPick={(t) => {
              const { step: to, ...patch } = pickType(state, t);
              go(to, patch);
            }}
            onEditLocation={() => go(state.hasVenue ? "venue" : "city")}
          />
        </Shell>
      );

    case "prefs":
      if (!state.selectedVendorType) {
        return null;
      }
      return (
        <Shell onBack={() => go(back)}>
          <PrefsStep
            key={state.selectedVendorType}
            state={state}
            type={state.selectedVendorType}
            onSubmit={(prefs, guestCount) =>
              go("results", {
                byType: { ...state.byType, [state.selectedVendorType as GuidedType]: prefs },
                guestCount,
              })
            }
          />
        </Shell>
      );

    case "results":
      if (!state.selectedVendorType || !state.location) return null;
      return (
        <GuidedResults
          state={state}
          view={view}
          onViewChange={(v) => {
            setView(v);
            window.scrollTo({ top: 0 });
          }}
          onEdit={() => go("prefs")}
          onEditLocation={() => go(state.hasVenue ? "venue" : "city")}
          onChangeType={() => go("category")}
          onShown={() => {
            if (state.status !== "completed") update({ status: "completed" });
          }}
        />
      );
  }
}

/**
 * Where Continue on a location step leads. Editing the location of a search
 * that already has answers goes straight back to its results (re-run at the
 * new anchor), rather than through the questions again.
 */
function afterLocation(s: JourneyState): JourneyStep {
  const t = s.selectedVendorType;
  if (t && (s.byType[t] || !hasGuidedQuestions(t))) return "results";
  if (t || s.hasVenue === false) return "prefs";
  return "category";
}

/**
 * Choosing a vendor type: on to its questions, or, for a type that asks none
 * (hotel blocks, Other), straight to its results.
 */
function pickType(
  s: JourneyState,
  t: GuidedType,
): Pick<JourneyState, "selectedVendorType" | "step" | "byType"> {
  return hasGuidedQuestions(t)
    ? { selectedVendorType: t, step: "prefs", byType: s.byType }
    : { selectedVendorType: t, step: "results", byType: { ...s.byType, [t]: s.byType[t] ?? {} } };
}

/** Where the back arrow goes from each step. */
function backStep(s: JourneyState): JourneyStep {
  switch (s.step) {
    case "venue":
    case "city":
      return s.step === "city" && s.hasVenue ? "venue" : "welcome";
    case "category":
      return s.hasVenue ? "venue" : "city";
    case "prefs":
      return s.hasVenue || s.status === "completed" ? "category" : "city";
    default:
      return "welcome";
  }
}

function Shell({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 pb-10 pt-4">
      <div className="mb-4 h-8">
        {onBack && (
          <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onBack}>
            <ChevronLeft className="size-4" /> Back
          </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button size="lg" {...props} className={cn("mt-8 h-12 w-full text-base", props.className)} />;
}

/** Optional wedding month + year, shared by the two location steps. */
function WhenField({
  month,
  year,
  onChange,
}: {
  month?: number;
  year?: number;
  onChange: (month: number | undefined, year: number | undefined) => void;
}) {
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
  const selectClass =
    "h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <fieldset className="mt-8">
      <legend className="font-medium">
        When is the wedding? <span className="font-normal text-muted-foreground">(optional)</span>
      </legend>
      <div className="mt-3 flex gap-2">
        <select
          aria-label="Wedding month"
          className={selectClass}
          value={month ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined, year)}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Wedding year"
          className={selectClass}
          value={year ?? ""}
          onChange={(e) => onChange(month, e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

/**
 * The shared guest count, asked once beside the date so every type can use
 * it: venues judge capacity on it, caterers divide a package price by it.
 * Asked here rather than on the venue screen because a couple with a booked
 * venue never sees that screen, and they are the main caterer shoppers.
 */
function GuestsField({
  value,
  onChange,
}: {
  value?: number;
  onChange: (guests: number | undefined) => void;
}) {
  const [raw, setRaw] = React.useState(value ? String(value) : "");
  const n = raw.trim() ? Number(raw) : undefined;
  const invalid = n !== undefined && !(Number.isInteger(n) && n > 0 && n < 5000);
  return (
    <div className="mt-6 flex flex-col">
      <label className="font-medium" htmlFor="journey-guests">
        How many guests? <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Input
        id="journey-guests"
        inputMode="numeric"
        placeholder="e.g. 120"
        className="mt-3 h-10 text-base"
        value={raw}
        aria-invalid={invalid}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d]/g, "");
          setRaw(next);
          const v = next ? Number(next) : undefined;
          if (v === undefined || (Number.isInteger(v) && v > 0 && v < 5000)) onChange(v);
        }}
      />
      {invalid && <p className="mt-1 text-sm text-destructive">Enter a whole number of guests.</p>}
    </div>
  );
}

interface VenueMatch {
  vendorId: string;
  vendorType: string;
  name: string;
  secondaryText: string;
  lat: number;
  lng: number;
}

function VenueStep({
  state,
  initialQuery,
  onPick,
  onDate,
  onGuests,
  onCityInstead,
  onContinue,
}: {
  state: JourneyState;
  initialQuery?: string;
  onPick: (l: JourneyLocation) => void;
  onDate: (m?: number, y?: number) => void;
  onGuests: (guests: number | undefined) => void;
  onCityInstead: () => void;
  onContinue: (l: JourneyLocation) => void;
}) {
  // The venue in use, else the last one picked before switching to a town.
  const picked = state.location?.kind === "venue" ? state.location : (state.venueLocation ?? null);
  const [query, setQuery] = React.useState(initialQuery || picked?.label || "");
  const [results, setResults] = React.useState<VenueMatch[] | null>(null);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2 || q === picked?.label) {
        setResults(null);
        return;
      }
      setSearching(true);
      try {
        // Our own directory only: no Google call on the first screen. Hotels
        // are included because some properties couples book are typed hotel.
        const res = await fetch(
          `/api/vendor-search?q=${encodeURIComponent(q)}&types=venue,hotel`,
        );
        setResults(res.ok ? ((await res.json()) as VenueMatch[]) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, picked?.label]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Where is your venue?</h1>
      <p className="mt-2 text-muted-foreground">We&apos;ll look for nearby vendors.</p>
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Venue name"
          placeholder="Search venue name"
          className="h-11 pl-9 text-base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {searching && <p className="mt-3 text-sm text-muted-foreground">Searching…</p>}
      {results && !searching && (
        <ul className="mt-2 divide-y rounded-lg border">
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No venue by that name yet.</li>
          )}
          {results.map((r) => (
            <li key={r.vendorId}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  onPick({ kind: "venue", label: r.name, lat: r.lat, lng: r.lng, vendorId: r.vendorId });
                  setQuery(r.name);
                  setResults(null);
                }}
              >
                <span className="font-medium">{r.name}</span>
                {r.secondaryText && (
                  <span className="text-xs text-muted-foreground">{r.secondaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && !results && (
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          <MapPin className="size-4 text-muted-foreground" /> {picked.label}
        </p>
      )}
      <button
        type="button"
        className="mt-4 self-start text-sm text-muted-foreground underline underline-offset-4"
        onClick={onCityInstead}
      >
        Can&apos;t find it? Choose the town instead
      </button>
      <WhenField month={state.weddingMonth} year={state.weddingYear} onChange={onDate} />
      <GuestsField value={state.guestCount} onChange={onGuests} />
      <PrimaryButton disabled={!picked} onClick={() => picked && onContinue(picked)}>
        Continue
      </PrimaryButton>
    </>
  );
}

function CityStep({
  state,
  onPick,
  onDate,
  onGuests,
  onVenueInstead,
  onContinue,
}: {
  state: JourneyState;
  onPick: (l: JourneyLocation) => void;
  onDate: (m?: number, y?: number) => void;
  onGuests: (guests: number | undefined) => void;
  onVenueInstead: (query?: string) => void;
  onContinue: (l: JourneyLocation) => void;
}) {
  // The town in use, else the last one picked before switching to a venue.
  const picked = state.location?.kind === "city" ? state.location : (state.cityLocation ?? null);
  const [filter, setFilter] = React.useState("");
  // Once a town is picked the list folds away to that one row, so Continue
  // comes into view; a long list left open looked like the tap did nothing.
  const [browsing, setBrowsing] = React.useState(!picked);
  const [lookup, setLookup] = React.useState<TownLookup | null>(null);
  const query = filter.trim();
  const f = foldPlaceName(filter);
  const matches = COLORADO_PLACES.filter((p) => !f || foldPlaceName(p.label).includes(f));
  const regions = [...new Set(matches.map((p) => p.region))];
  // A lookup belongs to the text it was run for; typing on discards it.
  const shownLookup = lookup && lookup.query === query ? lookup : null;
  const canLookUp = query.length >= 2;

  const pick = (p: { label: string; lat: number; lng: number }) => {
    onPick({ kind: "city", label: `${p.label}, CO`, lat: p.lat, lng: p.lng });
    setFilter("");
    setLookup(null);
    setBrowsing(false);
  };

  const runLookup = async () => {
    if (!canLookUp || shownLookup) return;
    setLookup({ query, status: "loading", results: [] });
    try {
      const results = await lookUpColoradoTown(query);
      setLookup({ query, status: "done", results });
    } catch {
      setLookup({ query, status: "error", results: [] });
    }
  };

  const venueLink = (
    <button
      type="button"
      className="mt-4 self-start text-sm text-muted-foreground underline underline-offset-4"
      onClick={() => onVenueInstead()}
    >
      {state.hasVenue ? "Search for your venue instead" : "Already booked a venue? Search for it"}
    </button>
  );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Where do you want to get married?</h1>
      <p className="mt-2 text-muted-foreground">Pick the town you&apos;re thinking about. You can change it later.</p>
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Filter towns"
          placeholder="Search Colorado towns"
          className="h-11 pl-9 text-base"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setBrowsing(true);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (matches.length === 1) pick(matches[0]);
            else if (matches.length === 0) void runLookup();
          }}
        />
      </div>
      {picked && !browsing ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-foreground px-3 py-3">
          <span className="flex items-center gap-2 font-medium">
            <MapPin className="size-4 text-brand" /> {picked.label}
          </span>
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setBrowsing(true)}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="mt-3 max-h-72 overflow-y-auto overscroll-contain rounded-lg border">
          {regions.map((region) => (
            <div key={region}>
              <p className="sticky top-0 bg-muted px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {region}
              </p>
              <ul>
                {matches
                  .filter((p) => p.region === region)
                  .map((p) => {
                    const selected = picked?.label === `${p.label}, CO`;
                    return (
                      <li key={p.label}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => pick(p)}
                          className={cn(
                            "w-full px-3 py-2.5 text-left text-sm hover:bg-muted",
                            selected && "bg-foreground font-medium text-background hover:bg-foreground",
                          )}
                        >
                          {p.label}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          {canLookUp && (
            <TownLookupBlock
              query={query}
              lookup={shownLookup}
              listEmpty={regions.length === 0}
              pickedLabel={picked?.label}
              onLookUp={() => void runLookup()}
              onPick={pick}
              onVenueInstead={() => onVenueInstead(query)}
            />
          )}
        </div>
      )}
      {venueLink}
      <WhenField month={state.weddingMonth} year={state.weddingYear} onChange={onDate} />
      <GuestsField value={state.guestCount} onChange={onGuests} />
      <PrimaryButton disabled={!picked} onClick={() => picked && onContinue(picked)}>
        Continue
      </PrimaryButton>
    </>
  );
}

type TownResult = { label: string; detail: string | null; lat: number; lng: number };
type TownLookup = { query: string; status: "loading" | "done" | "error"; results: TownResult[] };

/**
 * One geocoder call for a Colorado town that is not on the fixed list. It runs
 * on a tap or Enter only: Nominatim (behind `/api/geocode`) does not permit
 * as-you-type autocomplete.
 */
async function lookUpColoradoTown(query: string): Promise<TownResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(`${query}, Colorado`)}`);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const rows = (await res.json()) as {
    name: string;
    lat: number;
    lng: number;
    city: string | null;
    region: string | null;
  }[];
  const seen = new Set<string>();
  const out: TownResult[] = [];
  for (const r of rows) {
    if (r.region !== "Colorado" || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const label = r.city ?? r.name.split(",")[0].trim();
    // `/api/geocode` falls back to the county when a hit has no town (a peak
    // or mine called Gold Hill): that is not a place to pick, so drop it.
    if (!label || label.endsWith(" County") || seen.has(label)) continue;
    seen.add(label);
    // display_name runs "Marble, Gunnison County, Colorado, United States":
    // keep the county so two towns of one name can be told apart.
    const county = r.name.split(",").map((s) => s.trim()).find((s) => s.endsWith(" County"));
    out.push({ label, detail: county ?? null, lat: r.lat, lng: r.lng });
  }
  return out;
}

function TownLookupBlock({
  query,
  lookup,
  listEmpty,
  pickedLabel,
  onLookUp,
  onPick,
  onVenueInstead,
}: {
  query: string;
  lookup: TownLookup | null;
  listEmpty: boolean;
  pickedLabel?: string;
  onLookUp: () => void;
  onPick: (r: TownResult) => void;
  onVenueInstead: () => void;
}) {
  const link = "font-medium text-foreground underline underline-offset-4";
  return (
    <div className={cn("px-3 py-3 text-sm text-muted-foreground", !listEmpty && "border-t")}>
      {!lookup && (
        <button type="button" className={link} onClick={onLookUp}>
          {listEmpty ? "Look up" : "Not listed? Look up"} &ldquo;{query}&rdquo; in Colorado
        </button>
      )}
      {lookup?.status === "loading" && (
        <p className="flex items-center gap-2" role="status">
          <Loader2 className="size-4 animate-spin" /> Looking up &ldquo;{query}&rdquo;…
        </p>
      )}
      {lookup?.status === "error" && (
        <p>
          The lookup didn&apos;t work.{" "}
          <button type="button" className={link} onClick={onLookUp}>
            Try again
          </button>
        </p>
      )}
      {lookup?.status === "done" && lookup.results.length === 0 && (
        <p>No Colorado town called &ldquo;{query}&rdquo;.</p>
      )}
      {lookup?.status === "done" && lookup.results.length > 0 && (
        <ul className="-mx-3 -mt-3">
          {lookup.results.map((r) => {
            const selected = pickedLabel === `${r.label}, CO`;
            return (
              <li key={`${r.label}|${r.detail}`}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPick(r)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted",
                    selected && "bg-foreground font-medium text-background hover:bg-foreground",
                  )}
                >
                  <span>{r.label}</span>
                  {r.detail && <span className="text-xs text-muted-foreground">{r.detail}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {listEmpty && (
        <button type="button" className={cn(link, "mt-3 block")} onClick={onVenueInstead}>
          Is &ldquo;{query}&rdquo; a venue? Search venues
        </button>
      )}
    </div>
  );
}

function CategoryStep({
  state,
  onPick,
  onEditLocation,
}: {
  state: JourneyState;
  onPick: (t: GuidedType) => void;
  onEditLocation: () => void;
}) {
  const returning = state.status === "completed";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {returning ? "Welcome back! Which vendor are you looking for today?" : "Which vendor are you looking for?"}
      </h1>
      {state.location && (
        <p className="mt-2 text-sm text-muted-foreground">
          Near {state.location.label} ·{" "}
          <button type="button" className="underline underline-offset-4" onClick={onEditLocation}>
            Change
          </button>
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {/* A couple who has booked a venue is not shopping for one. */}
        {VENDOR_TYPES.filter((t) => !(t === "venue" && state.hasVenue)).map((t) => {
          const c = CATEGORIES[t];
          const Icon = c.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onPick(t)}
              className="flex min-h-20 flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition hover:border-foreground active:scale-[0.98]"
            >
              <span
                className="flex size-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.lightHex, color: c.textHex }}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium leading-tight">{c.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function PrefsStep({
  state,
  type,
  onSubmit,
}: {
  state: JourneyState;
  type: GuidedType;
  onSubmit: (prefs: GuidedPrefs, guestCount: number | undefined) => void;
}) {
  const saved = state.byType[type] ?? {};
  const controls = GUIDED_CONTROLS[type];
  const [budget, setBudget] = React.useState(saved.budget ? String(saved.budget) : "");
  const [picks, setPicks] = React.useState<Record<string, string[]>>(saved.picks ?? {});
  const [flags, setFlags] = React.useState<Record<string, true>>(saved.flags ?? {});
  const c = CATEGORIES[type];

  const budgetValue = parseMoney(budget);
  const budgetInvalid = budget.trim() !== "" && budgetValue === undefined;

  const toggle = (key: string, v: string) =>
    setPicks((p) => {
      const cur = p[key] ?? [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      const out = { ...p };
      if (next.length) out[key] = next;
      else delete out[key];
      return out;
    });

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (budgetInvalid) return;
        onSubmit(
          {
            ...(budgetValue && { budget: budgetValue }),
            ...(Object.keys(picks).length && { picks }),
            ...(Object.keys(flags).length && { flags }),
          },
          state.guestCount,
        );
      }}
    >
      <p className="text-sm font-medium" style={{ color: c.textHex }}>
        {c.label}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Tell us what you&apos;re looking for{" "}
        <span className="text-base font-normal text-muted-foreground">(optional)</span>
      </h1>

      {controls.budget && (
        <>
          <label className="mt-6 font-medium" htmlFor="journey-budget">
            {controls.budget.label}
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="journey-budget"
              inputMode="numeric"
              placeholder={`e.g. ${controls.budget.placeholder}`}
              className="h-11 pl-7 text-base"
              value={budget}
              aria-invalid={budgetInvalid}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          {budgetInvalid && <p className="mt-1 text-sm text-destructive">Enter a dollar amount.</p>}
        </>
      )}

      {controls.picks.map(({ key, label }) => {
        const def = filterDef(type, key);
        if (!def?.options) return null;
        const chosen = picks[key] ?? [];
        return (
          <fieldset key={key} className="mt-6">
            <legend className="font-medium">
              {label ?? def.label} <span className="font-normal text-muted-foreground">(pick any)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {def.options.map((o) => {
                const on = chosen.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(key, o.value)}
                    className={cn(
                      "min-h-9 rounded-full border px-3 py-1.5 text-sm transition",
                      on ? "border-transparent font-medium" : "hover:border-foreground",
                    )}
                    style={on ? { backgroundColor: c.lightHex, color: c.textHex } : undefined}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {controls.flags.map(({ key, label }) => (
        <label key={key} className="mt-6 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3">
          <input
            type="checkbox"
            className="size-5 shrink-0"
            style={{ accentColor: c.colorHex }}
            checked={flags[key] === true}
            onChange={(e) =>
              setFlags((f) => {
                const out = { ...f };
                if (e.target.checked) out[key] = true;
                else delete out[key];
                return out;
              })
            }
          />
          <span className="font-medium">{label ?? filterDef(type, key)?.label ?? key}</span>
        </label>
      ))}

      <PrimaryButton type="submit" disabled={budgetInvalid}>
        Show my matches
      </PrimaryButton>
    </form>
  );
}
