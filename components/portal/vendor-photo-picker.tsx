"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Photo picker for the listing editor. Unlike the recon ImageUpload (File-only,
 * add-only), this manages a MIXED, reorderable-by-removal list of already-
 * uploaded photos and newly-picked files, so a vendor can drop a saved photo or
 * add a new one. The editor uploads the `new` items to vendor-media on save and
 * records the resulting paths alongside the kept `existing` ones.
 */

export type PhotoItem =
  | { kind: "existing"; storagePath: string; thumbPath: string; url: string }
  | { kind: "new"; file: File; url: string };

const MAX = 4;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export function VendorPhotoPicker({
  items,
  onChange,
}: {
  items: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Revoke object URLs created for `new` items on unmount.
  React.useEffect(() => {
    return () => {
      for (const it of items) {
        if (it.kind === "new") URL.revokeObjectURL(it.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const tooBig = imgs.filter((f) => f.size > MAX_SIZE);
    const valid = imgs.filter((f) => f.size <= MAX_SIZE);
    if (tooBig.length) toast.error(`${tooBig.length} photo(s) over 50 MB were skipped.`);
    const room = Math.max(0, MAX - items.length);
    if (valid.length > room) toast.error(`You can add up to ${MAX} photos.`);
    const accepted = valid.slice(0, room).map(
      (f): PhotoItem => ({ kind: "new", file: f, url: URL.createObjectURL(f) }),
    );
    if (accepted.length) onChange([...items, ...accepted]);
  }

  function remove(idx: number) {
    const it = items[idx];
    if (it.kind === "new") URL.revokeObjectURL(it.url);
    onChange(items.filter((_, i) => i !== idx));
  }

  const canAdd = items.length < MAX;

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">Photos</h3>
        <p className="text-xs text-muted-foreground">
          Up to {MAX}. These lead your photo strip, badged as yours.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((it, idx) => (
          <div
            key={it.kind === "existing" ? it.storagePath : it.url}
            className="group relative size-20 shrink-0 overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={`Photo ${idx + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${idx + 1}`}
              onClick={() => remove(idx)}
              className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            aria-label="Add photos"
            onClick={() => inputRef.current?.click()}
            className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-ring hover:bg-muted/30 hover:text-foreground"
          >
            <ImagePlus className="size-5" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
    </div>
  );
}
