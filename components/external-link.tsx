"use client";

import * as React from "react";
import { ExternalOverlay } from "@/components/external-overlay";

/** Which vendor field /api/embed-check should test. */
export type EmbedCheckKind = "website";

interface ExternalLinkProps extends React.ComponentPropsWithoutRef<"a"> {
  href: string;
  /**
   * Whether the destination allows being framed:
   * - `true`  — known framable (e.g. the Google Maps embed view): always overlay.
   * - `false` / omitted — known blocked (e.g. Instagram) or unknown: plain
   *   new-tab link, exactly like `<a target="_blank">`.
   * - `{ vendorId, kind }` — ask /api/embed-check in the background on mount;
   *   the link upgrades to the overlay once (if) the check comes back positive.
   */
  embed?: boolean | { vendorId: string; kind: EmbedCheckKind };
  /** Overlay iframe source when it differs from href (Maps embed view). */
  embedSrc?: string;
  /** Overlay header label; defaults to the destination's hostname. */
  overlayTitle?: string;
}

/**
 * The app-wide default for external links. Renders a real anchor (so cmd/ctrl-
 * click, middle-click, and long-press keep native behavior), but intercepts a
 * plain left-click/tap to show the destination in an in-app overlay sheet when
 * the site allows framing. Sites that don't (their choice, enforced by the
 * browser) open in a new tab — the app's own tab is never navigated away.
 */
export function ExternalLink({
  href,
  embed,
  embedSrc,
  overlayTitle,
  onClick,
  children,
  ...anchorProps
}: ExternalLinkProps) {
  const [checked, setChecked] = React.useState<boolean | null>(
    typeof embed === "boolean" ? embed : embed === undefined ? false : null,
  );
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof embed !== "object" || embed === null) return;
    const controller = new AbortController();
    fetch(
      `/api/embed-check?vendorId=${encodeURIComponent(embed.vendorId)}&kind=${embed.kind}`,
      { signal: controller.signal },
    )
      .then((res) => (res.ok ? res.json() : { embeddable: false }))
      .then((data: { embeddable?: boolean }) => setChecked(!!data.embeddable))
      .catch(() => setChecked(false));
    return () => controller.abort();
  }, [embed]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    // Only take over an unmodified left click; anything else (cmd/ctrl/shift-
    // click, middle-click) keeps its native meaning. A still-pending check
    // (checked === null) falls through to the plain new-tab link — no dead ends.
    if (
      checked !== true ||
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        {...anchorProps}
      >
        {children}
      </a>
      {open && (
        <ExternalOverlay
          href={href}
          embedSrc={embedSrc ?? href}
          title={overlayTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
