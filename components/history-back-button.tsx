"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Back out of a form page (Add recon, Edit recon) reached from a vendor page.
 *
 * Must go through real history rather than pushing `fallback`. The vendor page
 * this returns to carries its own `from` (…/vendor/X?from=/explore), and only
 * a genuine back step lands on *that* entry. Pushing a bare /vendor/X instead
 * appended a fresh entry with no `from`, whose own back button then called
 * router.back() straight into the form — the form/vendor bounce loop.
 * `cameFromApp` is the deterministic signal, not a history heuristic: in-app
 * links into these forms always set `from`. Without it this was a cold arrival
 * (bookmarked or shared URL), so there is nothing meaningful to step back to
 * and we `replace` — pushing would leave a dead entry that walks the user
 * right back into the form.
 */
export function HistoryBackButton({
  cameFromApp,
  fallback,
}: {
  cameFromApp: boolean;
  fallback: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => {
        if (cameFromApp && window.history.length > 1) router.back();
        else router.replace(fallback);
      }}
      className="-ml-1 flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}
