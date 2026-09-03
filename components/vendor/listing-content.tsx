"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { ExternalLink } from "@/components/external-link";
import { buttonVariants } from "@/components/ui/button";
import { captureClient } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

/**
 * A verified vendor's self-authored listing content: intro, a CTA button, and a
 * pricing block. Shared by the public vendor page AND the portal editor's live
 * preview, so the vendor sees exactly what a couple will see. One component, one
 * look — change it here and both move.
 *
 * `interactive` distinguishes the two: on the vendor page the CTA is a real
 * ExternalLink and pricing is collapsible; in the preview the CTA is inert and
 * pricing renders expanded.
 */

export interface PricingRow {
  label: string;
  price: string;
  unit?: string;
}

export interface ListingContent {
  intro: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  pricing: PricingRow[];
}

const INTRO_CLAMP_THRESHOLD = 160;

export function VendorListingContent({
  content,
  interactive = true,
  vendorId,
  className,
}: {
  content: ListingContent;
  interactive?: boolean;
  /** Present on the real vendor page (not the editor preview) — enables CTA-click tracking. */
  vendorId?: string;
  className?: string;
}) {
  const [introOpen, setIntroOpen] = React.useState(false);
  const [priceOpen, setPriceOpen] = React.useState(!interactive);

  const { intro, ctaLabel, ctaUrl, pricing } = content;
  const rows = pricing.filter((r) => r.label?.trim() || r.price?.trim());
  const hasAnything = intro?.trim() || (ctaLabel && ctaUrl) || rows.length > 0;
  if (!hasAnything) return null;

  const longIntro = !!intro && intro.length > INTRO_CLAMP_THRESHOLD;

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-muted/30 p-4", className)}>
      {intro?.trim() && (
        <div>
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-line",
              longIntro && !introOpen && "line-clamp-3",
            )}
          >
            {intro}
          </p>
          {longIntro && (
            <button
              type="button"
              onClick={() => setIntroOpen((v) => !v)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {introOpen ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {ctaLabel && ctaUrl && (
        interactive ? (
          <ExternalLink
            href={ctaUrl}
            onClick={() => {
              if (vendorId)
                captureClient("vendor_cta_clicked", {
                  vendor_id: vendorId,
                  cta_label: ctaLabel,
                });
            }}
            className={cn(buttonVariants({ size: "lg" }), "w-full no-underline!")}
          >
            {ctaLabel}
          </ExternalLink>
        ) : (
          <span
            aria-hidden
            className={cn(buttonVariants({ size: "lg" }), "pointer-events-none w-full opacity-90")}
          >
            {ctaLabel}
          </span>
        )
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border bg-background">
          <button
            type="button"
            onClick={() => setPriceOpen((v) => !v)}
            aria-expanded={priceOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          >
            <span>Pricing · provided by vendor</span>
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", priceOpen && "rotate-180")}
            />
          </button>
          {priceOpen && (
            <ul className="divide-y border-t">
              {rows.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">{r.label}</span>
                  <span className="shrink-0 text-right font-medium">
                    {r.price}
                    {r.unit ? (
                      <span className="ml-1 font-normal text-muted-foreground">{r.unit}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
