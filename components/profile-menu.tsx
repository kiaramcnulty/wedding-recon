"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { UserRound, LogIn, LogOut, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setAuth({ status: "guest" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setAuth({
        status: "user",
        username: profile?.username ?? "You",
        email: user.email ?? "",
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
        </div>
          </div>,
          document.body,
        )}
    </>
  );
}
