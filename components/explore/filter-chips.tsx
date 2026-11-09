"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/explore/bottom-sheet";
import { CATEGORIES, VENDOR_TYPES } from "@/lib/constants/categories";
import { DAY_TYPES, filtersForType, type FilterDef } from "@/lib/constants/vendor-filters";
import {
  GUIDED_CONTROLS,
  advancedCount,
  advancedDefs,
  asksDay,
  type GuidedPrefs,
  type GuidedType,
  type RadiusSetting,
} from "@/lib/search/guided";
import { cn } from "@/lib/utils";

/**
 * Explore's filters for ONE vendor type, as a row of chips over the map:
 * each of the type's default controls (the same `GUIDED_CONTROLS` the journey
 * asks) and More (Advanced). The type itself is the pill in the search bar
 * ("[Venue] near [Denver]", see `TypeSheet`); distance is the slider at the
 * bottom of the frame (`DistanceSlider`). A chip opens a focused sheet
 * that keeps a draft until Apply, so closing it discards the change; the
 * Apply button shows how many matches the draft would give before it is
 * applied. A "must have" checkbox control is a chip that toggles in place.
 *
 * The answers themselves are the journey's (`byType[type]`), so a budget set
 * here is the budget the journey shows, and the reverse.
 */

export type MatchCount = { confirmed: number; partial: number } | null;

type Sheet =
  | { kind: "budget" }
  | { kind: "guests" }
  | { kind: "pick"; key: string }
  | { kind: "more" };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

function parseAmount(raw: string): number | undefined {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function defOf(type: GuidedType, key: string): FilterDef | undefined {
  return filtersForType(type).find((d) => d.key === key);
}

function optionLabel(def: FilterDef | undefined, v: string) {
  return def?.options?.find((o) => o.value === v)?.label ?? v;
}

export function FilterChips({
  type,
  prefs,
  guestCount,
  onPrefs,
  onGuests,
  countFor,
}: {
  type: GuidedType;
  prefs: GuidedPrefs;
  guestCount?: number;
  onPrefs: (p: GuidedPrefs) => void;
  onGuests: (n: number | undefined) => void;
  /** Matches a draft would give, for the sheets' Apply buttons. */
  countFor: (p: GuidedPrefs, guests: number | undefined) => MatchCount;
}) {
  const [sheet, setSheet] = React.useState<Sheet | null>(null);
  const close = () => setSheet(null);
  const c = CATEGORIES[type];
  const controls = GUIDED_CONTROLS[type];
  const more = advancedDefs(type).length > 0 || asksDay(type);
  const moreCount = advancedCount(type, prefs);
  const usesGuests = !!controls.guests || type === "food";

  const toggleFlag = (key: string) => {
    const flags = { ...(prefs.flags ?? {}) };
    if (flags[key]) delete flags[key];
    else flags[key] = true;
    onPrefs({ ...prefs, flags });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {controls.budget && (
          <Chip active={!!prefs.budget} accent={c} onClick={() => setSheet({ kind: "budget" })}>
            {prefs.budget ? controls.budget.pill(money(prefs.budget)) : "Budget"}
          </Chip>
        )}
        {usesGuests && (
          <Chip active={!!guestCount} accent={c} onClick={() => setSheet({ kind: "guests" })}>
            {guestCount ? `${guestCount} guests` : "Guests"}
          </Chip>
        )}
        {controls.picks.map(({ key, label }) => {
          const def = defOf(type, key);
          const chosen = prefs.picks?.[key] ?? [];
          const name = label ?? def?.label ?? key;
          return (
            <Chip key={key} active={chosen.length > 0} accent={c} onClick={() => setSheet({ kind: "pick", key })}>
              {chosen.length === 1 ? optionLabel(def, chosen[0]) : chosen.length > 1 ? `${name} · ${chosen.length}` : name}
            </Chip>
          );
        })}
        {controls.flags.map(({ key, label }) => (
          <Chip
            key={key}
            active={!!prefs.flags?.[key]}
            accent={c}
            aria-pressed={!!prefs.flags?.[key]}
            onClick={() => toggleFlag(key)}
          >
            {label ?? defOf(type, key)?.label ?? key}
          </Chip>
        ))}
        {more && (
          <Chip active={moreCount > 0} accent={c} onClick={() => setSheet({ kind: "more" })}>
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {moreCount ? `More · ${moreCount}` : "More"}
          </Chip>
        )}
      </div>


      {sheet?.kind === "budget" && controls.budget && (
        <AmountSheet
          title={controls.budget.label}
          placeholder={controls.budget.placeholder}
          prefix="$"
          initial={prefs.budget}
          count={(v) => countFor({ ...prefs, budget: v }, guestCount)}
          onApply={(v) => {
            const next = { ...prefs };
            if (v) next.budget = v;
            else delete next.budget;
            onPrefs(next);
            close();
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "guests" && (
        <AmountSheet
          title="Guest count"
          placeholder="120"
          initial={guestCount}
          whole
          count={(v) => countFor(prefs, v)}
          onApply={(v) => {
            onGuests(v);
            close();
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "pick" && (
        <PickSheet
          type={type}
          defKey={sheet.key}
          title={controls.picks.find((p) => p.key === sheet.key)?.label ?? defOf(type, sheet.key)?.label ?? ""}
          initial={prefs.picks?.[sheet.key] ?? []}
          count={(v) => countFor(withPick(prefs, sheet.key, v), guestCount)}
          onApply={(v) => {
            onPrefs(withPick(prefs, sheet.key, v));
            close();
          }}
          onClose={close}
        />
      )}


      {sheet?.kind === "more" && (
        <MoreSheet
          type={type}
          initial={prefs}
          count={(p) => countFor(p, guestCount)}
          onApply={(p) => {
            onPrefs(p);
            close();
          }}
          onClose={close}
        />
      )}
    </>
  );
}

function withPick(prefs: GuidedPrefs, key: string, values: string[]): GuidedPrefs {
  const picks = { ...(prefs.picks ?? {}) };
  if (values.length) picks[key] = values;
  else delete picks[key];
  return { ...prefs, picks };
}

function Chip({
  active,
  accent,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; accent?: { lightHex: string; textHex: string } }) {
  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto flex h-8 shrink-0 items-center gap-1 rounded-full border bg-background/95 px-3 text-[13px] font-medium shadow-sm backdrop-blur-sm transition-colors",
        active ? "border-transparent" : "hover:border-foreground",
        className,
      )}
      style={style ?? (active && accent ? { backgroundColor: accent.lightHex, color: accent.textHex } : undefined)}
      {...props}
    >
      {children}
    </button>
  );
}

function applyLabel(n: MatchCount) {
  if (!n) return "Apply";
  if (n.confirmed === 0 && n.partial > 0) return `Show ${n.partial} partial`;
  return `Show ${n.confirmed} ${n.confirmed === 1 ? "match" : "matches"}`;
}

function SheetFooter({ count, onClear, onApply }: { count: MatchCount; onClear: () => void; onApply: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" className="h-11" onClick={onClear}>
        Clear
      </Button>
      <Button className="h-11 flex-1 text-base" onClick={onApply}>
        {applyLabel(count)}
      </Button>
    </div>
  );
}

function AmountSheet({
  title,
  placeholder,
  prefix,
  initial,
  whole,
  count,
  onApply,
  onClose,
}: {
  title: string;
  placeholder: string;
  prefix?: string;
  initial?: number;
  whole?: boolean;
  count: (v: number | undefined) => MatchCount;
  onApply: (v: number | undefined) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = React.useState(initial ? String(initial) : "");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const value = whole ? (raw.trim() ? Number(raw) : undefined) : parseAmount(raw);
  const invalid =
    raw.trim() !== "" &&
    (value === undefined || (whole && !(Number.isInteger(value) && value > 0 && value < 5000)));
  // While a number is half-typed, keep counting the last valid one.
  const [lastValid, setLastValid] = React.useState(initial);
  const shown = invalid ? lastValid : value;
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={title}
      initialFocus={inputRef}
      footer={
        <SheetFooter
          count={count(shown)}
          onClear={() => setRaw("")}
          onApply={() => !invalid && onApply(value)}
        />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onApply(value);
        }}
      >
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {prefix}
            </span>
          )}
          <Input
            ref={inputRef}
            inputMode="numeric"
            aria-label={title}
            placeholder={`e.g. ${placeholder}`}
            className={cn("h-11 text-base", prefix && "pl-7")}
            value={raw}
            aria-invalid={invalid}
            onChange={(e) => {
              const next = whole ? e.target.value.replace(/[^\d]/g, "") : e.target.value;
              setRaw(next);
              const v = whole ? (next.trim() ? Number(next) : undefined) : parseAmount(next);
              // Only a value Apply would accept moves the count.
              const ok = v === undefined || !whole || (Number.isInteger(v) && v > 0 && v < 5000);
              if (next.trim() === "" || (v !== undefined && ok)) setLastValid(v);
            }}
          />
        </div>
        {invalid && (
          <p className="mt-1 text-sm text-destructive">
            {whole ? "Enter a whole number of guests." : "Enter a dollar amount."}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}

function OptionChips({
  def,
  chosen,
  onToggle,
  accent,
}: {
  def: FilterDef;
  chosen: string[];
  onToggle: (v: string) => void;
  accent: { lightHex: string; textHex: string };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(def.options ?? []).map((o) => {
        const on = chosen.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={cn(
              "min-h-9 rounded-full border px-3 py-1.5 text-sm transition",
              on ? "border-transparent font-medium" : "hover:border-foreground",
            )}
            style={on ? { backgroundColor: accent.lightHex, color: accent.textHex } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const toggled = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function PickSheet({
  type,
  defKey,
  title,
  initial,
  count,
  onApply,
  onClose,
}: {
  type: GuidedType;
  defKey: string;
  title: string;
  initial: string[];
  count: (v: string[]) => MatchCount;
  onApply: (v: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = React.useState(initial);
  const def = defOf(type, defKey);
  if (!def) return null;
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={title}
      footer={<SheetFooter count={count(chosen)} onClear={() => setChosen([])} onApply={() => onApply(chosen)} />}
    >
      <p className="mb-3 text-sm text-muted-foreground">Pick any.</p>
      <OptionChips def={def} chosen={chosen} accent={CATEGORIES[type]} onToggle={(v) => setChosen((c) => toggled(c, v))} />
    </BottomSheet>
  );
}

/**
 * Distance, inline over the map in 5-mile steps. Applies live, so the ring
 * moves with the thumb (matching is local, on the vendors already loaded: no
 * request per drag). The track takes the row; its gaps are not map.
 */
export function DistanceSlider({
  radiusMiles,
  maxMiles,
  accent,
  onRadius,
}: {
  radiusMiles: number;
  maxMiles: number;
  accent: string;
  onRadius: (r: RadiusSetting) => void;
}) {
  return (
    <label className="pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border bg-background/95 px-4 shadow-md backdrop-blur-sm">
      <span className="w-14 shrink-0 text-[13px] font-medium tabular-nums">{radiusMiles} mi</span>
      <input
        type="range"
        min={5}
        max={maxMiles}
        step={5}
        value={Math.min(radiusMiles, maxMiles)}
        aria-label="Search distance in miles"
        aria-valuetext={`${radiusMiles} miles`}
        onChange={(e) => onRadius({ mode: "manual", miles: Number(e.target.value) })}
        className="min-w-0 flex-1"
        style={{ accentColor: accent }}
      />
    </label>
  );
}

/** The vendor type grid, opened from the type pill in Explore's search bar. */
export function TypeSheet({
  open,
  type,
  onType,
  onClose,
}: {
  open: boolean;
  type: GuidedType;
  onType: (t: GuidedType) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Vendor type">
      <div className="grid grid-cols-2 gap-2">
        {VENDOR_TYPES.map((t) => {
          const m = CATEGORIES[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                onType(t);
                onClose();
              }}
              aria-pressed={t === type}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm font-medium transition-colors",
                t === type ? "border-transparent" : "hover:border-foreground",
              )}
              style={t === type ? { backgroundColor: m.lightHex, color: m.textHex } : undefined}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: m.lightHex, color: m.textHex }}
              >
                <m.icon className="size-3.5" aria-hidden />
              </span>
              {m.label}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

/** Advanced: every other filter the type has, as one draft. */
/**
 * The type's Advanced filters: everything its default controls do not show
 * (`advancedDefs`). Shared by Explore's More chip and the journey's
 * preferences step, so the two can never list different filters. Keeps a
 * draft until Apply; closing discards it. Without `count` (the journey has no
 * results yet) the button just says Apply.
 */
export function MoreSheet({
  type,
  initial,
  count = () => null,
  onApply,
  onClose,
}: {
  type: GuidedType;
  initial: GuidedPrefs;
  count?: (p: GuidedPrefs) => MatchCount;
  onApply: (p: GuidedPrefs) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState<GuidedPrefs>(initial);
  // Bumped by Clear, to remount the limit fields: they keep their own text.
  const [cleared, setCleared] = React.useState(0);
  const defs = advancedDefs(type);
  const accent = CATEGORIES[type];
  const clearAdvanced = () => {
    const picks = { ...(draft.picks ?? {}) };
    const flags = { ...(draft.flags ?? {}) };
    for (const d of defs) {
      delete picks[d.key];
      delete flags[d.key];
    }
    setDraft({ ...draft, picks, flags, limits: {}, day: undefined });
    setCleared((n) => n + 1);
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`More ${CATEGORIES[type].label.toLowerCase()} filters`}
      footer={<SheetFooter count={count(draft)} onClear={clearAdvanced} onApply={() => onApply(draft)} />}
    >
      <div className="flex flex-col gap-6">
        {defs.map((d) => {
          const rare = d.rare && <span className="font-normal text-muted-foreground"> · few vendors list this</span>;
          if (d.kind === "multi") {
            return (
              <fieldset key={d.key}>
                <legend className="mb-2 text-sm font-medium">
                  {d.label}
                  {rare}
                </legend>
                <OptionChips
                  def={d}
                  chosen={draft.picks?.[d.key] ?? []}
                  accent={accent}
                  onToggle={(v) => setDraft(withPick(draft, d.key, toggled(draft.picks?.[d.key] ?? [], v)))}
                />
              </fieldset>
            );
          }
          if (d.kind === "bool") {
            return (
              <label key={d.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3">
                <input
                  type="checkbox"
                  className="size-5 shrink-0"
                  style={{ accentColor: accent.colorHex }}
                  checked={draft.flags?.[d.key] === true}
                  onChange={(e) => {
                    const flags = { ...(draft.flags ?? {}) };
                    if (e.target.checked) flags[d.key] = true;
                    else delete flags[d.key];
                    setDraft({ ...draft, flags });
                  }}
                />
                <span className="text-sm font-medium">
                  {d.label}
                  {rare}
                </span>
              </label>
            );
          }
          return (
            <LimitField
              key={`${d.key}:${cleared}`}
              def={d}
              value={draft.limits?.[d.key]}
              onChange={(v) => {
                const limits = { ...(draft.limits ?? {}) };
                if (v) limits[d.key] = v;
                else delete limits[d.key];
                setDraft({ ...draft, limits });
              }}
            />
          );
        })}
        {asksDay(type) && (
          <label className="flex flex-col gap-2 text-sm font-medium">
            Day of the week
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={draft.day ?? ""}
              onChange={(e) => setDraft({ ...draft, day: e.target.value || undefined })}
            >
              <option value="">Any day</option>
              {DAY_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              Prices are judged on that day&apos;s rate where the venue lists one.
            </span>
          </label>
        )}
      </div>
    </BottomSheet>
  );
}

/** An "up to" limit on one of the type's other ranges. */
function LimitField({
  def,
  value,
  onChange,
}: {
  def: FilterDef;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  const [raw, setRaw] = React.useState(value ? String(value) : "");
  const usd = def.unit === "usd";
  const id = `limit-${def.key}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {def.label} <span className="font-normal text-muted-foreground">{usd ? "(up to)" : "(at most)"}</span>
      </label>
      <div className="relative flex items-center">
        {usd && <span className="pointer-events-none absolute left-3 text-muted-foreground">$</span>}
        <Input
          id={id}
          inputMode="numeric"
          className={cn("h-10 text-base", usd && "pl-7", def.unit === "weeks" && "pr-16")}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            const n = parseAmount(e.target.value);
            if (e.target.value.trim() === "" || n !== undefined) onChange(n);
          }}
        />
        {def.unit === "weeks" && <span className="pointer-events-none absolute right-3 text-muted-foreground">weeks</span>}
      </div>
    </div>
  );
}
