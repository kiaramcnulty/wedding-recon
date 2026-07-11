"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ExternalLink as ExternalLinkIcon, Loader2, X } from "lucide-react";

interface ExternalOverlayProps {
  /** Real destination — used by the header's "open in new tab" escape hatch. */
  href: string;
  /** What the iframe loads; differs from href for special embed views (Maps). */
  embedSrc: string;
  /** Header label; defaults to the destination's hostname. */
  title?: string;
  onClose: () => void;
}

/**
 * Full-height sheet that shows an external site in a sandboxed iframe without
 * navigating away from the app. Only rendered for destinations already known
 * to allow framing (see <ExternalLink>); sites that block it never get here.
 *
 * Rendered on demand (post-click), so unlike always-mounted portals it needs
 * no mounted-state guard — the DOM exists by the time this component exists.
 */
export function ExternalOverlay({
  href,
  embedSrc,
  title,
  onClose,
}: ExternalOverlayProps) {
  const [loaded, setLoaded] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  const label = React.useMemo(() => {
    if (title) return title;
    try {
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return href;
    }
  }, [title, href]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // The iframe swallows keyboard focus, so put it on the close button first.
    closeRef.current?.focus();
    // Lock background scroll while the sheet is up (the iframe scrolls itself).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl animate-in slide-in-from-bottom-8 fade-in-0 duration-200"
      >
        {/* Header: domain · open-in-new-tab · close */}
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {label}
          </span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in new tab"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLinkIcon className="size-4" />
          </a>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Embedded site */}
        <div className="relative flex-1 bg-white">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            src={embedSrc}
            title={label}
            onLoad={() => setLoaded(true)}
            // No allow-top-navigation: a framebusting script can't hijack the
            // app tab — worst case the frame stays put and the user uses the
            // header's open-in-new-tab button.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
