"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ChoiceCard } from "@/components/search/choice-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  const header = (title: string, description: string, kicker?: string) => (
    <div className="bg-gradient-to-b from-brand-soft via-brand-soft/40 to-popover px-6 pb-1 pt-8 text-center">
      <BrandMark className="mx-auto size-14" />
      {kicker && (
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-ink">{kicker}</p>
      )}
      <DialogTitle className={cn("text-2xl font-semibold leading-tight tracking-tight text-balance", kicker ? "mt-1.5" : "mt-4")}>
        {title}
      </DialogTitle>
      <DialogDescription className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-balance">
        {description}
      </DialogDescription>
    </div>
  );

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
        {mode === "welcome" && (
          <>
            {header(
              "Let’s find vendors you’ll love",
              "Real prices and honest notes from Colorado couples. Answer a few quick questions and we’ll do the digging.",
              "Welcome to Wedding Recon",
            )}
            <div className="px-6 pb-6 pt-5">
              <p className="text-center text-sm font-medium">Do you have a venue yet?</p>
              <div className="mt-3 grid gap-2.5">
                <ChoiceCard
                  href={`${JOURNEY_HREF}?venue=yes`}
                  icon={CalendarHeart}
                  title="Yes, we’ve booked one"
                  hint="We’ll look for vendors near it"
                  onClick={close}
                />
                <ChoiceCard
                  href={`${JOURNEY_HREF}?venue=no`}
                  icon={Search}
                  title="Not yet"
                  hint="We’ll help you find the one"
                  onClick={close}
                />
              </div>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={close}
              >
                I&apos;m just browsing
              </button>
            </div>
          </>
        )}
        {mode === "welcomeBack" && (
          <>
            {header("Welcome back!", "Which vendor are you looking for today?")}
            <div className="px-6 pb-6 pt-5">
              <div className="grid gap-2.5">
                {GUIDED_TYPES.map((t) => {
                  const c = CATEGORIES[t];
                  return (
                    <ChoiceCard
                      key={t}
                      href={`${JOURNEY_HREF}?type=${t}`}
                      icon={c.icon}
                      iconStyle={{ backgroundColor: c.lightHex, color: c.textHex }}
                      title={c.label}
                      onClick={close}
                    />
                  );
                })}
              </div>
              <Link
                href={JOURNEY_HREF}
                className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
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
