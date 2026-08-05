import { ArrowRight } from "lucide-react";

import { AppVisual } from "@/components/landing/app-visual";
import { PROBLEMS_SECTION, type ProblemSolution } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/**
 * A pair of opening/closing quote marks, drawn rather than taken from lucide.
 *
 * Lucide's Quote glyph only comes as one mark, so a closing pair meant flipping
 * it - and a flipped opening mark is not a closing mark, it is an upside-down
 * one. These are the real characters at the right optical weight, and they are
 * decorative: the <blockquote> element already tells assistive tech this is a
 * quotation, so a screen reader must not announce them.
 */
function QuoteMark({ closing }: { closing?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-heading text-3xl leading-none text-brand/35",
        closing ? "align-bottom" : "align-top",
      )}
    >
      {closing ? "”" : "“"}
    </span>
  );
}

/**
 * One problem/solution pair, as a full-width row.
 *
 * The hierarchy is explicit rather than implied (Kiara, 2026-08-04): each half
 * carries a small label, the problem is the largest thing in the row, the quote
 * is set in italics between real quote marks, and the solution sits in its own
 * tinted card. The earlier version leaned on size alone and read ambiguously -
 * the solution title was *smaller* than the problem it answered, which is
 * backwards for the payoff.
 *
 * A Server Component, so all four pairs and all four quotes are in the HTML a
 * crawler reads.
 */
export function ProblemSolutionRow({
  item,
  index,
}: {
  item: ProblemSolution;
  index: number;
}) {
  // Odd rows put the visual first on desktop. Mobile always stacks text first:
  // the prose is the point, the visual supports it.
  const visualFirst = index % 2 === 1;

  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className={cn(visualFirst && "md:order-2")}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {PROBLEMS_SECTION.problemLabel}
        </p>
        <h3 className="mt-2 font-heading text-2xl font-semibold leading-snug tracking-tight sm:text-[1.75rem]">
          {item.problem}
        </h3>

        <figure className="mt-5">
          <blockquote className="text-base italic leading-relaxed text-muted-foreground">
            <QuoteMark />
            {item.quote.text}
            <QuoteMark closing />
          </blockquote>
          <figcaption className="mt-3 text-xs not-italic">
            <span className="font-medium text-foreground">
              {item.quote.name}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {item.quote.context}
            </span>
          </figcaption>
        </figure>

        <div className="mt-7 rounded-2xl border border-brand/25 bg-brand-soft/50 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">
            <ArrowRight className="size-3.5" aria-hidden />
            {PROBLEMS_SECTION.solutionLabel}
          </p>
          <p className="mt-2.5 font-heading text-lg font-semibold leading-snug">
            {item.solution}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {item.solutionBody}
          </p>
        </div>
      </div>

      <AppVisual
        variant={item.visual}
        className={cn("w-full", visualFirst && "md:order-1")}
      />
    </div>
  );
}
