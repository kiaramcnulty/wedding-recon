import { cn } from "@/lib/utils";
import {
  PREVIEW_SECTION,
  VERIFICATION_BENEFITS,
  type BenefitId,
} from "@/lib/vendors/content";

/**
 * The "What you get" band on /for-vendors: the four VERIFICATION_BENEFITS as a
 * numbered list, beside two phone screenshots (a verified vendor page and the
 * Explore list) carrying matching numbered markers - so each benefit points at
 * where a couple actually sees it.
 *
 * Markers name the benefit by `id`; the number shown is that benefit's position
 * in VERIFICATION_BENEFITS, so reordering the constant renumbers the list and
 * the markers together.
 *
 * Unlike the landing page's AppVisual (drawn in code, generic on purpose),
 * these ARE screenshots - stylized mock-ups of a fictional venue, captured from
 * the app with sample data - because the point is to show a vendor exactly
 * what their page and card look like. The caption says they are illustrative.
 * Plain <img> with an explicit size, never next/image (see CLAUDE.md: Vercel
 * Image Optimization is billed).
 *
 * Markers are positioned in PERCENT of the 390x844 capture, so they stay on
 * their element at every rendered size. If the screenshots are re-captured,
 * re-measure these.
 */

const SHOT_W = 780;
const SHOT_H = 1688;

type Marker = { id: BenefitId; left: string; top: string };

const numberOf = (id: BenefitId) =>
  VERIFICATION_BENEFITS.findIndex((b) => b.id === id) + 1;

// Search results first: "Higher visibility" leads the list, so its phone leads too.
const PHONES: { src: string; label: string; alt: string; markers: Marker[] }[] =
  [
    {
      src: "/for-vendors/search-feed.png",
      label: PREVIEW_SECTION.feedLabel,
      alt: "The Explore list: three verified venues with Verified pills at the top, then unverified venues below.",
      markers: [{ id: "visibility", left: "3%", top: "34.7%" }],
    },
    {
      src: "/for-vendors/verified-page.png",
      label: PREVIEW_SECTION.pageLabel,
      alt: "A verified vendor page: a blue Vendor verified badge, outlined detail tags, the vendor's own photos, an intro, a starting price and a Book a tour button.",
      markers: [
        { id: "checkmark", left: "72%", top: "5.6%" },
        { id: "details", left: "3%", top: "19.4%" },
        { id: "cta", left: "4%", top: "61.5%" },
      ],
    },
  ];

function MarkerDot({
  n,
  className,
  style,
}: {
  n: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full bg-verified text-xs font-bold text-white shadow-[0_2px_6px_rgb(29_78_216/0.4)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

export function VerificationPreview() {
  return (
    <div className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="lg:pt-10">
        <ol className="flex flex-col gap-7">
          {VERIFICATION_BENEFITS.map((b, i) => (
            <li key={b.id} className="flex items-start gap-3">
              <MarkerDot n={i + 1} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1.5 font-heading font-semibold">
                  <b.icon className="size-4 text-verified" aria-hidden />
                  {b.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {b.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-7 text-xs text-muted-foreground">
          {PREVIEW_SECTION.caption}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-6">
        {PHONES.map((phone) => (
          <figure key={phone.src} className="mx-auto w-full max-w-[300px]">
            <figcaption className="mb-3 font-heading text-sm font-semibold">
              {phone.label}
            </figcaption>
            <div className="relative">
              <div className="overflow-hidden rounded-[28px] border-[6px] border-foreground bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={phone.src}
                  alt={phone.alt}
                  width={SHOT_W}
                  height={SHOT_H}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              </div>
              {phone.markers.map((m) => (
                <MarkerDot
                  key={m.id}
                  n={numberOf(m.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 ring-2 ring-white"
                  style={{ left: m.left, top: m.top }}
                />
              ))}
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
