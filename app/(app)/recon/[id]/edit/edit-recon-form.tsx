"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";

import type { VendorType } from "@/lib/constants/categories";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ReconFormFields,
  reconFormSchema,
  type ReconFormValues,
} from "@/components/recon/recon-form-fields";
import { PlacesCombobox } from "@/components/add/places-combobox";
import { BrandFooter } from "@/components/brand-lockup";
import { ProfileMenu } from "@/components/profile-menu";
import { updateRecon } from "./actions";

interface EditReconFormProps {
  reconId: string;
  vendorId: string;
  vendorName: string;
  vendorType: VendorType;
  backHref: string | null;
  /** Existing photos — displayed read-only; editing is text-only for now. */
  photos: { id: string; thumb: string }[];
  currentYear: number;
  initialValues: ReconFormValues;
}

export function EditReconForm({
  reconId,
  vendorId,
  vendorName,
  vendorType,
  backHref,
  photos,
  currentYear,
  initialValues,
}: EditReconFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReconFormValues>({
    resolver: zodResolver(reconFormSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: ReconFormValues) {
    setIsSubmitting(true);
    try {
      // vendorType is omitted on purpose: it belongs to the vendor, and the
      // action reads it from the row rather than trusting the client.
      await updateRecon({
        reconId,
        reconType: values.reconType,
        collectedMonth: values.collectedMonth,
        collectedYear: values.collectedYear,
        priceText: values.priceText,
        priceDetails: values.priceDetails,
        serviceRegion: values.serviceRegion,
        notes: values.notes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("NEXT_REDIRECT")) return; // saved; navigation underway
      toast.error(msg);
      setIsSubmitting(false);
    }
  }

  // Falling back to the vendor page keeps the back button useful on a direct
  // link (a shared or bookmarked edit URL arrives with no `from`).
  const backTo = backHref ?? `/vendor/${vendorId}`;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Link href={backTo} aria-label="Go back">
          <ChevronLeft className="size-5 text-muted-foreground" />
        </Link>
        <h1 className="text-base font-semibold">Edit recon</h1>
        <ProfileMenu className="ml-auto shrink-0" />
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5"
        noValidate
      >
        {/* ── Vendor (locked — moving a recon to another vendor is not an
            edit; it would be a delete plus a new entry) ──────────────────── */}
        <section className="space-y-1.5">
          <PlacesCombobox
            lockedName={vendorName}
            onSelectPlace={() => {}}
            onSelectExisting={() => {}}
            onSelectManual={() => {}}
            onClear={() => {}}
          />
        </section>

        {/* ── Shared recon fields (type → notes) ─────────────────────────── */}
        <ReconFormFields
          control={control}
          errors={errors}
          lockVendorType
          vendorType={vendorType}
          currentYear={currentYear}
        />

        {/* ── Photos (read-only for now) ─────────────────────────────────── */}
        {photos.length > 0 && (
          <section className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, idx) => (
                <div
                  key={p.id}
                  className="size-20 shrink-0 overflow-hidden rounded-lg border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumb}
                    alt={`Recon photo ${idx + 1}`}
                    className="size-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Photos can&apos;t be changed yet — your edits above won&apos;t
              affect them.
            </p>
          </section>
        )}

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
              "Save changes"
            )}
          </Button>
        </div>

        <BrandFooter className="mt-2" />
      </form>
    </div>
  );
}
