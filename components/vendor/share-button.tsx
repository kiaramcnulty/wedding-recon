"use client";

import { Share } from "lucide-react";
import { toast } from "sonner";
import { captureClient } from "@/lib/analytics/posthog";
import { Button } from "@/components/ui/button";
import type { VendorType } from "@/lib/constants/categories";
import { CATEGORIES } from "@/lib/constants/categories";
import { vendorPath } from "@/lib/vendors/slug";

interface ShareButtonProps {
  vendorId: string;
  /** The vendor page slug, so a shared link reads /vendor/dj-blnce rather than a uuid. */
  slug: string | null;
  vendorType: VendorType;
  name: string;
}

export function ShareButton({ vendorId, slug, vendorType, name }: ShareButtonProps) {
  const categoryLabel = CATEGORIES[vendorType]?.label ?? vendorType;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}${vendorPath({ id: vendorId, slug })}`;
  const shareText = `Check out ${name} — a ${categoryLabel} vendor on Wedding Recon!`;

  async function handleShare() {
    // Count the intent to share. navigator.share resolving does not reliably
    // mean a share completed (some browsers resolve regardless; a cancel
    // rejects), so the click is the honest signal.
    captureClient("share_clicked", { vendor_id: vendorId });

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
