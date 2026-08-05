import { ArrowDown, Check, Quote as QuoteIcon } from "lucide-react";

import { AppVisual } from "@/components/landing/app-visual";
import type { ProblemSolution } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/**
 * One problem/solution pair, as a full-width row: what is broken in a couple's
 * own words on one side, what the product does about it - with the matching
 * in-app visual - on the other.
 *
 * Rows alternate sides down the page. A Server Component, so all four pairs and
 * all four quotes are in the HTML a crawler reads; the earlier carousel put
 * three of them behind horizontal scroll and left no room for a visual, which
 * is what this layout is for.
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
        <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          {item.problem}
        </h3>

        <figure className="mt-4 border-l-2 border-brand/25 pl-4">
          <QuoteIcon className="size-4 text-brand/40" aria-hidden />
          <blockquote className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {item.quote.text}
          </blockquote>
          <figcaption className="mt-2.5 text-xs">
            <span className="font-medium text-foreground">
              {item.quote.name}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {item.quote.context}
            </span>
          </figcaption>
        </figure>

        <ArrowDown
          className="mt-6 size-4 text-brand/50"
          aria-hidden
        />

        <div className="mt-3 rounded-2xl border border-brand/20 bg-brand-soft/40 p-4">
          <p className="flex items-start gap-2 font-heading text-base font-semibold">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {item.solution}
          </p>
          <p className="mt-2 pl-6 text-sm leading-relaxed text-muted-foreground">
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
