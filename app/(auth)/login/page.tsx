"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { BrandLockup } from "@/components/brand-lockup";
import { OtpCodeForm } from "@/components/auth/otp-code-form";
import { createClient } from "@/lib/supabase/client";
import {
  clearPendingOtpEmail,
  getPendingOtpEmail,
  setPendingOtpEmail,
} from "@/lib/auth/pending-otp";
import { useIsStandalone } from "@/lib/use-standalone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Inside an installed PWA the emailed link is the one path that cannot work
  // (it opens in the browser, a separate cookie jar), so the code leads there.
  const isStandalone = useIsStandalone();

  // Reopen the code screen if a code is still outstanding. Reading the email
  // means leaving the app, and a backgrounded PWA is often killed — so coming
  // back to a blank form with a code in hand is the common case, not the edge.
  useEffect(() => {
    const t = setTimeout(() => {
      const pending = getPendingOtpEmail();
      if (!pending) return;
      setEmail(pending);
      setSent(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Where the back button returns to: the page that sent the guest here passes
  // a validated internal `from` path (e.g. a vendor page from the favorite
  // button). Falls back to Explore when there's no origin.
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const backHref =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : "/explore";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Inert with the current template, which renders {{ .SiteURL }}
          // /auth/callback itself and never reads {{ .RedirectTo }}. Kept
          // because it is what a template switched to {{ .ConfirmationURL }}
          // would read — changing one without the other changes nothing.
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message ?? "Something went wrong. Please try again.");
        return;
      }

      setPendingOtpEmail(email);
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // The back link and brand wrap BOTH steps. The code step used to return a bare
  // Card, which dropped the only link off this screen — combined with the
  // rehydrate reopening that step on launch, someone with an undelivered code
  // had no way back to the app at all.
  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Back to wherever the guest came from (Explore by default) */}
      <div className="w-full">
        <Link
          href={backHref}
          onClick={() => {
            // Leaving the login screen abandons the code step, so drop the
            // pending address too — otherwise returning to /login reopens a
            // code entry the person has already walked away from.
            clearPendingOtpEmail();
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {backHref === "/explore" ? "Back to explore" : "Back"}
        </Link>
      </div>

      {/* Brand */}
      <BrandLockup orientation="vertical" size="lg" showDomain showTagline />

      {sent ? (
        <Card className="w-full">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-5 text-primary" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a sign-in code to <strong>{email}</strong>. Enter it below
              to sign in — it expires in 1 hour.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <OtpCodeForm
              email={email}
              // Back to the email field with the address still in it, so a typo
              // is a correction rather than a retype.
              onBack={() => {
                clearPendingOtpEmail();
                setSent(false);
              }}
            />

            {/* The email also carries a link. In a browser it is the easier
                path, so say so; in the installed app it signs you in somewhere
                you cannot see, so warn instead of offering it. */}
            <p className="text-center text-xs text-muted-foreground">
              {isStandalone
                ? "The email also has a link, but it opens in your browser and will not sign you in here — use the code."
                : "The same email also has a sign-in link, if you would rather tap that."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">
              Log in or create an account
            </CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a sign-in code — no
              password needed. New here? The same code creates your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send sign-in code"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
