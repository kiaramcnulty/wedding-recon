"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Info } from "lucide-react";

const MESSAGE =
  "Wedding Recon is a newer site. To ensure great coverage of vendor intel, AI helped us aggregate existing intel across existing internet sources.";

/**
 * Subtle indicator that a recon entry was authored by an internal bot account
 * (enrichvenues pipeline). Renders a small robot + info glyph; hovering (desktop)
 * or tapping (mobile) reveals a short transparency note.
 *
 * The note is portaled to document.body because the containing Card sets
 * `overflow-hidden`, which would otherwise clip an in-flow popover.
 */
export function BotReconBadge() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const POPOVER_WIDTH = 260;

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Right-align the popover to the trigger, opening upward.
    const left = Math.max(
      8,
      Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8)
    );
    const top = rect.top - 8;
    setCoords({ top, left });
  }, []);

  const show = useCallback(() => {
    position();
    setOpen(true);
  }, [position]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Why AI helped with this recon"
        className="inline-flex items-center gap-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none"
        onClick={() => (open ? hide() : show())}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") hide();
        }}
      >
        <Bot className="size-3.5" aria-hidden />
        <Info className="size-2.5" aria-hidden />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              transform: "translateY(-100%)",
            }}
            className="z-50 rounded-lg bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {MESSAGE}
          </div>,
          document.body
        )}
    </>
  );
}
