import { Bookmark, Search, SlidersHorizontal, Star } from "lucide-react";

import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import type { AppVisual as AppVisualKey } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/**
 * Stylised mock-ups of the product, drawn in code rather than screenshotted.
 *
 * Three reasons they are drawings: they stay sharp at any size and cost no
 * bytes; they take their category colours straight from CATEGORIES, so the
 * marketing page cannot drift from the palette on the real map; and they let us
 * show the SHAPE of a screen without inventing a vendor name or hanging a
 * fabricated price on a real business - a screenshot reads as authoritative in
 * a way an illustration does not.
 *
 * Everything shown is generic on purpose: a category, a county, a price band.
 * If you add a panel, keep it that way.
 *
 * SWAP POINT: to move to real screenshots, replace the switch below with an
 * <img>, captured from a session that has DB credentials.
 */
export function AppVisual({
  variant,
  bare,
  className,
}: {
  variant: AppVisualKey;
  /** Drop the panel chrome when nested inside another panel (the stepper). */
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      // Decorative: every one of these restates something already said in the
      // prose beside it, so it is hidden from assistive tech rather than
      // narrated twice.
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden",
        bare
          ? "p-0"
          : "rounded-2xl border border-brand/15 bg-brand-soft/40 p-4",
        className,
      )}
    >
      {variant === "map" && <MapPanel />}
      {variant === "filters" && <FiltersPanel />}
      {variant === "intel" && <IntelPanel />}
      {variant === "reviews" && <ReviewsPanel />}
      {variant === "hub" && <HubPanel />}
    </div>
  );
}

/** A category chip exactly as the Explore filter row draws one. */
function Chip({ type, active }: { type: VendorType; active?: boolean }) {
  const { icon: Icon, label, colorHex, textHex } = CATEGORIES[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium shadow-sm"
      style={
        active
          ? { backgroundColor: colorHex, color: "#fff" }
          : { backgroundColor: "#fff", color: textHex }
      }
    >
      <Icon className="size-3" style={active ? undefined : { color: colorHex }} />
      {label}
    </span>
  );
}

function Pin({ type, left, top }: { type: VendorType; left: string; top: string }) {
  const { icon: Icon, colorHex } = CATEGORIES[type];
  return (
    <span
      className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white"
      style={{ left, top, backgroundColor: colorHex }}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

function MapPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
        <Search className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          Search a city or area
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip type="venue" active />
        <Chip type="photos" />
        <Chip type="flowers" />
        <Chip type="hotel" />
      </div>
      <div className="relative h-40 overflow-hidden rounded-xl bg-white/70">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in srgb, var(--brand) 30%, transparent) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <Pin type="venue" left="24%" top="30%" />
        <Pin type="venue" left="58%" top="22%" />
        <Pin type="venue" left="42%" top="58%" />
        <Pin type="venue" left="76%" top="62%" />
        <div className="absolute bottom-2 left-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-medium shadow-sm">
          38 venues on screen
        </div>
      </div>
    </div>
  );
}

function FiltersPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
        <SlidersHorizontal className="size-3.5 text-brand" />
        <span className="text-[11px] font-medium">Venues under $5k</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          142 match
        </span>
      </div>
      {[
        { price: "$3,200", detail: "site fee, Friday in June" },
        { price: "$4,800", detail: "site fee, Saturday in October" },
      ].map((row) => (
        <div key={row.price} className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-lg font-semibold">
              {row.price}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {row.detail}
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              In person
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Collected 2026
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hotel blocks, because their intel looks nothing like a florist's. */
function IntelPanel() {
  const { icon: Icon, colorHex, lightHex, textHex } = CATEGORIES.hotel;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: lightHex, color: colorHex }}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="text-[11px] font-medium" style={{ color: textHex }}>
          Hotel block
        </span>
      </div>
      <div className="space-y-1.5 rounded-xl bg-white p-3 shadow-sm">
        {[
          ["Block type", "Courtesy, no attrition"],
          ["Minimum rooms", "10"],
          ["Cut-off date", "30 days before"],
          ["Who books", "Guests, direct"],
          ["Parking", "Free, self-park"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] text-muted-foreground">{k}</span>
            <span className="text-[10px] font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsPanel() {
  return (
    <div className="space-y-2.5">
      {[
        {
          tag: "In person",
          text: "Ran exactly to the timeline we agreed. Setup was done before the first guest arrived.",
        },
        {
          tag: "Virtual call",
          text: "Answered every question about the contract without being asked twice.",
        },
      ].map((row) => (
        <div key={row.tag} className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-soft text-[9px] font-semibold text-brand-ink">
              A
            </span>
            <span className="text-[10px] font-medium">anonymous</span>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
              {row.tag}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {row.text}
          </p>
        </div>
      ))}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Star className="size-3 text-brand" />3 recon entries
      </div>
    </div>
  );
}

function HubPanel() {
  const rows: { type: VendorType; saved: number }[] = [
    { type: "venue", saved: 4 },
    { type: "photos", saved: 3 },
    { type: "flowers", saved: 2 },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Bookmark className="size-3.5 text-brand" />
        <span className="text-[11px] font-medium">Planning Hub</span>
      </div>
      {rows.map(({ type, saved }) => {
        const { icon: Icon, label, colorHex, lightHex } = CATEGORIES[type];
        return (
          <div
            key={type}
            className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm"
          >
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: lightHex, color: colorHex }}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="text-[11px] font-medium">{label}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {saved} saved
            </span>
          </div>
        );
      })}
    </div>
  );
}
