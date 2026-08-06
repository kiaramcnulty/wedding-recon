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
 *   explicit pause button too, floated at the panel's top-right so it reads as
 *   governing the whole slideshow rather than the caption it used to sit in.
 * - Tapping the visual advances to the next step. It is a real <button> with an
 *   accessible name rather than a click handler on a div, so it is reachable by
 *   keyboard and announced; the pause control and the progress bars sit above
 *   it in the stacking order so neither is swallowed by the tap target.
 * - Choosing a step jumps to it and keeps playing. It used to stop the timer
 *   for good, on the theory that someone who has taken control wants to read at
 *   their own pace - but that reads as broken (reported 2026-08-04, "stuck on
 *   step 3"): the deck simply dies with no obvious cause. Pause is the control
 *   for stopping; picking a step is navigation.
 * - Keyboard focus pauses it, so a reader tabbing through the step buttons is
 *   not racing the clock. Hover does NOT - it used to, and that was the other
 *   half of the same report: the panel is the width of the section and sits
 *   under where a desktop reader's cursor naturally rests, so it froze for
 *   anyone who left the mouse alone. Hover-pause is for small controls, not for
 *   something that fills the viewport.
 * - `prefers-reduced-motion: reduce` means it never starts.
 *
 * Every step's text is in the HTML whichever is showing, so a crawler reads all
 * three; inactive ones are aria-hidden so a screen reader is not read three
 * overlapping descriptions at once.
 */
export function HowItWorks({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [focused, setFocused] = useState(false);
  // Progress lives in a ref as well as state: the interval needs to read and
  // advance it without re-subscribing every tick, and the advance must happen
  // in the timer callback rather than inside a setState updater. Updaters have
  // to be pure - React may run one more than once - so calling setActive from
  // inside setProgress was a latent double-advance.
  const progressRef = useRef(0);

  // Start only if the visitor has not asked for reduced motion. Deferred a tick
  // to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const t = setTimeout(() => setPlaying(!query.matches), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!playing || focused) return;
    const id = setInterval(() => {
      progressRef.current += TICK_MS / STEP_MS;
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        setActive((a) => (a + 1) % HOW_STEPS.length);
      }
      setProgress(progressRef.current);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, focused]);

  /** Jump to a step and keep going. Pause is the control for stopping. */
  const selectStep = useCallback((index: number) => {
    progressRef.current = 0;
    setProgress(0);
    setActive(index);
  }, []);

  const nextStep = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setActive((a) => (a + 1) % HOW_STEPS.length);
  }, []);

  const togglePlaying = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setPlaying((p) => !p);
  }, []);

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-brand/20 bg-brand-soft/50 shadow-sm",
        className,
      )}
      // Only KEYBOARD focus pauses. A mouse click focuses the button too, so
      // testing plain focus froze the deck the moment anyone picked a step or
      // pressed Play - the same "stuck on step 3" symptom, one layer down.
      // :focus-visible is exactly the keyboard-vs-pointer distinction.
      onFocusCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target.matches?.(":focus-visible")) setFocused(true);
      }}
      onBlurCapture={() => setFocused(false)}
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

      {/* Governs the whole slideshow, so it sits on the panel rather than in
          the caption. Above the tap layer so it is not swallowed by it. */}
      <button
        type="button"
        onClick={togglePlaying}
        aria-label={playing ? "Pause the slideshow" : "Play the slideshow"}
        className="absolute right-3 top-7 z-30 flex size-8 items-center justify-center rounded-full border border-white/70 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
      >
        {playing ? (
          <Pause className="size-3.5" aria-hidden />
        ) : (
          <Play className="size-3.5" aria-hidden />
        )}
      </button>

      {/* Visuals, crossfaded. All mounted so the swap is instant. */}
      <div className="relative h-[300px] sm:h-[340px]">
        {/* Tap anywhere on the visual to skip ahead. */}
        <button
          type="button"
          onClick={nextStep}
          aria-label="Next step"
          className="absolute inset-0 z-10 cursor-pointer"
        />
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
        </div>
      </div>
    </div>
  );
}
