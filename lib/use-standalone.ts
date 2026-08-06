"use client";

import { useEffect, useState } from "react";

/**
 * True when the app is running as an INSTALLED PWA rather than a browser tab.
 *
 * Used to decide which sign-in instruction leads. In a browser the emailed link
 * is the easy path (one tap, no typing); inside an installed PWA it is the one
 * path that cannot work, because the mail client opens it in the default browser
 * — a separate cookie/storage container on iOS — so the session never reaches
 * the app the person is looking at. There the emailed code has to lead.
 *
 * Starts false so the server render and first client render agree; it flips
 * after mount. Both branches render the same controls, so the correction is a
 * change of emphasis and copy, never a control appearing or disappearing.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    // Deferred a tick: satisfies react-hooks/set-state-in-effect, same pattern
    // the portal mounts use.
    const t = setTimeout(() => {
      // `display-mode: standalone` is the spec answer and covers Android/Chrome
      // WebAPKs plus desktop installs. iOS Safari only started reporting it
      // reliably recently, so the legacy `navigator.standalone` stays as an OR —
      // iOS is precisely the platform this hook exists for.
      const byDisplayMode = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      const byIosLegacy =
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true;

      setStandalone(byDisplayMode || byIosLegacy);
    }, 0);

    return () => clearTimeout(t);
  }, []);

  return standalone;
}
