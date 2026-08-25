"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { UserRound, LogIn, LogOut, X, Mail, Info, Store } from "lucide-react";

import { LANDING_HREF } from "@/lib/landing/nav";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "user"; username: string; email: string };

function getInitials(name: string): string {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || name.slice(0, 2).toUpperCase()
  );
}

/**
 * Top-right account control. Indicates whether the visitor is a Guest or a
 * signed-in user, and opens a drawer: Guests get a login button; signed-in
 * users see their username, email, and a sign-out button.
 */
export function ProfileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [mounted, setMounted] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Portals require the DOM, so only render the drawer after mount. setState is
  // deferred via setTimeout to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      // getClaims() verifies the JWT locally (the project uses asymmetric
      // signing keys), where getUser() was a network round trip to the Auth
      // server — paid on every page this menu renders on, which is nearly all
      // of them, and serially in front of the profile query below.
      const { data: claimsData } = await supabase.auth.getClaims();
      if (!active) return;
      const claims = claimsData?.claims;
      if (!claims?.sub) {
        setAuth({ status: "guest" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", claims.sub)
        .maybeSingle();
      if (!active) return;
      setAuth({
        status: "user",
        username: profile?.username ?? "You",
        email: typeof claims.email === "string" ? claims.email : "",
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close on Escape. When the feedback dialog is layered on top, let it handle
  // Escape first so one press dismisses only the dialog, not the whole drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !feedbackOpen) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, feedbackOpen]);

  const isUser = auth.status === "user";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isUser ? "Account" : "Account — browsing as guest"}
        title={isUser ? auth.username : "Guest"}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground",
          className,
        )}
      >
        {isUser ? (
          <Avatar size="sm">
            <AvatarFallback>{getInitials(auth.username)}</AvatarFallback>
          </Avatar>
        ) : (
          <UserRound className="size-[18px]" />
        )}
      </button>

      {/* Drawer — portaled to <body> so a transformed/filtered ancestor (e.g.
          a header with backdrop-blur) can't trap its fixed positioning.
          Always mounted so it can animate; inert when closed. */}
      {mounted &&
        createPortal(
          <div
            className={cn(
              "fixed inset-0 z-50",
              open ? "pointer-events-auto" : "pointer-events-none",
            )}
            aria-hidden={!open}
          >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account"
          className={cn(
            "absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-background shadow-xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-heading text-sm font-semibold">Account</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {auth.status === "loading" && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {auth.status === "guest" && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="size-[18px]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Guest</p>
                    <p className="text-xs text-muted-foreground">
                      You&apos;re browsing without an account
                    </p>
                  </div>
                </div>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ size: "lg" }), "w-full gap-2")}
                >
                  <LogIn className="size-4" />
                  Sign up/log in
                </Link>
              </>
            )}

            {auth.status === "user" && (
              <>
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>
                      {getInitials(auth.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {auth.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {auth.email}
                    </p>
                  </div>
                </div>
                <form action={signOut}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </Button>
                </form>
              </>
            )}
          </div>

          <div className="mt-auto space-y-3 border-t p-4">
            {/* The way back to the landing page from Explore, which is a
                full-bleed map with no BrandFooter to link out of. LANDING_HREF
                (not "/") so the first-visit gate renders it instead of
                bouncing the visit straight back here. */}
            <Link
              href={LANDING_HREF}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              <Info className="size-4 shrink-0" />
              About Wedding Recon
            </Link>
            {/* Vendor entry point. A guest tapping this lands on /portal, which
                sends them to sign in and back. */}
            <Link
              href="/portal"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              <Store className="size-4 shrink-0" />
              Are you a vendor?
            </Link>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail className="size-4 shrink-0" />
              Questions or feedback?
            </button>
          </div>
        </div>
          </div>,
          document.body,
        )}

        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Questions or feedback?</DialogTitle>
              <DialogDescription>
                Please send any questions or feedback to the site creator,{" "}
                <a href="mailto:kiaramcnulty@gmail.com">
                  kiaramcnulty@gmail.com
                </a>
                . Responses are typically received within 1 business day.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
    </>
  );
}
