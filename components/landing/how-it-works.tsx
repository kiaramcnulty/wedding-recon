"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { AppVisual } from "@/components/landing/app-visual";
import { HOW_STEPS } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

const STEP_MS = 6000;
const TICK_MS = 50;

/**
 * The three-step product tour: one panel, with the step text overlaid on the
 * in-app visual rather than listed beside it. Roughly halves the vertical space
 * the section used to take (Kiara, 2026-08-04).
 *
 * Auto-advance is deliberately constrained, because a step-by-step explanation
 * is the worst possible content to yank away from a reader mid-sentence:
 *
 * - Progress bars across the top double as the step picker and show where the
 *   timer is. WCAG 2.2.2 (Pause, Stop, Hide) requires a control for anything
 *   moving unprompted past five seconds, and this runs indefinitely - hence the
 *   explicit pause button too.
 * - Choosing a step stops the timer for good. Someone who has taken control is
 *   reading at their own pace; resuming would fight them.
 * - `prefers-reduced-motion: reduce` means it never starts.
 * - Hover and keyboard focus pause it, and leaving resumes.
 *
 * Every step's text is in the HTML whichever is showing, so a crawler reads all
 * three; inactive ones are aria-hidden so a screen reader is not read three
 * overlapping descriptions at once.
 */
export function HowItWorks({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
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
      className={cn(
        "relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-brand/20 bg-brand-soft/50 shadow-sm",
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      {/* Progress bars, doubling as the step picker. */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 p-3">
        {HOW_STEPS.map((step, i) => (
          <button
            key={step.title}
            type="button"
            onClick={() => selectStep(i)}
            aria-label={`Step ${i + 1}: ${step.title}`}
            aria-current={i === active}
            className="group h-4 flex-1"
          >
            <span className="block h-1 w-full overflow-hidden rounded-full bg-white/70 transition-colors group-hover:bg-white">
              <span
                className="block h-full bg-brand transition-[width] duration-100 ease-linear"
                style={{
                  width:
                    i < active
                      ? "100%"
                      : i === active
                        ? `${playing ? progress * 100 : 100}%`
                        : "0%",
                }}
              />
            </span>
          </button>
        ))}
      </div>

      {/* Visuals, crossfaded. All mounted so the swap is instant. */}
      <div className="relative h-[300px] sm:h-[340px]">
        {HOW_STEPS.map((step, i) => (
          <div
            key={step.title}
            className={cn(
              "absolute inset-0 flex items-start justify-center overflow-hidden px-4 pt-10 transition-opacity duration-500",
              i === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <AppVisual variant={step.visual} bare className="w-full max-w-sm" />
          </div>
        ))}
      </div>

      {/* Text overlay. Sits over the foot of the visual rather than beside it,
          on a blurred surface so the panel behind stays legible. */}
      <div className="relative z-10 -mt-6 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="rounded-2xl border border-white/60 bg-background/85 p-5 shadow-lg backdrop-blur-md">
          {HOW_STEPS.map((step, i) => (
            <div
              key={step.title}
              aria-hidden={i !== active}
              className={i === active ? "block" : "hidden"}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="font-heading text-base font-semibold">
                  {step.title}
                </h3>
              </div>
              <p className="mt-2 pl-10 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={togglePlaying}
            className="mt-3 ml-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
        </div>
      </div>
    </div>
  );
}
