"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MapPin, PlusCircle } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";
import { CATEGORIES, VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import { formatVendorLocality } from "@/lib/vendor-locality";
import { cn } from "@/lib/utils";
import { type Vendor } from "@/lib/types";

interface VendorWithRecon extends Vendor {
  /** True when this viewer has their own (non-removed) recon on the vendor. */
  hasRecon: boolean;
}

interface HubAccordionProps {
  vendors: VendorWithRecon[];
}

const HUB_RETURN = encodeURIComponent("/hub");

/**
 * Styling for the card's trailing action link.
 *
 * Two non-obvious bits, both verified in the browser:
 * - `cn()` is required, not cosmetic. buttonVariants() alone emits both the
 *   base `border-transparent` and the outline variant's `border-border`; they
 *   have equal specificity, so the stylesheet order decides and the border
 *   comes out invisible. tailwind-merge inside cn() drops the loser.
 * - `no-underline!` needs the important flag: AccordionContent styles every
 *   descendant anchor with `[&_a]:underline`, which out-specifies a plain
 *   utility.
 */
const actionLinkClass = cn(
  buttonVariants({ variant: "outline", size: "sm" }),
  "gap-1 no-underline!",
);

export function HubAccordion({ vendors }: HubAccordionProps) {
  // Group vendors by type, preserving VENDOR_TYPES order.
  const grouped = VENDOR_TYPES.reduce<Record<VendorType, VendorWithRecon[]>>(
    (acc, type) => {
      acc[type] = vendors.filter((v) => v.vendor_type === type);
      return acc;
    },
    {} as Record<VendorType, VendorWithRecon[]>,
  );

  // Only render sections that have at least one vendor.
  const activeSections = VENDOR_TYPES.filter(
    (type) => grouped[type].length > 0,
  );

  // Default-open the first section.
  const defaultOpen = activeSections.length > 0 ? [activeSections[0]] : [];

  // One fetch for every card on the page (the same hook the map feeds use), so
  // collapsed sections are already populated when opened rather than each
  // section firing its own query.
  const ids = React.useMemo(() => vendors.map((v) => v.id), [vendors]);
  const items = useVendorPreviews(ids);
  const itemById = React.useMemo(
    () => new Map((items ?? []).map((i) => [i.id, i])),
    [items],
  );

  return (
    <Accordion
      defaultValue={defaultOpen}
      multiple
      className="divide-y divide-border"
    >
      {activeSections.map((type) => {
        const category = CATEGORIES[type];
        const Icon = category.icon;
        const sectionVendors = grouped[type];

        return (
          <AccordionItem key={type} value={type} className="border-none">
            <AccordionTrigger
              className="px-4 py-3 hover:no-underline"
              style={{ color: category.textHex }}
            >
              <span
                className="flex items-center gap-2 font-semibold text-sm"
              >
                <span
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: category.lightHex,
                    color: category.colorHex,
                  }}
                >
                  <Icon className="size-4" />
                </span>
                <span style={{ color: category.textHex }}>
                  {category.label}
                </span>
                <span
                  className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: category.lightHex,
                    color: category.textHex,
                  }}
                >
                  {sectionVendors.length}
                </span>
              </span>
            </AccordionTrigger>

            <AccordionContent className="px-0 pb-0">
              <ul className="flex flex-col gap-2 px-4 pb-3 pt-1">
                {sectionVendors.map((vendor) => {
                  const item = itemById.get(vendor.id);
                  return (
                    <li key={vendor.id}>
                      {item ? (
                        <VendorPreviewCard
                          item={item}
                          vendorType={vendor.vendor_type}
                          // Redundant here: the card already sits inside this
                          // category's accordion section.
                          showCategoryPill={false}
                          href={`/vendor/${vendor.id}?from=${HUB_RETURN}`}
                          // Only "Add" lives on the card. Editing happens on
                          // the recon entry itself (vendor page), so a vendor
                          // you have already reconned gets no card action.
                          action={
                            vendor.hasRecon ? undefined : (
                              <Link
                                href={`/add?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendor.name)}&vendorType=${vendor.vendor_type}&from=${HUB_RETURN}`}
                                aria-label={`Add recon for ${vendor.name}`}
                                className={actionLinkClass}
                              >
                                <PlusCircle className="size-3.5" />
                                Add
                              </Link>
                            )
                          }
                        />
                      ) : (
                        <HubCardSkeleton
                          name={vendor.name}
                          locality={formatVendorLocality(vendor)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/**
 * Placeholder while previews load. Shows the vendor name and locality (both
 * already known from the server render) so the list reads as real content
 * rather than a bare shimmer, and lands on the same line count as the loaded
 * card so nothing jumps on arrival.
 */
function HubCardSkeleton({
  name,
  locality,
}: {
  name: string;
  locality: string | null;
}) {
  return (
    <div className="flex items-stretch gap-3 overflow-hidden rounded-xl border bg-card p-2">
      <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="block truncate font-heading text-sm font-semibold">
          {name}
        </span>
        {locality && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{locality}</span>
          </span>
        )}
        <span className="text-xs text-muted-foreground">Loading recon…</span>
      </div>
    </div>
  );
}
