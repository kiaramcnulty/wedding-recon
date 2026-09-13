import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One row of the vendor-verification stepper: a numbered node on a vertical rail,
 * a title/description, and an optional action (a link or the billing control).
 *
 *   done     - completed; node is a check on the brand color, connector solid
 *   current  - the step to act on now; node filled, action shown
 *   upcoming - not yet reachable; muted, connector dashed, action hidden
 *
 * Presentational + server-safe (the interactive bits are passed in as children).
 */
export type StepStatus = "done" | "current" | "upcoming";

export function Step({
  n,
  title,
  description,
  status,
  last = false,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  status: StepStatus;
  /** The last step draws no trailing connector. */
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            status === "done" && "bg-brand text-brand-ink",
            status === "current" && "bg-primary text-primary-foreground",
            status === "upcoming" && "border text-muted-foreground",
          )}
          aria-hidden
        >
          {status === "done" ? <Check className="size-4" /> : n}
        </div>
        {!last && (
          <div
            className={cn(
              "mt-1 w-px flex-1",
              status === "done" ? "bg-brand/40" : "bg-border",
            )}
          />
        )}
      </div>

      <div className={cn("flex-1", last ? "pb-0" : "pb-6", status === "upcoming" && "opacity-60")}>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
