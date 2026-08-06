import { ArrowDown } from "lucide-react";

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
        "font-heading text-2xl leading-none text-brand/35",
        closing ? "align-bottom" : "align-top",
      )}
    >
      {closing ? "”" : "“"}
    </span>
  );
}

/**
 * One problem/solution pair as a carousel card: the problem in a couple's own
 * words, an arrow, then what the product does about it beside a plain icon.
 *
 * Sized to fit one phone screen (Kiara, 2026-08-04) - hence the icon rather
 * than the in-app mock-up the full-width rows used to carry, and hence the tight
 * type scale. If a quote grows, check it still fits at 390x844 before shipping;
 * the constraint is the card, not the copy field.
 *
 * A Server Component, so all four pairs and all four quotes are in the HTML a
 * crawler reads whether or not their card is the one on screen.
 */
export function ProblemCard({ item }: { item: ProblemSolution }) {
  const { icon: Icon } = item;

  return (
    <li className="flex min-w-0 shrink-0 basis-[88%] snap-start flex-col rounded-2xl border bg-background p-6 shadow-sm sm:basis-[64%] lg:basis-[46%]">
      <h3 className="font-heading text-xl font-semibold leading-snug tracking-tight">
        {item.problem}
      </h3>

      <figure className="mt-4">
        <blockquote className="text-sm italic leading-relaxed text-muted-foreground">
          <QuoteMark />
          {item.quote.text}
          <QuoteMark closing />
        </blockquote>
        <figcaption className="mt-3 text-xs not-italic">
          <span className="font-medium text-foreground">{item.quote.name}</span>
          <span className="text-muted-foreground"> · {item.quote.context}</span>
        </figcaption>
      </figure>

      {/* The hinge between the two halves. Decorative - the labels above and
          below already say which is which. */}
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <ArrowDown className="size-4 text-brand" />
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* The icon sits beside the label and title; the body runs the full card
          width beneath. Keeping the body in the icon's column squeezed it into
          about 200px on a phone and wrapped it to eight lines. */}
      <div className="mt-auto rounded-xl border border-brand/25 bg-brand-soft/50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
              {PROBLEMS_SECTION.solutionLabel}
            </p>
            <p className="mt-1 font-heading text-base font-semibold leading-snug">
              {item.solution}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {item.solutionBody}
        </p>
      </div>
    </li>
  );
}
