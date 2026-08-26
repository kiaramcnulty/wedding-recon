"use client";

import * as React from "react";
import type { FilterDef } from "@/lib/constants/vendor-filters";
import { cn } from "@/lib/utils";

/**
 * The vendor's own attribute overrides, edited in the portal. It reads and
 * writes the RAW `vendors.filters` jsonb shape directly — the same shape the
 * matcher (`lib/filters/match.ts`) reads — so what the vendor sets is exactly
 * what ranking and filtering consume, with no translation layer to drift:
 *
 *   multi          -> filters[key]  = string[]   (selected option values)
 *   bool           -> filters[key]  = boolean    (omitted when "unset")
 *   range (point)  -> filters[key]  = number
 *   range (overlap)-> filters[lo] / filters[hi]  = number
 *
 * An unset control omits its key entirely (rather than writing null/[]), so an
 * override never asserts a false negative — silence stays silence.
 *
 * Controlled: `value` is the full overrides object, `onChange` gets the next
 * one. `scripts/test-filter-override-shape.mjs` round-trips this output through
 * the matcher to guarantee the shape stays readable.
 */

type Overrides = Record<string, unknown>;

function setKey(o: Overrides, key: string, val: unknown): Overrides {
  const next = { ...o };
  if (val === undefined) delete next[key];
  else next[key] = val;
  return next;
}

function numOrUndef(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function FilterOverrideEditor({
  defs,
  value,
  onChange,
}: {
  defs: FilterDef[];
  value: Overrides;
  onChange: (next: Overrides) => void;
}) {
  if (defs.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">Details &amp; filters</h3>
        <p className="text-xs text-muted-foreground">
          Set these so couples filtering for what you offer find you. Anything
          you leave blank is left as-is.
        </p>
      </div>

      {defs.map((def) => (
        <div key={def.key} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{def.label}</span>

          {def.kind === "multi" && (
            <div className="flex flex-wrap gap-1.5">
              {(def.options ?? []).map((o) => {
                const arr = Array.isArray(value[def.key])
                  ? (value[def.key] as string[])
                  : [];
                const on = arr.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? arr.filter((x) => x !== o.value)
                        : [...arr, o.value];
                      onChange(setKey(value, def.key, next.length ? next : undefined));
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}

          {def.kind === "bool" && (
            <div className="flex gap-1.5">
              {[
                { label: "Yes", v: true },
                { label: "No", v: false },
                { label: "Unset", v: undefined },
              ].map((opt) => {
                const cur = value[def.key];
                const on = cur === opt.v || (opt.v === undefined && cur === undefined);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(setKey(value, def.key, opt.v))}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {def.kind === "range" && def.mode === "point" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={(value[def.key] as number | undefined) ?? ""}
                onChange={(e) =>
                  onChange(setKey(value, def.key, numOrUndef(e.target.value)))
                }
                placeholder="e.g. 200"
                className="h-9 w-32 rounded-md border bg-background px-3 text-sm"
                aria-label={def.label}
              />
              {def.unit && (
                <span className="text-xs text-muted-foreground">{def.unit}</span>
              )}
            </div>
          )}

          {def.kind === "range" && def.mode !== "point" && (
            <div className="flex items-center gap-2">
              {def.unit === "usd" && (
                <span className="text-sm text-muted-foreground">$</span>
              )}
              <input
                type="number"
                inputMode="numeric"
                value={(value[def.lo ?? def.key] as number | undefined) ?? ""}
                onChange={(e) =>
                  onChange(setKey(value, def.lo ?? def.key, numOrUndef(e.target.value)))
                }
                placeholder="min"
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
                aria-label={`${def.label} minimum`}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="number"
                inputMode="numeric"
                value={(value[def.hi ?? def.key] as number | undefined) ?? ""}
                onChange={(e) =>
                  onChange(setKey(value, def.hi ?? def.key, numOrUndef(e.target.value)))
                }
                placeholder="max"
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
                aria-label={`${def.label} maximum`}
              />
              {def.unit && def.unit !== "usd" && (
                <span className="text-xs text-muted-foreground">{def.unit}</span>
              )}
            </div>
          )}

          {def.hint && (
            <span className="text-xs text-muted-foreground">{def.hint}</span>
          )}
        </div>
      ))}
    </div>
  );
}
