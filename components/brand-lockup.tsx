import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

export const BRAND_NAME = "Wedding Recon";
export const BRAND_DOMAIN = "weddingrecon.com";
export const BRAND_TAGLINE = "Find local wedding intel. Manage your vendor search.";

const ICON_SIZE = { sm: "size-5", md: "size-7", lg: "size-14" } as const;
const NAME_SIZE = { sm: "text-sm", md: "text-base", lg: "text-lg" } as const;
const TAGLINE_SIZE = { sm: "text-xs", md: "text-xs", lg: "text-sm" } as const;

interface BrandLockupProps {
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  showDomain?: boolean;
  showTagline?: boolean;
  /** Render the wordmark in a muted tone — for footers and secondary spots. */
  muted?: boolean;
  className?: string;
}

/**
 * The Wedding Recon brand lockup: logo + wordmark, with optional domain and
 * tagline. Used across the app at different sizes — a large hero on the welcome
 * screen, a compact pill on the map, a muted footer on content pages.
 */
export function BrandLockup({
  orientation = "horizontal",
  size = "md",
  showDomain = false,
  showTagline = false,
  muted = false,
  className,
}: BrandLockupProps) {
  const vertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "flex",
        vertical
          ? "flex-col items-center gap-2 text-center"
          : "items-center gap-2",
        className,
      )}
    >
      <BrandMark className={ICON_SIZE[size]} />
      <div className={cn(vertical ? "space-y-0.5" : "flex flex-col leading-tight")}>
        <p
          className={cn(
            "font-heading font-semibold leading-none",
            NAME_SIZE[size],
            muted && "font-medium text-muted-foreground",
          )}
        >
          {BRAND_NAME}
        </p>
        {showDomain && (
          <p className="text-xs text-muted-foreground">{BRAND_DOMAIN}</p>
        )}
        {showTagline && (
          <p className={cn("text-muted-foreground", TAGLINE_SIZE[size])}>
            {BRAND_TAGLINE}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A quiet brand footer for the bottom of scrollable content pages (hub, vendor,
 * add, terms). Muted icon + wordmark + tagline, centered — present but not loud.
 */
export function BrandFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mt-8 flex justify-center border-t border-border/60 px-4 pb-6 pt-6",
        className,
      )}
    >
      <BrandLockup orientation="vertical" size="sm" showTagline muted />
    </footer>
  );
}
