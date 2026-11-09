"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { captureClient } from "@/lib/analytics/posthog";
import type { VendorType } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/client";
import {
  SAVED_TOAST,
  markJustSaved,
  rememberPendingSave,
  setSaved,
  useIsSaved,
  useJustSaved,
} from "@/lib/saved-vendors";
import { Button } from "@/components/ui/button";
import { HeartBurst } from "@/components/vendor/heart-burst";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  vendorId: string;
  vendorType: VendorType;
  /** Where sign-in returns a guest to; defaults to the current URL. */
  returnTo?: string;
  /** `overlay`: a small round heart pinned to a preview card's top-right corner. */
  variant?: "default" | "overlay";
}

export function SaveButton({ vendorId, vendorType, returnTo, variant = "default" }: SaveButtonProps) {
  // Shared across every heart on the page, so a card and the vendor page agree.
  const saved = useIsSaved(vendorId) === true;
  // Plays the pop on a save here AND on the save completed after sign-in.
  const popping = useJustSaved(vendorId);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (loading) return;
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Send guests to login, remembering this page so the login back button
        // returns here instead of defaulting to Explore, and remembering the tap
        // itself so the save completes once they are signed in
        // (`lib/saved-vendors.ts`).
        rememberPendingSave(vendorId, vendorType);
        const back = returnTo ?? window.location.pathname + window.location.search;
        router.push(`/login?from=${encodeURIComponent(back)}`);
        return;
      }

      if (saved) {
        // Unsave
        const { error } = await supabase
          .from("saved_vendors")
          .delete()
          .eq("user_id", user.id)
          .eq("vendor_id", vendorId);

        if (error) {
          toast.error("Could not remove from saved.");
        } else {
          setSaved(vendorId, false);
          toast("Removed from Planning Hub");
        }
      } else {
        // Save — ignore unique-violation (23505) gracefully
        const { error } = await supabase
          .from("saved_vendors")
          .insert({ user_id: user.id, vendor_id: vendorId });

        if (error && error.code !== "23505") {
          toast.error("Could not save vendor.");
        } else {
          setSaved(vendorId, true);
          markJustSaved(vendorId);
          toast(SAVED_TOAST);
          // Only the save (insert) direction counts as intent — not the unsave
          // branch above, and not the implicit auto-save createRecon does.
          captureClient("vendor_saved", { vendor_type: vendorType });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const label = saved ? "Remove from favorites" : "Add to favorites";

  if (variant === "overlay") {
    // The tap target is the full 40px box; the visible disc is 28px.
    return (
      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        aria-label={label}
        aria-pressed={saved}
        className="group -m-1.5 flex size-10 items-center justify-center rounded-full outline-none"
      >
        <span
          className={cn(
            // A saved heart is rose, the one warm accent on the card (bridal
            // polish, 2026-11-08); it blooms when the save lands.
            "relative flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-black/5 transition-transform group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-brand",
            saved && "text-rose",
          )}
        >
          <Heart
            className={cn("size-4", saved && "fill-current", popping && "animate-heart-pop")}
            strokeWidth={2}
          />
          {popping && <HeartBurst />}
        </span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleSave}
      disabled={loading}
      aria-label={label}
      className={cn("relative overflow-visible", saved && "border-rose/40 bg-rose/5 text-rose")}
    >
      <Heart className={cn("size-4", saved && "fill-current", popping && "animate-heart-pop")} />
      {popping && <HeartBurst />}
    </Button>
  );
}
