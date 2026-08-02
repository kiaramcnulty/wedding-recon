"use client";

import * as React from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { z } from "zod";

import {
  ALL_VENDOR_TYPES,
  CATEGORIES,
  CATEGORY_LIST,
  RECON_TYPES,
  RECON_TYPE_LABELS,
  usesServiceRegion,
} from "@/lib/constants/categories";
import type { VendorType } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * The recon entry fields, shared by Add Recon (`app/(app)/add/page.tsx`) and
 * Edit Recon (`app/(app)/recon/[id]/edit`). Everything from the vendor-type
 * chips down to the notes box lives here — change a field once and both forms
 * move together.
 *
 * Deliberately NOT included: the vendor picker and the photo uploader. Add
 * resolves a vendor (search / Places / manual) while Edit locks it, and photos
 * are add-only today, so those stay owned by their respective pages.
 */

export const reconFormSchema = z.object({
  // Derived from the single source of truth so new/retired types never drift.
  // ALL_VENDOR_TYPES (not VENDOR_TYPES) so an existing vendor whose canonical
  // type is a legacy value still validates when its chip is locked read-only.
  vendorType: z.enum(ALL_VENDOR_TYPES, {
    error: "Please choose a type of vendor",
  }),
  reconType: z.enum(["online", "virtual", "in_person"], {
    error: "Please choose a type of recon",
  }),
  collectedMonth: z.number().int().min(1).max(12),
  collectedYear: z.number().int().min(2000),
  priceText: z.string().optional(),
  priceDetails: z.string().optional(),
  serviceRegion: z.string().optional(),
  notes: z.string().optional(),
});

export type ReconFormValues = z.infer<typeof reconFormSchema>;

interface ReconFormFieldsProps {
  control: Control<ReconFormValues>;
  errors: FieldErrors<ReconFormValues>;
  /**
   * Render the vendor type as a read-only chip instead of the picker. True
   * whenever the vendor is already resolved — its type is canonical vendor
   * data, not something this form gets to set. Always true when editing.
   */
  lockVendorType: boolean;
  /** Current vendor type value (watched), gating the service-region field. */
  vendorType: VendorType | undefined;
  /** Newest selectable year in the "collected at" dropdown. */
  currentYear: number;
}

export function ReconFormFields({
  control,
  errors,
  lockVendorType,
  vendorType,
  currentYear,
}: ReconFormFieldsProps) {
  return (
    <>
      {/* ── Type of vendor chips ────────────────────────────────────── */}
      <section className="space-y-2">
        <Label>Type of vendor</Label>
        <Controller
          control={control}
          name="vendorType"
          render={({ field }) => {
            // Locked, read-only display for an existing vendor. Resolve via
            // CATEGORIES (not CATEGORY_LIST) so a legacy type still renders.
            if (lockVendorType) {
              const cat = field.value ? CATEGORIES[field.value] : undefined;
              if (!cat) return <></>;
              const Icon = cat.icon;
              return (
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: cat.lightHex,
                    color: cat.textHex,
                    borderColor: cat.colorHex + "44",
                  }}
                >
                  <Icon className="size-3.5" style={{ color: cat.colorHex }} />
                  {cat.label}
                </div>
              );
            }

            return (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Type of vendor"
              >
                {CATEGORY_LIST.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = field.value === cat.type;
                  return (
                    <button
                      key={cat.type}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => field.onChange(cat.type)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                        isActive
                          ? "border-transparent shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
                      )}
                      style={
                        isActive
                          ? {
                              backgroundColor: cat.lightHex,
                              color: cat.textHex,
                              borderColor: cat.colorHex + "44",
                            }
                          : undefined
                      }
                    >
                      <Icon
                        className="size-3.5"
                        style={isActive ? { color: cat.colorHex } : undefined}
                      />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            );
          }}
        />
        {!lockVendorType && errors.vendorType && (
          <p className="text-xs text-destructive">{errors.vendorType.message}</p>
        )}
      </section>

      {/* ── Type of recon segmented control ──────────────────────────── */}
      <section className="space-y-2">
        <Label>Type of recon</Label>
        <Controller
          control={control}
          name="reconType"
          render={({ field }) => (
            <div
              role="group"
              aria-label="Type of recon"
              className="flex overflow-hidden rounded-lg border border-border bg-muted/30"
            >
              {RECON_TYPES.map((rt, idx) => {
                const isActive = field.value === rt;
                return (
                  <button
                    key={rt}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => field.onChange(rt)}
                    className={cn(
                      "flex flex-1 items-center justify-center px-2 py-2 text-xs font-medium transition-colors",
                      idx > 0 && "border-l border-border",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {RECON_TYPE_LABELS[rt]}
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.reconType && (
          <p className="text-xs text-destructive">{errors.reconType.message}</p>
        )}
      </section>

      {/* ── Recon collected at (month & year) ──────────────────────────── */}
      <section className="space-y-2">
        <Label>Recon collected at</Label>
        <div className="flex gap-2">
          {/* Month dropdown */}
          <Controller
            control={control}
            name="collectedMonth"
            render={({ field }) => (
              <select
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                onBlur={field.onBlur}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString("default", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            )}
          />
          {/* Year dropdown */}
          <Controller
            control={control}
            name="collectedYear"
            render={({ field }) => (
              <select
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                onBlur={field.onBlur}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Array.from({ length: currentYear - 2000 + 1 }, (_, i) => 2000 + i)
                  .reverse()
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
              </select>
            )}
          />
        </div>
      </section>

      {/* ── Price quote ───────────────────────────────────────────────── */}
      <section className="space-y-1.5">
        <Label htmlFor="price-text">Price quote</Label>
        <Controller
          control={control}
          name="priceText"
          render={({ field }) => (
            <Input
              id="price-text"
              placeholder="e.g. $5,000–$8,000 or $150/head"
              {...field}
            />
          )}
        />
      </section>

      {/* ── Price details ─────────────────────────────────────────────── */}
      <section className="space-y-1.5">
        <Label htmlFor="price-details">Price details</Label>
        <Controller
          control={control}
          name="priceDetails"
          render={({ field }) => (
            <Textarea
              id="price-details"
              placeholder="What's included, minimums, service fees…"
              rows={2}
              {...field}
            />
          )}
        />
      </section>

      {/* ── Service region (non-venue, non-hotel vendors only) ──────────── */}
      {usesServiceRegion(vendorType) && (
        <section className="space-y-1.5">
          <Label htmlFor="service-region">Service region</Label>
          <Controller
            control={control}
            name="serviceRegion"
            render={({ field }) => (
              <Input
                id="service-region"
                placeholder="e.g. NYC metro or Western Colorado"
                {...field}
              />
            )}
          />
        </section>
      )}

      {/* ── Recon notes ───────────────────────────────────────────────── */}
      <section className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea
              id="notes"
              placeholder="Vibe, availability, any red flags…"
              rows={3}
              {...field}
            />
          )}
        />
      </section>
    </>
  );
}
