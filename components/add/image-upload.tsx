"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  /** Called whenever the file list changes */
  onChange: (files: File[]) => void;
  /** Max number of images (default: 5) */
  maxImages?: number;
  className?: string;
}

interface Preview {
  file: File;
  url: string;
}

export function ImageUpload({ onChange, maxImages = 5, className }: ImageUploadProps) {
  const [previews, setPreviews] = React.useState<Preview[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount to avoid memory leaks
  React.useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;

    setPreviews((prev) => {
      // Revoke URLs that will be replaced / overflow
      const combined = [...prev, ...incoming.map((f) => ({ file: f, url: URL.createObjectURL(f) }))];
      const trimmed = combined.slice(0, maxImages);
      // Revoke excess
      combined.slice(maxImages).forEach((p) => URL.revokeObjectURL(p.url));
      onChange(trimmed.map((p) => p.file));
      return trimmed;
    });
  }

  function removeImage(idx: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      const next = prev.filter((_, i) => i !== idx);
      onChange(next.map((p) => p.file));
      return next;
    });
  }

  const canAdd = previews.length < maxImages;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Thumbnails row */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((p, idx) => (
            <div key={p.url} className="group relative size-20 shrink-0 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`Upload preview ${idx + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                aria-label={`Remove image ${idx + 1}`}
                onClick={() => removeImage(idx)}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {/* Add-more tile */}
          {canAdd && (
            <button
              type="button"
              aria-label="Add more images"
              onClick={() => inputRef.current?.click()}
              className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-ring hover:bg-muted/30 hover:text-foreground"
            >
              <ImagePlus className="size-5" />
            </button>
          )}
        </div>
      )}

      {/* Initial drop zone (shown when no images yet) */}
      {previews.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-muted-foreground transition-colors hover:border-ring hover:bg-muted/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ImagePlus className="size-8" />
          <span className="text-sm font-medium">Add photos</span>
          <span className="text-xs">Up to {maxImages} images</span>
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        // Reset input value so the same file can be re-selected after removal
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />

      {previews.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {previews.length}/{maxImages} photo{previews.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
