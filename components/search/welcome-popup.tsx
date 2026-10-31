"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES } from "@/lib/constants/categories";
import { VISIT_COOKIE } from "@/lib/landing/nav";
import { GUIDED_TYPES } from "@/lib/search/guided";
import { JOURNEY_HREF, loadJourney } from "@/lib/search/journey-state";
import { cn } from "@/lib/utils";

/**
 * The guided journey's two entry popups, mounted once in the (app) layout.
 *
 * - **Welcome** (screen 01): on a visitor's FIRST arrival anywhere in the app,
 *   deep links included (a shared vendor page, a typed /explore URL, Reddit
 *   or Google). Dismissible with the X; once dismissed or answered it does not
 *   come back on this device.
 * - **Welcome back** (screen 11): on bare `/explore` for someone who has
 *   finished a guided search, at most once a calendar day.
 *
 * Decided 2026-10-31 (docs/customer-journey-implementation-plan.md, open
 * question 4), including the known risk that an overlay on arrival from search
 * can count against mobile ranking.
 */

const DISMISSED_KEY = "wr:welcomeDismissed";
const WELCOME_BACK_KEY = "wr:welcomeBackShown";

// Read once, when this module first loads on the page: whether the visitor had
// been here BEFORE this page load. <MarkVisited> sets the cookie on mount, so
// reading it any later would make every visitor look like a returning one.
const SEEN_BEFORE_THIS_LOAD =
  typeof document !== "undefined" && document.cookie.includes(`${VISIT_COOKIE}=1`);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the popup may show again next visit, nothing worse.
  }
}

const today = () => new Date().toISOString().slice(0, 10);

type Mode = "welcome" | "welcomeBack" | null;

export function WelcomePopup() {
  const pathname = usePathname();
  const [mode, setMode] = React.useState<Mode>(null);
  const decidedRef = React.useRef(false);

  React.useEffect(() => {
    // Decided once per page load; client-side navigation never re-opens it.
    if (decidedRef.current) return;
    if (pathname.startsWith(JOURNEY_HREF)) return;
    decidedRef.current = true;
    const journey = loadJourney();
    let next: Mode = null;
    if (!SEEN_BEFORE_THIS_LOAD && !journey && !read(DISMISSED_KEY)) {
      next = "welcome";
    } else if (
      pathname === "/explore" &&
      !window.location.search &&
      journey?.status === "completed" &&
      read(WELCOME_BACK_KEY) !== today()
    ) {
      next = "welcomeBack";
      write(WELCOME_BACK_KEY, today());
    }
    if (!next) return;
    const t = setTimeout(() => setMode(next), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  const close = () => {
    if (mode === "welcome") write(DISMISSED_KEY, "1");
    setMode(null);
  };

  const primary = cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base");
  const secondary = cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 w-full text-base");

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="gap-0 p-6">
        {mode === "welcome" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Welcome to Wedding Recon</DialogTitle>
              <DialogDescription>
                Real prices and notes from Colorado couples. Answer a few quick questions and
                we&apos;ll find vendors that fit.
              </DialogDescription>
            </DialogHeader>
            <p className="mt-5 font-medium">Do you have a venue yet?</p>
            <div className="mt-3 flex flex-col gap-2.5">
              <Link href={`${JOURNEY_HREF}?venue=yes`} className={primary} onClick={close}>
                Yes, we&apos;ve booked one
              </Link>
              <Link href={`${JOURNEY_HREF}?venue=no`} className={secondary} onClick={close}>
                Not yet
              </Link>
            </div>
          </>
        )}
        {mode === "welcomeBack" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Welcome back!</DialogTitle>
              <DialogDescription>Which vendor are you looking for today?</DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex flex-col gap-2.5">
              {GUIDED_TYPES.map((t, i) => (
                <Link
                  key={t}
                  href={`${JOURNEY_HREF}?type=${t}`}
                  className={i === 0 ? primary : secondary}
                  onClick={close}
                >
                  {CATEGORIES[t].label}
                </Link>
              ))}
              <Link
                href={JOURNEY_HREF}
                className="mt-1 text-center text-sm text-muted-foreground underline underline-offset-4"
                onClick={close}
              >
                See all vendor types
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
