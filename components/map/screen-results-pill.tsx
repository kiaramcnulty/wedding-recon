"use client";

import { List } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenResultsPillProps {
  /** How many vendors are in the viewport right now, after the type filter. */
  total: number;
  onClick: () => void;
  className?: string;
}

/**
 * "See all 24 results on screen" — the entry point to the full list of what the
 * map is currently showing. Floats under the type filter; the count is live, so
 * it tracks every pan and zoom (and the filter) rather than a fixed search.
 *
 * Renders nothing when the viewport is empty: a "0 results" pill is noise, and
 * the empty map already says it.
 */
export function ScreenResultsPill({
  total,
  onClick,
  className,
}: ScreenResultsPillProps) {
  if (total < 1) return null;

  const label =
    total === 1 ? "See 1 result on screen" : `See all ${total} results on screen`;

  return (
    <button
      type="button"
      onClick={onClick}
      // aria-live so a screen reader hears the count settle after a pan, rather
      // than only on focus.
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-xs font-medium text-background shadow-lg transition-opacity hover:opacity-90",
        className,
      )}
    >
      <List className="size-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
