import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { FAQ_ITEMS } from "@/lib/landing/content";

/**
 * The FAQ, built on native <details> rather than the Base UI Accordion used
 * elsewhere in the app.
 *
 * Two reasons, both specific to a marketing page: the accordion unmounts a
 * collapsed panel, so the answers would be missing from the server-rendered
 * HTML a crawler reads, and <details> needs no JavaScript at all — this keeps
 * the whole landing page a zero-client-bundle Server Component.
 */
export function LandingFaq() {
  return (
    <div className="divide-y rounded-2xl border bg-card px-5">
      {FAQ_ITEMS.map((item) => (
        <details key={item.question} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="pb-4 pr-8 text-sm leading-relaxed text-muted-foreground">
            {item.answer}
            {item.link && (
              <>
                {" "}
                <Link
                  href={item.link.href}
                  className="font-medium text-brand-ink underline underline-offset-2"
                >
                  {item.link.label}
                </Link>
                .
              </>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
