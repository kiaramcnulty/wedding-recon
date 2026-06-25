"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Mail } from "lucide-react";

import { CATEGORY_LIST, RECON_TYPES, RECON_TYPE_LABELS, VENDOR_TYPES } from "@/lib/constants/categories";
import type { VendorType, ReconType } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  clearReconDraft,
  clearResumeFlag,
  DRAFT_TTL_MS,
  loadReconDraft,
  saveReconDraft,
  setResumeFlag,
  type ReconDraft,
} from "@/lib/recon-draft";
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

  // Guests publish via a magic link: the form (incl. photos) is stashed locally
  // and re-published once they authenticate. `resume=1` marks that return trip.
  const isResume = searchParams.get("resume") === "1";

  const [vendorState, setVendorState] = React.useState<VendorState>({
    mode: preVendorId ? "google" : "none",
  });
  const [images, setImages] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [vendorError, setVendorError] = React.useState<string | null>(null);

  // Auth gates which submit path runs and whether the email field is shown.
  const [authState, setAuthState] = React.useState<"loading" | "guest" | "user">(
    "loading",
  );
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  // Email address we sent a magic link to; non-null swaps in the "check email" view.
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  // Resume lifecycle: auto-publishing the saved draft, or its draft went missing.
  const [resumeStatus, setResumeStatus] = React.useState<
    "idle" | "publishing" | "missing"
  >(isResume ? "publishing" : "idle");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: preVendorType ? { vendorType: preVendorType } : undefined,
  });

  // Build the structured `__input` payload from the current form + vendor state.
  // Shared by the immediate (authed) publish and the saved guest draft so resume
  // republishes byte-for-byte identical data.
  const buildInputPayload = React.useCallback(
    (values: FormValues) => ({
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
      vendorType: values.vendorType as VendorType,
      reconType: values.reconType as ReconType,
      priceText: values.priceText,
      priceDetails: values.priceDetails,
      notes: values.notes,
    }),
    [preVendorId, vendorState],
  );

  // Restore the editable form from a draft (used as the resume fallback when an
  // automatic publish fails, so the now-signed-in user can review and retry).
  const rehydrateForm = React.useCallback(
    (draft: ReconDraft) => {
      const p = draft.payload as Record<string, string | undefined>;
      reset({
        vendorType: p.vendorType as VendorType,
        reconType: p.reconType as ReconType,
        priceText: p.priceText ?? "",
        priceDetails: p.priceDetails ?? "",
        notes: p.notes ?? "",
      });
      setVendorState(draft.vendorState as unknown as VendorState);
      setImages(draft.images);
    },
    [reset],
  );

  // Detect auth on mount, and — when returning from the magic link — auto-publish
  // the saved draft. Runs once.
  const resumeStarted = React.useRef(false);
  React.useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setAuthState(user ? "user" : "guest");

      // Resume requires an authenticated user. If someone hits ?resume=1 while
      // signed out, drop the overlay and just show the form.
      if (isResume && !user) {
        setResumeStatus("idle");
        return;
      }
      if (!isResume || resumeStarted.current) return;
      resumeStarted.current = true;

      // Stop the watcher from re-routing here regardless of outcome.
      clearResumeFlag();

      const draft = await loadReconDraft();
      if (!active) return;
      if (!draft || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        await clearReconDraft();
        setResumeStatus("missing");
        return;
      }

      // Clear before publishing so a mid-publish refresh can't double-submit.
      await clearReconDraft();

      try {
        const fd = new FormData();
        fd.append("__input", JSON.stringify(draft.payload));
        draft.images.forEach((file) => fd.append("images[]", file));
        await createRecon(fd); // success throws NEXT_REDIRECT → navigates away
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("NEXT_REDIRECT")) return; // published; navigation underway
        // Real failure: restore the form + draft so nothing is lost.
        rehydrateForm(draft);
        await saveReconDraft(draft);
        setResumeStatus("idle");
        toast.error(
          "We couldn't publish your saved recon automatically — please review and tap Publish.",
        );
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setVendorError(null);

    const inputPayload = buildInputPayload(values);

    // Guests don't have an account yet: stash the draft locally, email a magic
    // link, and publish on return (see the resume effect above).
    if (authState === "guest") {
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError("Enter a valid email address");
        return;
      }
      setEmailError(null);
      setIsSubmitting(true);
      try {
        await saveReconDraft({
          payload: inputPayload,
          vendorState: vendorState as unknown as Record<string, unknown>,
          images,
        });
        setResumeFlag();

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
          },
        });
        if (error) {
          toast.error(error.message ?? "Something went wrong. Please try again.");
          setIsSubmitting(false);
          return;
        }
        setSentTo(trimmed);
      } catch {
        toast.error("Something went wrong. Please try again.");
        setIsSubmitting(false);
      }
      return;
    }

    // Authenticated: publish immediately via the server action (redirects on success).
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("__input", JSON.stringify(inputPayload));
      images.forEach((file) => {
        fd.append("images[]", file);
      });
      await createRecon(fd);
    } catch (err) {
      // If it's a NEXT_REDIRECT error, Next will handle it — don't toast
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("NEXT_REDIRECT")) return;
      toast.error(msg);
      setIsSubmitting(false);
    }
  }

  // Returning from the magic link: auto-publishing the saved draft.
  if (resumeStatus === "publishing") {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm font-medium">Publishing your recon…</p>
        <p className="text-xs text-muted-foreground">
          Hang tight — we&apos;re posting the recon you saved.
        </p>
      </div>
    );
  }

  // Magic link sent: tell the guest to finish on this device.
  if (sentTo) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-heading text-lg font-semibold">Check your email</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            We sent a magic link to <strong>{sentTo}</strong>.{" "}
            <strong>Open it on this device</strong> to finish publishing — your
            recon, including photos, is saved right here in this browser.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setSentTo(null);
            setIsSubmitting(false);
          }}
        >
          Use a different email
        </Button>
      </div>
    );
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

      {/* Saved draft couldn't be found on this device (e.g. link opened elsewhere). */}
      {resumeStatus === "missing" && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          We couldn&apos;t find your saved recon on this device. If you started it
          on another phone or computer, please re-enter it here.
        </div>
      )}

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

        {/* ── Email (guests only) ──────────────────────────────────────────
            Guests publish via a magic link; this is the address we sign them in
            or create their account with. It's never attached to the recon. */}
        {authState === "guest" && (
          <section className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              autoComplete="email"
              aria-invalid={emailError ? true : undefined}
            />
            <p className="text-xs text-muted-foreground">
              Used to sign in or create your account — it&apos;s not shared and
              won&apos;t appear on your recon.
            </p>
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </section>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <div className="pb-4 pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting || authState === "loading"}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {authState === "guest" ? "Sending link…" : "Saving…"}
              </>
            ) : authState === "guest" ? (
              "Email me a link to publish"
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
