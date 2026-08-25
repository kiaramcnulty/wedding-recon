"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { VENDOR_TYPES, CATEGORIES, type VendorType } from "@/lib/constants/categories";
import {
  PlacesCombobox,
  type PlaceSelection,
  type ExistingVendorSelection,
  type ManualSelection,
} from "@/components/add/places-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { claimVendor, type ClaimVendorInput } from "@/app/(portal)/portal/actions";

/**
 * The claim flow: find your business (reusing the Add Recon combobox) and claim
 * it. An existing vendor claims directly with its canonical type locked; a
 * Google or manual result creates the vendor and needs a category chosen.
 */
type Selection =
  | { kind: "existing"; value: ExistingVendorSelection }
  | { kind: "google"; value: PlaceSelection }
  | { kind: "manual"; value: ManualSelection }
  | null;

export function ClaimBusiness() {
  const router = useRouter();
  const [selection, setSelection] = React.useState<Selection>(null);
  const [vendorType, setVendorType] = React.useState<VendorType | null>(null);
  const [role, setRole] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // A create-new path (google/manual) needs a category; an existing vendor
  // already has one (locked, canonical).
  const needsType = selection?.kind === "google" || selection?.kind === "manual";
  const displayName =
    selection?.kind === "existing"
      ? selection.value.name
      : selection?.kind === "google"
        ? selection.value.name
        : selection?.kind === "manual"
          ? selection.value.name
          : null;

  const reset = () => {
    setSelection(null);
    setVendorType(null);
  };

  const submit = () => {
    if (!selection) return;
    if (needsType && !vendorType) {
      toast.error("Pick your vendor category first.");
      return;
    }
    const input: ClaimVendorInput = { role };
    if (selection.kind === "existing") {
      input.vendorId = selection.value.vendorId;
    } else if (selection.kind === "google") {
      const p = selection.value;
      Object.assign(input, {
        placeId: p.placeId,
        placeName: p.name,
        placeAddress: p.address,
        placeLat: p.lat,
        placeLng: p.lng,
        placeWebsite: p.website,
        vendorType: vendorType!,
      });
    } else {
      const m = selection.value;
      Object.assign(input, {
        manualName: m.name,
        manualCity: m.city,
        manualAddress: m.address,
        manualRegion: m.region,
        manualLat: m.lat,
        manualLng: m.lng,
        vendorType: vendorType!,
      });
    }

    startTransition(async () => {
      const res = await claimVendor(input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.alreadyYours
          ? "You already manage this business."
          : "Business claimed. It is now linked to your account.",
      );
      reset();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          Claim your business
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Search for your business below. If it is not listed yet, you can add it.
        </p>
      </div>

      <PlacesCombobox
        onSelectExisting={(v) => setSelection({ kind: "existing", value: v })}
        onSelectPlace={(p) => setSelection({ kind: "google", value: p })}
        onSelectManual={(m) => setSelection({ kind: "manual", value: m })}
        onClear={reset}
      />

      {selection && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <p className="text-sm">
            Claiming <span className="font-semibold">{displayName}</span>
            {selection.kind === "existing" && (
              <span className="ml-1 text-muted-foreground">
                ({CATEGORIES[selection.value.vendorType].label})
              </span>
            )}
          </p>

          {needsType && (
            <div className="flex flex-col gap-2">
              <Label>Your vendor category</Label>
              <div className="flex flex-wrap gap-2">
                {VENDOR_TYPES.map((t) => {
                  const cat = CATEGORIES[t];
                  const active = vendorType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setVendorType(t)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        active
                          ? "border-transparent"
                          : "hover:bg-muted",
                      )}
                      style={
                        active
                          ? { backgroundColor: cat.lightHex, color: cat.textHex }
                          : undefined
                      }
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-role">Your role (optional)</Label>
            <Input
              id="claim-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Owner, Manager"
              maxLength={60}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={submit} disabled={pending} className="gap-2">
              {pending && <Loader2 className="size-4 animate-spin" />}
              Claim this business
            </Button>
            <Button variant="outline" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
