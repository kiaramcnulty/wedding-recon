"use client";

import { Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { VendorType } from "@/lib/constants/categories";
import { CATEGORIES } from "@/lib/constants/categories";

interface ShareButtonProps {
  vendorId: string;
  vendorType: VendorType;
  name: string;
}

export function ShareButton({ vendorId, vendorType, name }: ShareButtonProps) {
  const categoryLabel = CATEGORIES[vendorType]?.label ?? vendorType;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/vendor/${vendorId}`;
  const shareText = `Check out ${name} — a ${categoryLabel} vendor on Wedding Recon!`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: shareText, url });
      } catch {
        // User dismissed or share failed — silently ignore
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied to clipboard!");
      } catch {
        toast.error("Could not copy link.");
      }
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleShare}
      aria-label="Share vendor"
    >
      <Share className="size-4" />
    </Button>
  );
}
