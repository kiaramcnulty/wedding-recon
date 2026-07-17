"use client";

import { CATEGORY_LIST, type VendorType } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

interface VendorTypeFilterProps {
  /** Currently selected vendor types. Empty array = show all (no filter). */
  selected: VendorType[];
  /** Called with the next selection whenever a chip is toggled. */
  onChange: (next: VendorType[]) => void;
  className?: string;
}

/**
 * Explore-map filter: a horizontally scrollable row of category chips beneath
 * the search bar. Multi-select — tap chips to narrow the map to those vendor
 * types (OR across the selection). An empty selection means "show all", surfaced
 * as a highlighted **All** chip that also resets.
 *
 * Selected chips fill with the category's own color (the same hue as its map
 * pins), so the row doubles as the map's color legend. Unselected chips are the
 * same translucent-white pill as the other floating map controls, with a
 * category-colored icon as a quieter legend hint. Filtering itself is a cheap
 * layer-visibility toggle in vendor-map.tsx — no refetch.
 */
export function VendorTypeFilter({
  selected,
  onChange,
  className,
}: VendorTypeFilterProps) {
  const allActive = selected.length === 0;

  function toggle(type: VendorType) {
    onChange(
      selected.includes(type)
        ? selected.filter((t) => t !== type)
        : [...selected, type],
    );
  }

  return (
    <div
      role="group"
      aria-label="Filter vendors by type"
      className={cn(
        // Hide the scrollbar (chips overflow past ~5 on a phone) but keep the
        // row swipeable; slight vertical padding so shadows aren't clipped.
        "flex items-center gap-2 overflow-x-auto py-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={allActive}
        className={cn(
          "flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm transition-colors",
          allActive
            ? "bg-foreground text-background"
            : "bg-background/95 text-muted-foreground hover:text-foreground",
        )}
      >
        All
      </button>

      {CATEGORY_LIST.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selected.includes(cat.type);
        return (
          <button
            key={cat.type}
            type="button"
            onClick={() => toggle(cat.type)}
            aria-pressed={isSelected}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm transition-colors",
              !isSelected && "bg-background/95 text-foreground hover:bg-background",
            )}
            // Category color is data (categories.ts), so it stays inline — same
            // pattern the cluster-list chips use.
            style={
              isSelected
                ? { backgroundColor: cat.colorHex, color: "#fff" }
                : undefined
            }
          >
            <Icon
              className="size-3.5 shrink-0"
              style={isSelected ? undefined : { color: cat.colorHex }}
              aria-hidden
            />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
