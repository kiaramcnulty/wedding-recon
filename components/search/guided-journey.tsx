"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarHeart, ChevronLeft, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";
import { ChoiceCard } from "@/components/search/choice-card";
import { captureClient } from "@/lib/analytics/posthog";
import {
  CATEGORIES,
  VENDOR_TYPES,
  type VendorType,
} from "@/lib/constants/categories";
import { filtersForType } from "@/lib/constants/vendor-filters";
import { isGuidedType, type GuidedPrefs, type GuidedType } from "@/lib/search/guided";
import {
  clearJourney,
  emptyJourney,
  loadJourney,
  saveJourney,
  type JourneyLocation,
  type JourneyState,
  type JourneyStep,
} from "@/lib/search/journey-state";
import { COLORADO_PLACES, type PlaceOption } from "@/lib/search/places";
import { cn } from "@/lib/utils";
import { GuidedResults, type ResultsView } from "./guided-results";

/**
 * The guided first-visit journey (`/start`): venue or town, vendor type, a few
 * preferences, then three suggestions backed by the full feed. First slice:
 * Venue and Photos only. Every other type is shown, so the grid reads as the
 * finished product, but marked "Coming soon".
 *
 * All answers live in one `JourneyState`, saved to this device on every change
 * (lib/search/journey-state.ts), which is what makes resume, back and a vendor
 * round trip lossless.
 */

const STYLE_FIELD: Record<GuidedType, { key: string; label: string }> = {
  venue: { key: "setting", label: "Setting" },
  photos: { key: "style", label: "Style" },
};

const BUDGET_LABEL: Record<GuidedType, { label: string; hint: string }> = {
  venue: {
    label: "Venue budget",
    hint: "Your total for the venue. Per-person and hourly quotes are converted using your guest count and a 5-hour event.",
  },
  photos: {
    label: "Photography budget",
    hint: "Your total for a wedding-day package.",
  },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Labels for the setting/style chips, from the shared filter definitions. */
function styleOptions(t: GuidedType) {
  const def = filtersForType(t).find((d) => d.key === STYLE_FIELD[t].key);
  return def?.options ?? [];
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
      if (venueParam || typeParam) window.history.replaceState(null, "", "/start");
      // From the welcome popup: the venue question is already answered.
      if ((venueParam === "yes" || venueParam === "no") && !stored) {
        const hasVenue = venueParam === "yes";
        const next = { ...emptyJourney(), hasVenue, step: (hasVenue ? "venue" : "city") as JourneyStep };
        saveJourney(next);
        setState(next);
        return;
      }
      // From the welcome-back popup: straight to that type's preferences.
      if (isGuidedType(typeParam) && stored?.location) {
        resumedRef.current = true;
        const next = { ...stored, selectedVendorType: typeParam, manualRadius: null, step: "prefs" as JourneyStep };
        saveJourney(next);
        setState(next);
        return;
      }
      if (restore && stored?.step === "results") {
        // Back from a vendor page: straight to where the couple was.
        setView(restore === "list" ? "list" : "suggestions");
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
              Real prices and honest notes from Colorado couples. Answer a few quick questions and
              we&rsquo;ll do the digging.
            </p>
          </div>
          <p className="mt-6 text-center text-sm font-medium">Do you have a venue yet?</p>
          <div className="mt-3 grid gap-2.5">
            <ChoiceCard
              icon={CalendarHeart}
              title="Yes, we’ve booked one"
              hint="We’ll look for vendors near it"
              onClick={() => go("venue", { hasVenue: true })}
            />
            <ChoiceCard
              icon={Search}
              title="Not yet"
              hint="We’ll help you find the one"
              onClick={() => go("city", { hasVenue: false })}
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
            onCityInstead={() => go("city")}
            onContinue={(location) => go(afterLocation(state), { location, manualRadius: null })}
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
            onVenueInstead={(query) => {
              setVenueQuery(query);
              go("venue", { hasVenue: true });
            }}
            onContinue={(location) =>
              go(afterLocation(state), {
                location,
                manualRadius: null,
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
            onPick={(t) => go("prefs", { selectedVendorType: t, manualRadius: null })}
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
          onRadius={(miles) => update({ manualRadius: miles })}
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
  if (t && s.byType[t]) return "results";
  if (t || s.hasVenue === false) return "prefs";
  return "category";
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
      <p className="mt-1 text-sm text-muted-foreground">
        Some vendors charge more in peak season, so this helps us compare prices.
      </p>
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
  onCityInstead,
  onContinue,
}: {
  state: JourneyState;
  initialQuery?: string;
  onPick: (l: JourneyLocation) => void;
  onDate: (m?: number, y?: number) => void;
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
      <p className="mt-2 text-muted-foreground">We&apos;ll look for vendors near it.</p>
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
  onVenueInstead,
  onContinue,
}: {
  state: JourneyState;
  onPick: (l: JourneyLocation) => void;
  onDate: (m?: number, y?: number) => void;
  onVenueInstead: (query?: string) => void;
  onContinue: (l: JourneyLocation) => void;
}) {
  // The town in use, else the last one picked before switching to a venue.
  const picked = state.location?.kind === "city" ? state.location : (state.cityLocation ?? null);
  const [filter, setFilter] = React.useState("");
  // Once a town is picked the list folds away to that one row, so Continue
  // comes into view; a long list left open looked like the tap did nothing.
  const [browsing, setBrowsing] = React.useState(!picked);
  const f = filter.trim().toLowerCase();
  const matches = COLORADO_PLACES.filter((p) => !f || p.label.toLowerCase().includes(f));
  const regions = [...new Set(matches.map((p) => p.region))];

  const pick = (p: PlaceOption) => {
    onPick({ kind: "city", label: `${p.label}, CO`, lat: p.lat, lng: p.lng });
    setFilter("");
    setBrowsing(false);
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
          {regions.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              <p>No town by that name. We only cover Colorado for now.</p>
              <button
                type="button"
                className="mt-2 font-medium text-foreground underline underline-offset-4"
                onClick={() => onVenueInstead(filter.trim())}
              >
                Is &ldquo;{filter.trim()}&rdquo; a venue? Search venues
              </button>
            </div>
          )}
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
        </div>
      )}
      {venueLink}
      <WhenField month={state.weddingMonth} year={state.weddingYear} onChange={onDate} />
      <PrimaryButton disabled={!picked} onClick={() => picked && onContinue(picked)}>
        Continue
      </PrimaryButton>
    </>
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
        {VENDOR_TYPES.map((t: VendorType) => {
          const c = CATEGORIES[t];
          const Icon = c.icon;
          const enabled = isGuidedType(t);
          return (
            <button
              key={t}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && onPick(t)}
              className={cn(
                "flex min-h-20 flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition",
                enabled ? "hover:border-foreground active:scale-[0.98]" : "cursor-not-allowed opacity-50",
              )}
            >
              <span
                className="flex size-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.lightHex, color: c.textHex }}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium leading-tight">
                {c.label}
                {!enabled && <span className="block text-xs font-normal text-muted-foreground">Coming soon</span>}
              </span>
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
  const [budget, setBudget] = React.useState(saved.budget ? String(saved.budget) : "");
  const [guests, setGuests] = React.useState(state.guestCount ? String(state.guestCount) : "");
  const [styles, setStyles] = React.useState<string[]>(saved.styles ?? []);
  const c = CATEGORIES[type];

  const budgetValue = parseMoney(budget);
  const budgetInvalid = budget.trim() !== "" && budgetValue === undefined;
  const guestValue = guests.trim() ? Number(guests) : undefined;
  const guestsInvalid =
    guestValue !== undefined && !(Number.isInteger(guestValue) && guestValue > 0 && guestValue < 5000);

  const toggle = (v: string) =>
    setStyles((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (budgetInvalid || guestsInvalid) return;
        onSubmit(
          { ...(budgetValue && { budget: budgetValue }), ...(styles.length && { styles }) },
          type === "venue" ? guestValue : state.guestCount,
        );
      }}
    >
      <p className="text-sm font-medium" style={{ color: c.textHex }}>
        {c.label}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tell us what you&apos;re looking for</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything is optional. Leave a field blank and we won&apos;t filter on it.
      </p>

      <label className="mt-6 font-medium" htmlFor="journey-budget">
        {BUDGET_LABEL[type].label}
      </label>
      <p className="text-sm text-muted-foreground">{BUDGET_LABEL[type].hint}</p>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <Input
          id="journey-budget"
          inputMode="numeric"
          placeholder="e.g. 8,000"
          className="h-11 pl-7 text-base"
          value={budget}
          aria-invalid={budgetInvalid}
          onChange={(e) => setBudget(e.target.value)}
        />
      </div>
      {budgetInvalid && <p className="mt-1 text-sm text-destructive">Enter a dollar amount.</p>}

      {type === "venue" && (
        <>
          <label className="mt-6 font-medium" htmlFor="journey-guests">
            Guest count
          </label>
          <Input
            id="journey-guests"
            inputMode="numeric"
            placeholder="e.g. 120"
            className="mt-2 h-11 text-base"
            value={guests}
            aria-invalid={guestsInvalid}
            onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))}
          />
          {guestsInvalid && <p className="mt-1 text-sm text-destructive">Enter a whole number of guests.</p>}
        </>
      )}

      <fieldset className="mt-6">
        <legend className="font-medium">
          {STYLE_FIELD[type].label} <span className="font-normal text-muted-foreground">(pick any)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {styleOptions(type).map((o) => {
            const on = styles.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.value)}
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

      <PrimaryButton type="submit" disabled={budgetInvalid || guestsInvalid}>
        Show my matches
      </PrimaryButton>
    </form>
  );
}
