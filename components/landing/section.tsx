import { cn } from "@/lib/utils";

/**
 * Page gutter + column width for every band on a marketing page, and the
 * eyebrow/heading pair that opens one.
 *
 * Extracted from `app/page.tsx` (2026-09-20) when `/vendors` became the second
 * marketing surface. Both pages have to agree on gutter, max width and
 * scroll-margin or they read as two different sites.
 */
export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // scroll-mt keeps an anchored section's heading clear of the sticky
    // header, which would otherwise cover it when a nav link jumps here.
    <section
      className={cn("px-5 py-14 md:py-20", id && "scroll-mt-16", className)}
      id={id}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {children}
      </h2>
    </>
  );
}
