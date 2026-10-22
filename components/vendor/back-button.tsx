"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { hasInAppHistory } from "@/components/in-app-history";

/**
 * Vendor page back button. With a `from` it pushes that path (Explore needs
 * `/explore?restore=1` to rebuild its view, which a history step would not
 * carry). Without one it steps back — but only when there is an in-app page to
 * step back to. A cold arrival (shared link, Google, sitemap) has none, and
 * `router.back()` there was a dead button; it now `replace`s with Explore, so
 * the system back gesture still leaves to wherever the visitor came from.
 */
export function BackButton({ from }: { from?: string | null }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (from) router.push(from);
        else if (hasInAppHistory()) router.back();
        else router.replace("/explore");
      }}
      aria-label="Go back"
      className="-ml-1 flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}
