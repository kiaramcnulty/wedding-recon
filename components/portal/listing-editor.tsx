"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  VendorListingContent,
  type PricingRow,
} from "@/components/vendor/listing-content";
import { FilterOverrideEditor } from "@/components/portal/filter-override-editor";
import {
  VendorPhotoPicker,
  type PhotoItem,
} from "@/components/portal/vendor-photo-picker";
import { filtersForType } from "@/lib/constants/vendor-filters";
import type { VendorType } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/client";
import { uploadVendorImages } from "@/lib/vendor-media-upload";
import { saveListing } from "@/app/(portal)/portal/listing/actions";

const CTA_LABELS = ["Book a tour", "Check availability", "Contact us", "Get a quote"] as const;
const MAX_INTRO = 600;
const MAX_ROWS = 20;

export interface ListingInitial {
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  website: string;
  instagram: string;
  pricing: PricingRow[];
  filterOverrides: Record<string, unknown>;
  /** Already-uploaded photos, with their public URLs resolved server-side. */
  photos: { storagePath: string; thumbPath: string; url: string }[];
  published: boolean;
}

export function ListingEditor({
  vendorId,
  vendorType,
  userId,
  initial,
}: {
  vendorId: string;
  vendorType: VendorType;
  userId: string;
  initial: ListingInitial;
}) {
  const router = useRouter();
  const [intro, setIntro] = React.useState(initial.intro);
  const [ctaLabel, setCtaLabel] = React.useState(initial.ctaLabel);
  const [ctaUrl, setCtaUrl] = React.useState(initial.ctaUrl);
  const [website, setWebsite] = React.useState(initial.website);
  const [instagram, setInstagram] = React.useState(initial.instagram);
  const [rows, setRows] = React.useState<PricingRow[]>(
    initial.pricing.length ? initial.pricing : [],
  );
  const [filterOverrides, setFilterOverrides] = React.useState<
    Record<string, unknown>
  >(initial.filterOverrides);
  const [photoItems, setPhotoItems] = React.useState<PhotoItem[]>(() =>
    initial.photos.map((p) => ({
      kind: "existing" as const,
      storagePath: p.storagePath,
      thumbPath: p.thumbPath,
      url: p.url,
    })),
  );
  const [pending, startTransition] = React.useTransition();

  const filterDefs = React.useMemo(() => filtersForType(vendorType), [vendorType]);

  const setRow = (i: number, patch: Partial<PricingRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => (rs.length >= MAX_ROWS ? rs : [...rs, { label: "", price: "", unit: "" }]));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const submit = () => {
    startTransition(async () => {
      // Upload any newly-picked photos to vendor-media first (bytes never go
      // through the Server Action), then record paths in listing order: kept
      // existing photos keep their paths, new ones consume the uploads in turn.
      let photos: { storage_path: string; thumb_path: string }[];
      try {
        const supabase = createClient();
        const newFiles = photoItems.flatMap((it) => (it.kind === "new" ? [it.file] : []));
        const uploaded = newFiles.length
          ? await uploadVendorImages(supabase, vendorId, userId, newFiles)
          : [];
        let u = 0;
        photos = photoItems.map((it) => {
          if (it.kind === "existing")
            return { storage_path: it.storagePath, thumb_path: it.thumbPath };
          const up = uploaded[u++];
          return { storage_path: up.storagePath, thumb_path: up.thumbPath };
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Photo upload failed.");
        return;
      }

      const res = await saveListing({
        vendorId,
        intro,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        website: website || null,
        instagram: instagram || null,
        pricing: rows.map((r) => ({ label: r.label, price: r.price, unit: r.unit ?? "" })),
        filterOverrides,
        photos,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.published
          ? "Listing saved and published."
          : "Listing saved as a draft. Activate verification to publish it.",
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="intro">About your business</Label>
        <Textarea
          id="intro"
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO))}
          rows={4}
          placeholder="A short introduction couples will see at the top of your page."
        />
        <span className="self-end text-xs text-muted-foreground">
          {intro.length}/{MAX_INTRO}
        </span>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div>
          <h3 className="text-sm font-semibold">Call to action</h3>
          <p className="text-xs text-muted-foreground">
            A button couples can tap to reach you (e.g. a booking link).
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cta-label">Button label</Label>
          <select
            id="cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">No button</option>
            {CTA_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cta-url">Button link (https)</Label>
          <Input
            id="cta-url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://calendly.com/your-tour"
            inputMode="url"
          />
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="yourbusiness.com"
            inputMode="url"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="instagram">Instagram (optional)</Label>
          <Input
            id="instagram"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@yourhandle"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div>
          <h3 className="text-sm font-semibold">Pricing</h3>
          <p className="text-xs text-muted-foreground">
            Add a row per package or item. Label, price, and an optional unit
            (e.g. &ldquo;per event&rdquo;, &ldquo;per person&rdquo;).
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={r.label}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  placeholder="Package"
                  className="flex-1"
                  aria-label={`Pricing row ${i + 1} label`}
                />
                <Input
                  value={r.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                  placeholder="$5,000"
                  className="w-28"
                  aria-label={`Pricing row ${i + 1} price`}
                />
                <Input
                  value={r.unit ?? ""}
                  onChange={(e) => setRow(i, { unit: e.target.value })}
                  placeholder="per event"
                  className="w-28"
                  aria-label={`Pricing row ${i + 1} unit`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label={`Remove pricing row ${i + 1}`}
                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          className="w-fit gap-1"
        >
          <Plus className="size-4" />
          Add pricing row
        </Button>
      </div>

      {/* Photos — uploaded to vendor-media on save, lead the vendor page strip. */}
      <VendorPhotoPicker items={photoItems} onChange={setPhotoItems} />

      {/* Attribute overrides — the filter tags for this vendor's type. */}
      <FilterOverrideEditor
        defs={filterDefs}
        value={filterOverrides}
        onChange={setFilterOverrides}
      />

      {/* Live preview */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Preview</h3>
        <p className="text-xs text-muted-foreground">
          How this appears on your public page.
        </p>
        <VendorListingContent
          interactive={false}
          content={{
            intro: intro || null,
            ctaLabel: ctaLabel || null,
            ctaUrl: ctaUrl || null,
            pricing: rows,
          }}
        />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button onClick={submit} disabled={pending} className="w-full gap-2">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save listing
        </Button>
      </div>
    </div>
  );
}
