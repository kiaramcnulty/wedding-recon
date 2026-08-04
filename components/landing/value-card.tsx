import { Quote as QuoteIcon } from "lucide-react";

import type { ValueProp } from "@/lib/landing/content";

/**
 * One carousel card: what the product does, and a verbatim quote from a couple
 * who felt its absence.
 *
 * A Server Component on purpose. It renders the `<li>` itself so the cards can
 * be passed to ValueCarousel as children rather than as data - `icon` is a
 * React component, and a function cannot cross the server/client boundary
 * (build error: "Functions cannot be passed directly to Client Components").
 * Rendering here also keeps every quote in the server HTML for crawlers.
 */
export function ValueCard({ icon: Icon, title, quote }: ValueProp) {
  return (
    <li className="flex min-w-0 shrink-0 basis-[86%] snap-start flex-col rounded-2xl border bg-background p-5 shadow-sm sm:basis-[58%] lg:basis-[38%]">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <Icon className="size-5" aria-hidden />
      </span>

      <h3 className="mt-4 font-heading text-base font-semibold">{title}</h3>

      <figure className="mt-4 flex flex-1 flex-col">
        <QuoteIcon className="size-4 shrink-0 text-brand/40" aria-hidden />
        <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {quote.text}
        </blockquote>
        <figcaption className="mt-4 border-t pt-3 text-xs">
          <span className="font-medium text-foreground">{quote.name}</span>
          <span className="text-muted-foreground"> · {quote.context}</span>
        </figcaption>
      </figure>
    </li>
  );
}
