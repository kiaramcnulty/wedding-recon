"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, LogIn, Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ChoiceCard } from "@/components/search/choice-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/client";
import { GUIDED_TYPES } from "@/lib/search/guided";
import { JOURNEY_HREF, journeyStarted, loadJourney } from "@/lib/search/journey-state";
import { hasWelcomeResume, markWelcomeResume, takeWelcomeResume } from "@/lib/search/welcome-resume";
import { cn } from "@/lib/utils";

/**
 * The guided journey's two entry popups, mounted once in the (app) layout.
 *
 * - **Welcome** (screen 01): on arrival anywhere in the app, deep links
 *   included (a shared vendor page, a typed /explore URL, Reddit or Google),
 *   for anyone with no guided journey on this device, at most once a calendar
 *   day. Dismissible with the X. Closing it no longer hides it for good
 *   (Kiara, 2026-11-06): it can come back the next day until they start the
 *   journey.
 * - **Welcome back** (screen 11): on bare `/explore` for someone who has
 *   finished a guided search, at most once a calendar day.
 *
 * Both carry a "Log in or sign up" link for a visitor with no session (Kiara,
 * 2026-11-08), landing back on the page the popup opened over. It renders
 * only once the session check says signed out, so a signed-in visitor never
 * sees it flash. Sign-in from it reopens the popup where it lands: the welcome
 * screen for a new account, welcome back for a returning one
 * (lib/search/welcome-resume.ts).
 *
 * Decided 2026-10-31 and revised 2026-11-06
 * (docs/customer-journey-implementation-plan.md, open question 4), including
 * the known risk that an overlay on arrival from search can count against
 * mobile ranking.
 */

const WELCOME_KEY = "wr:welcomeShown";
const WELCOME_BACK_KEY = "wr:welcomeBackShown";

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

// The visitor's own calendar day (YYYY-MM-DD in their time zone). A UTC date
// rolled over at 5pm in Colorado, so "once a day" could show twice in one
// evening.
const today = () => new Date().toLocaleDateString("en-CA");

// TESTING ONLY (Kiara, 2026-11-05): lifts the once-a-day limit on both popups
// so they show on every fresh page load. Set back to false BEFORE this branch
// merges to main.
const SKIP_DAILY_LIMIT_FOR_TESTING = true;

type Mode = "welcome" | "welcomeBack" | null;

export function WelcomePopup() {
  const pathname = usePathname();
  const [mode, setMode] = React.useState<Mode>(null);
  // A couple who has booked a venue is not offered Venue on welcome back.
  const [hasVenue, setHasVenue] = React.useState(false);
  const decidedRef = React.useRef(false);
  // null until checked: the sign-in link waits for a definite "signed out".
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);
  const [returnTo, setReturnTo] = React.useState("/explore");

  React.useEffect(() => {
    // Decided once per page load; client-side navigation never re-opens it.
    if (decidedRef.current) return;
    if (pathname.startsWith(JOURNEY_HREF)) return;
    decidedRef.current = true;
    const journey = loadJourney();
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;

    // isSignedIn is left out when the session check is still running.
    const open = (next: Mode, isSignedIn?: boolean) => {
      if (cancelled || !next) return;
      if (isSignedIn !== undefined) setSignedIn(isSignedIn);
      setHasVenue(journey?.hasVenue === true);
      setReturnTo(window.location.pathname + window.location.search);
      setMode(next);
    };

    // The arrival rules: who sees which screen, at most once a day.
    const decide = (): Mode => {
      const due = (key: string) => SKIP_DAILY_LIMIT_FOR_TESTING || read(key) !== today();
      if (!journeyStarted(journey)) {
        if (!due(WELCOME_KEY)) return null;
        write(WELCOME_KEY, today());
        return "welcome";
      }
      if (
        pathname === "/explore" &&
        !window.location.search &&
        journey?.status === "completed" &&
        due(WELCOME_BACK_KEY)
      ) {
        write(WELCOME_BACK_KEY, today());
        return "welcomeBack";
      }
      return null;
    };

    // getClaims() verifies the JWT locally, so this costs no Auth round trip.
    const session = createClient()
      .auth.getClaims()
      .then(({ data }) => Boolean(data?.claims))
      .catch(() => false);

    if (hasWelcomeResume()) {
      // Back from the popup's sign-in link: a new account picks up the welcome
      // screen, a returning one gets welcome back, whatever the daily limits.
      // Still signed out (they backed out of sign-in): the usual rules.
      session.then((isSignedIn) => {
        if (cancelled) return;
        if (isSignedIn) open(takeWelcomeResume(), true);
        else {
          // Back in the app still signed out: that sign-in was abandoned, so
          // the mark must not pop a screen after some later, unrelated one.
          takeWelcomeResume();
          open(decide(), false);
        }
      });
    } else {
      const next = decide();
      if (!next) return;
      session.then((isSignedIn) => !cancelled && setSignedIn(isSignedIn));
      t = setTimeout(() => open(next), 0);
    }
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pathname]);

  const close = () => setMode(null);

  // For a visitor with no session: sign in, then land back here.
  const signInLink = signedIn === false && (
    <div className="border-t px-6 py-4 text-center text-sm">
      <Link
        href={`/login?from=${encodeURIComponent(returnTo)}`}
        onClick={() => {
          markWelcomeResume();
          close();
        }}
        className="inline-flex items-center gap-1 font-medium text-brand-ink underline-offset-4 hover:underline"
      >
        <LogIn className="size-3.5" aria-hidden />
        Log in or sign up
      </Link>
    </div>
  );

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
              "Real prices and intel from couples and vendor websites.",
              "Welcome to Wedding Recon",
            )}
            <div className="px-6 pb-6 pt-5">
              <p className="text-center text-sm font-medium">Do you have a venue yet?</p>
              <div className="mt-3 grid gap-2.5">
                <ChoiceCard
                  href={`${JOURNEY_HREF}?venue=yes`}
                  icon={CalendarHeart}
                  title="Yes, we’ve booked one"
                  hint="We’ll look for nearby vendors"
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
            {signInLink}
          </>
        )}
        {mode === "welcomeBack" && (
          <>
            {header("Welcome back!", "Which vendor are you looking for today?")}
            <div className="px-6 pb-6 pt-5">
              {/* Every type, in the same compact grid as the journey's type
                  screen; a booked venue is not something they shop for. */}
              <div className="grid grid-cols-2 gap-2">
                {GUIDED_TYPES.filter((t) => !(t === "venue" && hasVenue)).map((t) => {
                  const c = CATEGORIES[t];
                  const Icon = c.icon;
                  return (
                    <Link
                      key={t}
                      href={`${JOURNEY_HREF}?type=${t}`}
                      onClick={close}
                      className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-2.5 py-2 text-sm font-medium transition-colors hover:border-brand/50 hover:bg-brand-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                    >
                      {/* Hidden on the narrowest phones: "Photographer" needs
                          the room at 320px. */}
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full max-[359px]:hidden"
                        style={{ backgroundColor: c.lightHex, color: c.textHex }}
                      >
                        <Icon className="size-3.5" strokeWidth={1.75} />
                      </span>
                      <span className="leading-tight">{c.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {signInLink}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
