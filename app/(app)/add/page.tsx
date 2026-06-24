"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

import { CATEGORY_LIST, RECON_TYPES, RECON_TYPE_LABELS, VENDOR_TYPES } from "@/lib/constants/categories";
import type { VendorType, ReconType } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlacesCombobox } from "@/components/add/places-combobox";
import type { PlaceSelection, ManualSelection } from "@/components/add/places-combobox";
import { ImageUpload } from "@/components/add/image-upload";
import { BrandFooter } from "@/components/brand-lockup";
import { ProfileMenu } from "@/components/profile-menu";
import { createRecon } from "./actions";

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  vendorType: z.enum(["venue", "food", "music", "flowers", "dress", "planner", "photos", "other"], {
    error: "Please choose a type of business",
  }),
  reconType: z.enum(["online", "virtual", "in_person"], {
    error: "Please choose a type of recon",
  }),
  priceText: z.string().optional(),
  priceDetails: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Vendor state — managed outside react-hook-form since it comes from the
//    PlacesCombobox component, not a plain input ─────────────────────────────

interface VendorState {
  mode: "none" | "google" | "manual";
  // Google Places
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  placeCity?: string;
  placeRegion?: string;
  placeLat?: number | null;
  placeLng?: number | null;
  // Manual
  manualName?: string;
  manualCity?: string;
}

// ── Inner form (needs useSearchParams — must be in a Suspense boundary) ───────

function AddReconForm() {
  const searchParams = useSearchParams();
  const preVendorId = searchParams.get("vendorId") ?? undefined;
  const preVendorName = searchParams.get("vendorName") ?? undefined;
  const rawVendorType = searchParams.get("vendorType");
  const preVendorType: VendorType | undefined =
    rawVendorType && (VENDOR_TYPES as readonly string[]).includes(rawVendorType)
      ? (rawVendorType as VendorType)
      : undefined;

  // For an already-resolved vendor the business type is canonical vendor data
  // and is ignored by the server action, so it's locked (display-only) rather
  // than presented as an editable — but no-op — control. New vendors (Places /
  // manual) keep it editable, since there the submitter sets the vendor's type.
  const lockVendorType = !!preVendorId && !!preVendorType;

  // Show a back button only when the user arrived from another page (Planning
  // Hub or a vendor page reached via Explore/Hub), which passes a `from` return
  // path. Arriving via the "+" tab has no `from`, so no back button is shown.
  // Restrict to internal paths to avoid an open-redirect through the link.
  const rawFrom = searchParams.get("from");
  const backHref =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : null;

  const [vendorState, setVendorState] = React.useState<VendorState>({
    mode: preVendorId ? "google" : "none",
  });
  const [images, setImages] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [vendorError, setVendorError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: preVendorType ? { vendorType: preVendorType } : undefined,
  });

  function handlePlaceSelect(place: PlaceSelection) {
    // Parse city/region from secondaryText heuristic (e.g. "Denver, CO, USA")
    const parts = (place.address ?? "").split(",").map((s) => s.trim());
    const city = parts[parts.length - 3] ?? parts[0] ?? undefined;
    const region = parts[parts.length - 2] ?? undefined;

    setVendorState({
      mode: "google",
      placeId: place.placeId,
      placeName: place.name,
      placeAddress: place.address ?? undefined,
      placeCity: city,
      placeRegion: region,
      placeLat: place.lat,
      placeLng: place.lng,
    });
    setVendorError(null);
  }

  function handleManualSelect(entry: ManualSelection) {
    setVendorState({
      mode: "manual",
      manualName: entry.name,
      manualCity: entry.city,
    });
    setVendorError(null);
  }

  function handleVendorClear() {
    if (!preVendorId) {
      setVendorState({ mode: "none" });
    }
  }

  async function onSubmit(values: FormValues) {
    // Validate vendor selection
    if (!preVendorId && vendorState.mode === "none") {
      setVendorError("Please search for or enter a business name");
      return;
    }

    setIsSubmitting(true);
    setVendorError(null);

    try {
      // Build FormData — images as File entries, structured data as JSON
      const fd = new FormData();

      const inputPayload = {
        // Vendor resolution
        ...(preVendorId ? { vendorId: preVendorId } : {}),
        ...(vendorState.mode === "google"
          ? {
              placeId: vendorState.placeId,
              placeName: vendorState.placeName,
              placeAddress: vendorState.placeAddress,
              placeCity: vendorState.placeCity,
              placeRegion: vendorState.placeRegion,
              placeLat: vendorState.placeLat,
              placeLng: vendorState.placeLng,
            }
          : {}),
        ...(vendorState.mode === "manual"
          ? {
              manualName: vendorState.manualName,
              manualCity: vendorState.manualCity,
            }
          : {}),
        // Recon
        vendorType: values.vendorType as VendorType,
        reconType: values.reconType as ReconType,
        priceText: values.priceText,
        priceDetails: values.priceDetails,
        notes: values.notes,
      };

      fd.append("__input", JSON.stringify(inputPayload));

      images.forEach((file) => {
        fd.append("images[]", file);
      });

      // createRecon is a server action that redirects on success
      await createRecon(fd);
    } catch (err) {
      // If it's a NEXT_REDIRECT error, Next will handle it — don't toast
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("NEXT_REDIRECT")) return;
      toast.error(msg);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {backHref && (
          <Link href={backHref} aria-label="Go back">
            <ChevronLeft className="size-5 text-muted-foreground" />
          </Link>
        )}
        <h1 className="text-base font-semibold">Add recon</h1>
        <ProfileMenu className="ml-auto shrink-0" />
      </header>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5"
        noValidate
      >
        {/* ── Business name ─────────────────────────────────────────────── */}
        <section className="space-y-1.5">
          <PlacesCombobox
            lockedName={preVendorName}
            onSelectPlace={handlePlaceSelect}
            onSelectManual={handleManualSelect}
            onClear={handleVendorClear}
          />
          {vendorError && (
            <p className="text-xs text-destructive">{vendorError}</p>
          )}
        </section>

        {/* ── Type of business chips ────────────────────────────────────── */}
        <section className="space-y-2">
          <Label>Type of business</Label>
          <Controller
            control={control}
            name="vendorType"
            render={({ field }) => {
              // Locked, read-only display for an existing vendor.
              if (lockVendorType) {
                const cat = CATEGORY_LIST.find((c) => c.type === field.value);
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
                <div className="flex flex-wrap gap-2" role="group" aria-label="Type of business">
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

        {/* ── Photos ────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <Label>Photos</Label>
          <ImageUpload onChange={setImages} maxImages={5} />
        </section>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <div className="pb-4 pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Publish recon"
            )}
          </Button>
        </div>

        <BrandFooter className="mt-2" />
      </form>
    </div>
  );
}

// ── Page export — wraps the inner form in Suspense (required by Next 16 for
//    any component that reads useSearchParams) ──────────────────────────────

export default function AddReconPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AddReconForm />
    </React.Suspense>
  );
}
