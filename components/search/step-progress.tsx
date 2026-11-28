import { cn } from "@/lib/utils";

/**
 * The guided journey's progress tracker: one segment per question and a
 * "Step 2 of 4" label, so a couple can see the whole thing is short. The
 * segment for the current step fills in as the step arrives (each step
 * remounts, so there is no previous width to animate from).
 *
 * The step counts come from `journeyProgress()` in lib/search/journey-state.ts,
 * which the welcome popups share so their "Step 1" carries on into /start.
 */
export function StepProgress({
  step,
  total,
  className,
}: {
  step: number;
  total: number;
  className?: string;
}) {
  const label = `Step ${step} of ${total}`;
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={label}
      className={cn("flex w-32 flex-col items-center gap-1.5", className)}
    >
      <div className="flex w-full gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand/15">
            {i < step && (
              <span
                className={cn("block h-full rounded-full bg-brand", i === step - 1 && "animate-progress-fill")}
              />
            )}
          </span>
        ))}
      </div>
      <span aria-hidden className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
