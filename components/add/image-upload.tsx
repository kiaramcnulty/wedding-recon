"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  /** Called whenever the file list changes */
  onChange: (files: File[]) => void;
  /** Max number of images (default: 4) */
  maxImages?: number;
  /** Max size per photo in bytes (default: 50 MB). */
  maxSizeBytes?: number;
  className?: string;
}

interface Preview {
  file: File;
  url: string;
}

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export function ImageUpload({
  onChange,
  maxImages = 4,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  className,
}: ImageUploadProps) {
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
    const all = Array.from(fileList).filter((f) => f.type.startsWith("image/"));

    const tooBig = all.filter((f) => f.size > maxSizeBytes);
    const valid = all.filter((f) => f.size <= maxSizeBytes);

    if (tooBig.length) {
      const mb = Math.round(maxSizeBytes / (1024 * 1024));
      toast.error(
        tooBig.length === 1
          ? `"${tooBig[0].name}" is over ${mb} MB — pick a smaller photo.`
          : `${tooBig.length} photos are over ${mb} MB and were skipped.`,
      );
    }
    if (!valid.length) return;

    setPreviews((prev) => {
      const room = Math.max(0, maxImages - prev.length);
      if (valid.length > room) {
        toast.error(`You can add up to ${maxImages} photos.`);
      }
      const accepted = valid.slice(0, room);
      const combined = [
        ...prev,
        ...accepted.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
      ];
      onChange(combined.map((p) => p.file));
      return combined;
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
          <span className="text-xs">
            Up to {maxImages} photos · {Math.round(maxSizeBytes / (1024 * 1024))} MB each
          </span>
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
