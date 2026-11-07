"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A focused bottom sheet over the map: one filter (Budget, Setting, Distance)
 * or the Advanced list, then back to the same map. Built on the Base UI dialog
 * the app's other dialogs use, so it traps focus, closes on Escape and on a
 * tap outside, and returns focus to the chip that opened it.
 *
 * `dim={false}` keeps the map fully visible behind it: the distance sheet
 * previews the ring live while the slider moves, so the map must stay readable.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  dim = true,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dim?: boolean;
  /** The field to focus on open (a sheet with one input). */
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            dim ? "bg-black/20" : "bg-transparent",
          )}
        />
        <DialogPrimitive.Popup
          initialFocus={initialFocus}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-popover text-popover-foreground shadow-2xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom-8 data-closed:animate-out data-closed:slide-out-to-bottom-8"
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && (
            <div className="border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
