"use client";

import * as React from "react";

/**
 * How long a card has to stay on screen before its link prefetches. Long
 * enough that a flick through the feed prefetches nothing, short enough that a
 * card the couple has stopped to read is ready well before the tap.
 */
const DWELL_MS = 600;

/**
 * Arms a `<Link>`'s prefetch only once a tap is likely: the card has sat at
 * least half in view for DWELL_MS, or it got a sign of intent (a touch, a
 * pointer over it, keyboard focus). Use as
 * `<Link prefetch={armed ? null : false} {...intent}>` with `ref` on the card.
 *
 * Why: a vendor page is dynamic, so prefetching its `loading.tsx` boundary is
 * a server render (and runs `generateMetadata`, a database read) -- a billed
 * function invocation per card. Next prefetches every Link that scrolls into
 * view, so scrolling the Explore list cost about one invocation per card
 * passed, two requests each (2026-11-14; docs/notes/function-cpu.md). Gating
 * on dwell keeps the instant-skeleton tap on the cards people actually stop at,
 * which is the whole reason these cards are Links (CLAUDE.md).
 *
 * Flipping `prefetch` from false to null re-registers the Link with Next's
 * viewport observer (its ref callback depends on it), so arming a card that is
 * on screen prefetches it immediately.
 */
export function useIntentPrefetch<T extends Element>(): {
  ref: React.RefObject<T | null>;
  armed: boolean;
  intent: {
    onPointerEnter: () => void;
    onTouchStart: () => void;
    onFocus: () => void;
  };
} {
  const ref = React.useRef<T>(null);
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (armed) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer to wait on: fall back to Next's default behavior.
      const t = setTimeout(() => setArmed(true), 0);
      return () => clearTimeout(t);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting) timer = setTimeout(() => setArmed(true), DWELL_MS);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [armed]);

  const arm = React.useCallback(() => setArmed(true), []);
  const intent = React.useMemo(
    () => ({ onPointerEnter: arm, onTouchStart: arm, onFocus: arm }),
    [arm],
  );
  return { ref, armed, intent };
}
