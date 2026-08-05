"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import { VendorTypeFilter } from "@/components/map/vendor-type-filter";
import { cn } from "@/lib/utils";

/**
 * Compact category control for Explore.
 *
 * The category chips used to sit permanently under the search bar, wrapping to
 * three rows, and with the results pill below that they took roughly 150px off
 * the top of a 812px phone — a fifth of the map, spent on a control that is
 * touched once and then not again for the rest of a session. This collapses
 * them to a single chip that names the current selection and opens the full
 * grid on demand.
 *
 * The grid itself is unchanged (`VendorTypeFilter`), so the colour legend and
 * multi-select behaviour are exactly as before once opened — the chips are only
 * moved, not redesigned.
 */
export function CategoryPicker({
  selected,
  onChange,
  className,
}: {
  selected: VendorType[];
  onChange: (next: VendorType[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const one = selected.length === 1 ? CATEGORIES[selected[0]] : null;
  const Icon = one?.icon;

  const label =
    selected.length === 0
      ? "All vendors"
      : selected.length === 1
        ? one!.label
        : `${selected.length} categories`;

  const sheet = (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close categories"
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />
      <div className="relative rounded-t-2xl border-t border-border bg-background p-4 shadow-2xl">
        <div className="mb-3 flex items-center">
          <h2 className="text-[15px] font-semibold">Categories</h2>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="ml-2 text-[13px] text-muted-foreground underline underline-offset-2"
            >
              Show all
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="ml-auto rounded-full p-1.5 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <VendorTypeFilter selected={selected} onChange={onChange} />
        <p className="mt-3 text-[12px] text-muted-foreground">
          Pick a single category to filter it in detail.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={
          one
            ? { backgroundColor: one.colorHex, borderColor: one.colorHex }
            : undefined
        }
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] shadow-sm transition-colors",
          one
            ? "font-medium text-white"
            : "border-border bg-background/95 backdrop-blur",
          className,
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        {label}
        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
      {open && mounted && createPortal(sheet, document.body)}
    </>
  );
}
