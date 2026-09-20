import { ChevronDown } from "lucide-react";

import { FAQ_ITEMS } from "@/lib/vendors/content";

/**
 * The vendor FAQ. Native <details>, same reasoning as the landing FAQ: the Base
 * UI Accordion unmounts a collapsed panel, so its answers would be missing from
 * the HTML a crawler reads, and <details> needs no JavaScript - which keeps
 * /vendors a zero-client-bundle Server Component.
 */
export function VendorFaq() {
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
          </div>
        </details>
      ))}
    </div>
  );
}
