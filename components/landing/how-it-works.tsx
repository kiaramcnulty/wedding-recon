"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { AppVisual } from "@/components/landing/app-visual";
import { HOW_STEPS } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

const STEP_MS = 6000;
const TICK_MS = 50;

/**
 * The three-step product tour: steps listed on one side, the matching in-app
 * visual on the other, advancing on a timer.
 *
 * Auto-advance is deliberately constrained, because a step-by-step explanation
 * is the worst possible content to yank away from a reader mid-sentence:
 *
 * - Every step has a progress bar, and the whole strip is a pause control.
 *   WCAG 2.2.2 (Pause, Stop, Hide) requires one for anything that moves on its
 *   own for more than five seconds, and this runs indefinitely.
 * - Choosing a step stops the timer for good. Someone who has taken control is
 *   reading at their own pace; resuming would fight them.
 * - `prefers-reduced-motion: reduce` means it never starts. That is the
 *   accessibility contract, not a nicety - vestibular triggers aside, plenty of
 *   people simply cannot read against a moving deadline.
 * - Hover and keyboard focus pause it, and release resumes, so a reader mousing
 *   over the panel is not racing the clock.
 *
 * All three steps render in the HTML, so a crawler (and a no-JS reader) gets
 * the full text; only which one is visually foregrounded is client-side.
 */
export function HowItWorks({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  // Null until the media query is read on the client, so the server render and
  // the first client render agree.
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Set once the reader takes control; never cleared.
  const takenOver = useRef(false);

  // Start only if the visitor has not asked for reduced motion. Deferred a tick
  // to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const t = setTimeout(() => setPlaying(!query.matches), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!playing || hovered) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + TICK_MS / STEP_MS;
        if (next < 1) return next;
        setActive((a) => (a + 1) % HOW_STEPS.length);
        return 0;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, hovered]);

  const selectStep = useCallback((index: number) => {
    takenOver.current = true;
    setPlaying(false);
    setProgress(0);
    setActive(index);
  }, []);

  const togglePlaying = useCallback(() => {
    setPlaying((p) => {
      if (p) takenOver.current = true;
      return !p;
    });
    setProgress(0);
  }, []);

  return (
    <div
      className={cn("grid gap-8 md:grid-cols-[1fr_1fr] md:items-center", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <ol className="space-y-2">
        {HOW_STEPS.map((step, i) => {
          const isActive = i === active;
          return (
            <li key={step.title}>
              <button
                type="button"
                onClick={() => selectStep(i)}
                aria-current={isActive}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-colors",
                  isActive
                    ? "border-brand/30 bg-background shadow-sm"
                    : "border-transparent hover:bg-background/60",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isActive
                        ? "bg-brand text-white"
                        : "bg-brand-soft text-brand-ink",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="font-heading text-sm font-semibold">
                    {step.title}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-2 pl-10 text-sm leading-relaxed text-muted-foreground",
                    // Body text for the inactive steps stays in the HTML for
                    // crawlers and screen readers; it is only dimmed visually.
                    !isActive && "opacity-70",
                  )}
                >
                  {step.body}
                </p>

                {/* Progress track. Full on the active step when paused, so the
                    control never looks broken while stopped. */}
                <span className="mt-3 ml-10 block h-0.5 overflow-hidden rounded-full bg-border">
                  <span
                    className="block h-full bg-brand transition-[width] duration-100 ease-linear"
                    style={{
                      width: isActive ? `${playing ? progress * 100 : 100}%` : "0%",
                    }}
                  />
                </span>
              </button>
            </li>
          );
        })}

        <li className="pl-4 pt-1">
          <button
            type="button"
            onClick={togglePlaying}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {playing ? (
              <>
                <Pause className="size-3" aria-hidden />
                Pause
              </>
            ) : (
              <>
                <Play className="size-3" aria-hidden />
                Play
              </>
            )}
          </button>
        </li>
      </ol>

      {/* One visual per step, all mounted, crossfaded. Mounting them together
          keeps the swap instant and avoids a layout jump between panels of
          different height. */}
      <div className="relative min-h-[340px]">
        {HOW_STEPS.map((step, i) => (
          <div
            key={step.title}
            className={cn(
              "transition-opacity duration-500",
              i === active
                ? "opacity-100"
                : "pointer-events-none absolute inset-0 opacity-0",
            )}
          >
            <AppVisual variant={step.visual} />
          </div>
        ))}
      </div>
    </div>
  );
}
