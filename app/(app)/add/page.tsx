"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Mail } from "lucide-react";

import { VENDOR_TYPES } from "@/lib/constants/categories";
import type { VendorType, ReconType } from "@/lib/constants/categories";
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
import { Label } from "@/components/ui/label";
import {
  ReconFormFields,
  reconFormSchema,
  type ReconFormValues,
} from "@/components/recon/recon-form-fields";
import { PlacesCombobox } from "@/components/add/places-combobox";
import type {
  PlaceSelection,
  ManualSelection,
  ExistingVendorSelection,
} from "@/components/add/places-combobox";
import { ImageUpload } from "@/components/add/image-upload";
import { OtpCodeForm } from "@/components/auth/otp-code-form";
import {
  clearPendingOtpEmail,
  getPendingOtpEmail,
  setPendingOtpEmail,
} from "@/lib/auth/pending-otp";
import { useIsStandalone } from "@/lib/use-standalone";
import { BrandFooter } from "@/components/brand-lockup";
import { ProfileMenu } from "@/components/profile-menu";
import { createRecon } from "./actions";
import { uploadReconImages } from "@/lib/recon-upload";

// ── Form schema + fields are shared with Edit Recon ──────────────────────────
// (components/recon/recon-form-fields.tsx)

type FormValues = ReconFormValues;

// ── Vendor state — managed outside react-hook-form since it comes from the
//    PlacesCombobox component, not a plain input ─────────────────────────────

interface VendorState {
  mode: "none" | "google" | "manual" | "existing";
  // Existing Wedding Recon vendor (picked from search) — resolves to its id.
  existingVendorId?: string;
  existingName?: string;
  existingVendorType?: VendorType;
  // Google Places
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  placeCity?: string;
  placeRegion?: string;
  placeLat?: number | null;
  placeLng?: number | null;
  placeWebsite?: string;
  // Manual (location is geocoded and required)
  manualName?: string;
  manualCity?: string;
  manualAddress?: string | null;
  manualRegion?: string | null;
  manualLat?: number | null;
  manualLng?: number | null;
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
  // (Picking an existing vendor from search also locks it — see below.)
  const lockedFromParams = !!preVendorId && !!preVendorType;

  // Show a back button only when the user arrived from another page (Planning
  // Hub or a vendor page reached via Explore/Hub), which passes a `from` return
  // path. Arriving via the "+" tab has no `from`, so no back button is shown.
  // Restrict to internal paths to avoid an open-redirect through the link.
  const rawFrom = searchParams.get("from");
  const backHref =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : null;

  // Guests publish via an emailed sign-in code: the form (incl. photos) is
  // stashed locally and re-published once they authenticate. `resume=1` marks
  // that return trip.
  const isResume = searchParams.get("resume") === "1";

  const [vendorState, setVendorState] = React.useState<VendorState>({
    mode: preVendorId ? "google" : "none",
  });
  // An existing vendor's type is canonical, so picking one locks the type chip.
  const lockVendorType = lockedFromParams || vendorState.mode === "existing";
  const [images, setImages] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [vendorError, setVendorError] = React.useState<string | null>(null);

  // Auth gates which submit path runs and whether the email field is shown.
  const [authState, setAuthState] = React.useState<"loading" | "guest" | "user">(
    "loading",
  );
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  // Email address we sent a sign-in code to; non-null swaps in the "check email" view.
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  // The draft lives in THIS app's IndexedDB, so finishing anywhere else loses it.
  const isStandalone = useIsStandalone();
  // Resume lifecycle: auto-publishing the saved draft, or its draft went missing.
  const [resumeStatus, setResumeStatus] = React.useState<
    "idle" | "publishing" | "missing"
  >(isResume ? "publishing" : "idle");

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
  const currentYear = now.getFullYear();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(reconFormSchema),
    defaultValues: {
      ...(preVendorType ? { vendorType: preVendorType } : {}),
      collectedMonth: currentMonth,
      collectedYear: currentYear,
    },
  });

  const vendorType = watch("vendorType");

  // Build the structured `__input` payload from the current form + vendor state.
  // Shared by the immediate (authed) publish and the saved guest draft so resume
  // republishes byte-for-byte identical data.
  const buildInputPayload = React.useCallback(
    (values: FormValues) => ({
      // A pre-resolved vendor (URL param) or an existing vendor picked from
      // search both resolve straight to a vendor id — no new row is created.
      ...(preVendorId
        ? { vendorId: preVendorId }
        : vendorState.mode === "existing"
          ? { vendorId: vendorState.existingVendorId }
          : {}),
      ...(vendorState.mode === "google"
        ? {
            placeId: vendorState.placeId,
            placeName: vendorState.placeName,
            placeAddress: vendorState.placeAddress,
            placeCity: vendorState.placeCity,
            placeRegion: vendorState.placeRegion,
            placeLat: vendorState.placeLat,
            placeLng: vendorState.placeLng,
            placeWebsite: vendorState.placeWebsite,
          }
        : {}),
      ...(vendorState.mode === "manual"
        ? {
            manualName: vendorState.manualName,
            manualCity: vendorState.manualCity,
            manualAddress: vendorState.manualAddress,
            manualRegion: vendorState.manualRegion,
            manualLat: vendorState.manualLat,
            manualLng: vendorState.manualLng,
          }
        : {}),
      vendorType: values.vendorType as VendorType,
      reconType: values.reconType as ReconType,
      collectedMonth: values.collectedMonth,
      collectedYear: values.collectedYear,
      priceText: values.priceText,
      priceDetails: values.priceDetails,
      serviceRegion: values.serviceRegion,
      notes: values.notes,
    }),
    [preVendorId, vendorState],
  );

  // Restore the editable form from a draft (used as the resume fallback when an
  // automatic publish fails, so the now-signed-in user can review and retry).
  const rehydrateForm = React.useCallback(
    (draft: ReconDraft) => {
      const p = draft.payload as Record<string, string | number | undefined>;
      reset({
        vendorType: p.vendorType as VendorType,
        reconType: p.reconType as ReconType,
        collectedMonth: p.collectedMonth ? Number(p.collectedMonth) : currentMonth,
        collectedYear: p.collectedYear ? Number(p.collectedYear) : currentYear,
        priceText: String(p.priceText ?? ""),
        priceDetails: String(p.priceDetails ?? ""),
        serviceRegion: String(p.serviceRegion ?? ""),
        notes: String(p.notes ?? ""),
      });
      setVendorState(draft.vendorState as unknown as VendorState);
      setImages(draft.images);
    },
    [reset, currentMonth, currentYear],
  );

  // Detect auth on mount, and — when returning from the sign-in step — auto-publish
  // the saved draft. Runs once.
  // Set correct defaults after client hydration (avoid SSR time-zone mismatches)
  React.useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (month !== currentMonth || year !== currentYear) {
      setValue("collectedMonth", month);
      setValue("collectedYear", year);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // Reopen the code screen for a guest who sent themselves a code, left to
      // read it, and came back to a cold start (routine on iOS, which discards
      // backgrounded PWAs). Gated on the draft still being there: without it
      // there is nothing left to publish, so the form is the honest screen and
      // /login is the place to sign in.
      if (!isResume && !user) {
        const pending = getPendingOtpEmail();
        if (pending) {
          const draft = await loadReconDraft();
          if (!active) return;
          if (draft && Date.now() - draft.savedAt <= DRAFT_TTL_MS) {
            setEmail(pending);
            setSentTo(pending);
            rehydrateForm(draft);
          } else {
            clearPendingOtpEmail();
          }
        }
      }

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
        if (!user) throw new Error("Not signed in");
        const media = await uploadReconImages(supabase, user.id, draft.images);
        // success throws NEXT_REDIRECT → navigates away
        await createRecon({
          ...draft.payload,
          media,
        } as Parameters<typeof createRecon>[0]);
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
      placeWebsite: place.website ?? undefined,
    });
    setVendorError(null);
  }

  function handleManualSelect(entry: ManualSelection) {
    setVendorState({
      mode: "manual",
      manualName: entry.name,
      manualCity: entry.city,
      manualAddress: entry.address,
      manualRegion: entry.region,
      manualLat: entry.lat,
      manualLng: entry.lng,
    });
    setVendorError(null);
  }

  function handleSelectExisting(vendor: ExistingVendorSelection) {
    setVendorState({
      mode: "existing",
      existingVendorId: vendor.vendorId,
      existingName: vendor.name,
      existingVendorType: vendor.vendorType,
    });
    // The existing vendor's type is canonical; reflect it in the (now locked) chip.
    setValue("vendorType", vendor.vendorType);
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
      setVendorError("Please search for or enter a vendor name");
      return;
    }
    // Manual entries must resolve a real location so they can appear on the map.
    if (
      !preVendorId &&
      vendorState.mode === "manual" &&
      vendorState.manualLat == null
    ) {
      setVendorError(
        "Please choose an address, city, or state from the suggestions.",
      );
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
            // Inert with the current template, which renders {{ .SiteURL }}
            // /auth/callback itself and never reads {{ .RedirectTo }}. Kept
            // because it is what a template switched to {{ .ConfirmationURL }}
            // would read — changing one without the other changes nothing.
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
          },
        });
        if (error) {
          toast.error(error.message ?? "Something went wrong. Please try again.");
          setIsSubmitting(false);
          return;
        }
        setPendingOtpEmail(trimmed);
        setSentTo(trimmed);
      } catch {
        toast.error("Something went wrong. Please try again.");
        setIsSubmitting(false);
      }
      return;
    }

    // Authenticated: compress + upload photos straight to Storage, then publish.
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Session lapsed between mount and submit.
        window.location.href = "/login";
        return;
      }
      const media = await uploadReconImages(supabase, user.id, images);
      await createRecon({ ...inputPayload, media });
    } catch (err) {
      // If it's a NEXT_REDIRECT error, Next will handle it — don't toast
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("NEXT_REDIRECT")) return;
      toast.error(msg);
      setIsSubmitting(false);
    }
  }

  // Returning from the sign-in step: auto-publishing the saved draft.
  if (resumeStatus === "publishing") {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm font-medium">Saving your recon…</p>
        <p className="text-xs text-muted-foreground">
          Hang tight — we&apos;re saving the recon you started.
        </p>
      </div>
    );
  }

  // Code sent: the guest finishes RIGHT HERE.
  //
  // This screen is why the code matters more here than on the login page. The
  // draft — including the photo Files — is in this app's IndexedDB, and the
  // session has to be minted in this app's cookie jar. Finishing via the emailed
  // link satisfies neither: it lands in the browser, which has no draft and
  // whose session the PWA cannot see. The old copy said "open it on this
  // device", which is true and still not enough — device was never the unit,
  // the app is.
  //
  // Verifying here signs them in without leaving the page, then hands off to
  // /auth/post-signin → (onboarding →) explore, where ResumePublishWatcher sees
  // the resume flag set at submit time and routes to /add?resume=1 to publish.
  // Deliberately NOT a direct jump to ?resume=1: that would skip onboarding for
  // a new account, publishing under a placeholder username with no TOS accepted.
  if (sentTo) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <div className="space-y-1.5 text-center">
          <h1 className="font-heading text-lg font-semibold">Check your email</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            We sent a sign-in code to <strong>{sentTo}</strong>. Enter it here to
            finish saving — your recon, including photos, is stored in this app,
            so this is where it has to be published from.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <OtpCodeForm email={sentTo} />
        </div>

        <p className="mx-auto max-w-sm text-center text-xs text-muted-foreground">
          {isStandalone
            ? "Do not use the link in the email — it opens in your browser, which cannot see the recon you just wrote here."
            : "The email also has a link, but open it in this same browser or your saved recon will not be there."}
        </p>

        <Button
          variant="ghost"
          onClick={() => {
            clearPendingOtpEmail();
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
        {/* ── Vendor name ───────────────────────────────────────────────── */}
        <section className="space-y-1.5">
          <PlacesCombobox
            lockedName={preVendorName}
            onSelectPlace={handlePlaceSelect}
            onSelectExisting={handleSelectExisting}
            onSelectManual={handleManualSelect}
            onClear={handleVendorClear}
          />
          {vendorError && (
            <p className="text-xs text-destructive">{vendorError}</p>
          )}
        </section>

        {/* ── Shared recon fields (type → notes) ─────────────────────────── */}
        <ReconFormFields
          control={control}
          errors={errors}
          lockVendorType={lockVendorType}
          vendorType={vendorType}
          currentYear={currentYear}
        />

        {/* ── Photos ────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <Label>Photos</Label>
          <ImageUpload onChange={setImages} maxImages={4} />
        </section>

        {/* ── Email (guests only) ──────────────────────────────────────────
            Guests publish via an emailed sign-in code; this is the address we
            sign them in or create their account with. Never attached to the recon. */}
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
              "Email me a link to save"
            ) : (
              "Save recon"
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
