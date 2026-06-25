"use client";

import * as React from "react";
import { Search, X, MapPin, Loader2, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PlaceSelection {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string;
}

export interface ManualSelection {
  name: string;
  city: string;
  /** Resolved full address/label from geocoding (null until a location is picked). */
  address: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
}

interface AutocompleteResult {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

/** A geocoded location suggestion from /api/geocode (Nominatim). */
interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
}

type ComboboxMode = "search" | "manual";

interface PlacesComboboxProps {
  /** Called when user selects a Google Place */
  onSelectPlace: (place: PlaceSelection) => void;
  /** Called when user commits a manual entry */
  onSelectManual: (entry: ManualSelection) => void;
  /** Called when user clears the selection */
  onClear: () => void;
  /** If a vendor name is locked (pre-populated), show it read-only */
  lockedName?: string;
  className?: string;
}

export function PlacesCombobox({
  onSelectPlace,
  onSelectManual,
  onClear,
  lockedName,
  className,
}: PlacesComboboxProps) {
  const [mode, setMode] = React.useState<ComboboxMode>("search");
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<AutocompleteResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<PlaceSelection | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Manual mode fields
  const [manualName, setManualName] = React.useState("");
  // Location autocomplete (geocoded) — required for a manual entry.
  const [locQuery, setLocQuery] = React.useState("");
  const [locSuggestions, setLocSuggestions] = React.useState<GeocodeResult[]>([]);
  const [locLoading, setLocLoading] = React.useState(false);
  const [locOpen, setLocOpen] = React.useState(false);
  const [selectedLocation, setSelectedLocation] =
    React.useState<GeocodeResult | null>(null);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const locDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Notify the parent of the manual entry. Mode stays "manual" once a name is
  // typed; the parent enforces that a location was resolved before submit.
  const emitManual = React.useCallback(
    (name: string, location: GeocodeResult | null) => {
      if (!name.trim()) {
        onClear();
        return;
      }
      onSelectManual({
        name: name.trim(),
        city: location?.city ?? "",
        address: location?.name ?? null,
        region: location?.region ?? null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      });
    },
    [onClear, onSelectManual],
  );

  // Debounced geocode for the location field. Nominatim asks for ≤1 req/sec and
  // discourages as-you-type, so we debounce generously and only fire on pause.
  React.useEffect(() => {
    if (mode !== "manual") return;
    if (locDebounceRef.current) clearTimeout(locDebounceRef.current);

    // Don't re-query once a suggestion is locked in (or the field is empty).
    const skip = !!selectedLocation || !locQuery.trim();

    locDebounceRef.current = setTimeout(async () => {
      if (skip) {
        setLocSuggestions([]);
        setLocOpen(false);
        return;
      }
      setLocLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(locQuery)}`);
        const data: GeocodeResult[] = await res.json();
        setLocSuggestions(data);
        setLocOpen(true);
      } catch {
        setLocSuggestions([]);
        setLocOpen(true);
      } finally {
        setLocLoading(false);
      }
    }, skip ? 0 : 500);

    return () => {
      if (locDebounceRef.current) clearTimeout(locDebounceRef.current);
    };
  }, [locQuery, mode, selectedLocation]);

  // Debounced autocomplete
  React.useEffect(() => {
    if (mode !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const empty = !query.trim() || !!selected;

    debounceRef.current = setTimeout(async () => {
      if (empty) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
        const data: AutocompleteResult[] = await res.json();
        setSuggestions(data);
        // Open even with zero results so the manual-entry escape hatch stays
        // reachable when a search returns no matches.
        setOpen(true);
      } catch {
        setSuggestions([]);
        setOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, empty ? 0 : 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, selected]);

  async function handleSelectSuggestion(suggestion: AutocompleteResult) {
    setOpen(false);
    setQuery(suggestion.primaryText);
    setIsFetchingDetails(true);
    try {
      const res = await fetch(`/api/places?placeId=${encodeURIComponent(suggestion.placeId)}`);
      const details = await res.json();
      const place: PlaceSelection = {
        name: details?.name ?? suggestion.primaryText,
        address: details?.address ?? suggestion.secondaryText ?? null,
        lat: details?.lat ?? null,
        lng: details?.lng ?? null,
        placeId: suggestion.placeId,
      };
      setSelected(place);
      onSelectPlace(place);
    } catch {
      // Fallback: use autocomplete data
      const place: PlaceSelection = {
        name: suggestion.primaryText,
        address: suggestion.secondaryText || null,
        lat: null,
        lng: null,
        placeId: suggestion.placeId,
      };
      setSelected(place);
      onSelectPlace(place);
    } finally {
      setIsFetchingDetails(false);
    }
  }

  function resetManualLocation() {
    setSelectedLocation(null);
    setLocQuery("");
    setLocSuggestions([]);
    setLocOpen(false);
  }

  function handleClear() {
    setQuery("");
    setSelected(null);
    setSuggestions([]);
    setOpen(false);
    setManualName("");
    resetManualLocation();
    setMode("search");
    onClear();
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function switchToManual() {
    setOpen(false);
    // Pre-fill manual name from whatever they typed
    setManualName(query);
    resetManualLocation();
    setMode("manual");
    // Mode becomes "manual" with a name but no location yet; the parent blocks
    // submit until a location is resolved.
    emitManual(query, null);
  }

  // Keyboard navigation in the dropdown
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const first = listRef.current?.querySelector<HTMLElement>("[role=option]");
      first?.focus();
    }
  }

  function handleOptionKeyDown(
    e: React.KeyboardEvent<HTMLLIElement>,
    suggestion: AutocompleteResult,
    idx: number
  ) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelectSuggestion(suggestion);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = listRef.current?.querySelectorAll<HTMLElement>("[role=option]")[idx + 1];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        inputRef.current?.focus();
      } else {
        const prev = listRef.current?.querySelectorAll<HTMLElement>("[role=option]")[idx - 1];
        prev?.focus();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.focus();
    }
  }

  // If vendor is locked (from hub "Add Recon"), show read-only
  if (lockedName) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label>Business name</Label>
        <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 py-2 text-sm">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate font-medium">{lockedName}</span>
        </div>
      </div>
    );
  }

  // ── Manual entry mode ─────────────────────────────────────────────────────
  if (mode === "manual") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <Label>Business name</Label>
          <button
            type="button"
            onClick={() => {
              setManualName("");
              resetManualLocation();
              setMode("search");
              onClear();
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Search instead
          </button>
        </div>

        <Input
          placeholder="Business name *"
          value={manualName}
          onChange={(e) => {
            setManualName(e.target.value);
            emitManual(e.target.value, selectedLocation);
          }}
          aria-label="Business name"
        />

        {/* Required, geocoded location */}
        <div className="space-y-1.5">
          <Label htmlFor="manual-location">Address, city, or state *</Label>
          <div className="relative">
            <div className="relative flex items-center">
              <MapPin className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
              <input
                id="manual-location"
                type="text"
                role="combobox"
                aria-expanded={locOpen}
                aria-autocomplete="list"
                aria-controls="manual-location-listbox"
                placeholder="e.g. 123 Main St, Denver, CO"
                value={selectedLocation ? selectedLocation.name : locQuery}
                readOnly={!!selectedLocation}
                onChange={(e) => {
                  if (!selectedLocation) setLocQuery(e.target.value);
                }}
                className={cn(
                  "h-10 w-full rounded-lg border border-input bg-transparent py-2 pr-10 pl-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                  selectedLocation && "bg-muted/30 font-medium",
                )}
              />
              <div className="absolute right-2.5 flex items-center">
                {locLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : locQuery || selectedLocation ? (
                  <button
                    type="button"
                    aria-label="Clear location"
                    onClick={() => {
                      resetManualLocation();
                      emitManual(manualName, null);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {locOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                <ul
                  id="manual-location-listbox"
                  role="listbox"
                  className="max-h-60 overflow-y-auto py-1"
                >
                  {locSuggestions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      No matches for &ldquo;{locQuery.trim()}&rdquo;.
                    </li>
                  ) : (
                    locSuggestions.map((s, idx) => (
                      <li
                        key={`${s.lat},${s.lng},${idx}`}
                        role="option"
                        aria-selected={false}
                        tabIndex={0}
                        className="cursor-pointer px-3 py-2 text-sm leading-snug outline-none hover:bg-accent focus:bg-accent"
                        onClick={() => {
                          setSelectedLocation(s);
                          setLocOpen(false);
                          emitManual(manualName, s);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedLocation(s);
                            setLocOpen(false);
                            emitManual(manualName, s);
                          }
                        }}
                      >
                        {s.name}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          {selectedLocation ? (
            <p className="flex items-center gap-1 text-xs text-emerald-700">
              <MapPin className="size-3 shrink-0" />
              Location set — this vendor will show on the map.
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <PenLine className="size-3 shrink-0" />
              Start typing, then pick a match so it can appear on the map.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Search mode ───────────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor="places-search">Business name</Label>
      <div className="relative">
        {/* Input */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            id="places-search"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="places-listbox"
            placeholder="Search for a business…"
            value={selected ? selected.name : query}
            readOnly={!!selected}
            onChange={(e) => {
              if (!selected) setQuery(e.target.value);
            }}
            onKeyDown={handleSearchKeyDown}
            className={cn(
              "h-10 w-full rounded-lg border border-input bg-transparent py-2 pr-10 pl-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
              selected && "bg-muted/30 font-medium"
            )}
          />
          {/* Right adornment: loading spinner, clear, or empty */}
          <div className="absolute right-2.5 flex items-center">
            {isFetchingDetails || isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (query || selected) ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <ul
              id="places-listbox"
              ref={listRef}
              role="listbox"
              className="max-h-60 overflow-y-auto py-1"
            >
              {suggestions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </li>
              ) : (
                suggestions.map((s, idx) => (
                  <li
                    key={s.placeId}
                    role="option"
                    aria-selected={false}
                    tabIndex={0}
                    className="flex cursor-pointer flex-col gap-0.5 px-3 py-2 outline-none hover:bg-accent focus:bg-accent"
                    onClick={() => handleSelectSuggestion(s)}
                    onKeyDown={(e) => handleOptionKeyDown(e, s, idx)}
                  >
                    <span className="text-sm font-medium leading-snug">{s.primaryText}</span>
                    {s.secondaryText && (
                      <span className="text-xs text-muted-foreground leading-snug">
                        {s.secondaryText}
                      </span>
                    )}
                  </li>
                ))
              )}
              {/* Manual entry escape hatch */}
              <li className="border-t border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={switchToManual}
                >
                  <PenLine className="size-3.5" />
                  Can&apos;t find it? Enter manually
                </button>
              </li>
            </ul>
          </div>
        )}

        {/* Manual entry link shown even when no dropdown */}
        {!open && !selected && query.length === 0 && (
          <button
            type="button"
            onClick={switchToManual}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <PenLine className="size-3" />
            Can&apos;t find it? Enter manually
          </button>
        )}

        {/* Selected place details */}
        {selected && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{selected.address ?? "No address"}</span>
          </p>
        )}
      </div>
    </div>
  );
}
