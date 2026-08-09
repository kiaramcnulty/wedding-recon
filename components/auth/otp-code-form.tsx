"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { clearPendingOtpEmail } from "@/lib/auth/pending-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Supabase's email OTP length is a PROJECT SETTING (Authentication → Providers →
 * Email → Email OTP Length), not a constant — it defaults to 6 but is settable
 * from 6 to 10, and this project sends 8.
 *
 * So the form must not assert a length. It was written against a hardcoded 6,
 * and `maxLength` silently truncated an 8-digit code as it was typed: the code
 * was correct, the email was correct, and the box simply refused the last two
 * digits. Bound the input generously and let Supabase be the authority on
 * whether a code is right — the client cannot know the project's setting, and
 * guessing it is what broke this.
 */
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

/**
 * Seconds before "Send a new code" re-arms. Not security — Supabase enforces its
 * own send limit — but that limit is low (a couple an hour on the built-in
 * sender), and without a visible cooldown an impatient tap-tap-tap burns the
 * whole allowance and returns an error that reads like the app is broken.
 */
const RESEND_COOLDOWN_S = 30;

/**
 * Completes a sign-in from the numeric code in the email, IN THE APP.
 *
 * Why this exists at all: /auth/callback verifies the emailed link server-side
 * and hands the session cookies back to whichever browser opened it. A mail
 * client opens links in the default browser, and on iOS an installed PWA is a
 * separate storage container from Safari — so a perfectly successful link
 * sign-in leaves the PWA logged out, with nothing to fix at the redirect layer.
 *
 * Verifying the same OTP here mints the session in the calling context's own
 * cookie jar. `createBrowserClient` (@supabase/ssr) persists to cookies rather
 * than localStorage, so the middleware and every RSC see it immediately — no
 * other plumbing changes. The emailed link keeps working for browser users;
 * both credentials verify the same OTP and whichever is used first wins.
 *
 * The same fix covers in-app browsers (Instagram/Facebook link previews) and
 * typed-on-phone/opened-on-laptop, which fail for the same reason.
 */
export function OtpCodeForm({
  email,
  onBack,
  backLabel = "Use a different email",
}: {
  email: string;
  /**
   * Leaves the code step. Required, not optional: this screen is a dead end
   * without it — a mistyped address or an email that never arrives leaves
   * nothing to do but force-quit the app.
   */
  onBack: () => void;
  backLabel?: string;
}) {
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  // Starts at 0, so a resend is available immediately — arriving here after a
  // relaunch can be long after the code was sent, and making someone wait out a
  // timer for an email they never got is the opposite of a way out.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Kept identical to the original send so the two cannot drift; inert
          // with the current template (see the call sites for why).
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      });

      if (sendError) {
        // Most often the send rate limit. Surfacing the real message beats a
        // generic one here: "email rate limit exceeded" tells someone to wait,
        // where "something went wrong" tells them to keep tapping.
        setError(sendError.message ?? "Could not send a new code.");
        return;
      }

      // Clear the box: whatever is in it belongs to the superseded email, and
      // leaving it there invites submitting the old code against the new one.
      setCode("");
      setCooldown(RESEND_COOLDOWN_S);
      toast.success(`New code sent to ${email}`);
    } catch {
      setError("Could not send a new code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < MIN_CODE_LENGTH) {
      setError("Enter the full code from your email.");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        // Covers both templates: an existing user gets "Magic Link", a brand-new
        // address gets "Confirm signup", and `email` verifies the token from
        // either — the same reason /auth/callback sends type=email for both.
        type: "email",
      });

      if (verifyError) {
        // Supabase does not distinguish wrong from expired here, and guessing
        // would be worse than saying so: both are fixed the same way.
        setError("That code is not valid or has expired. Check the latest email, or request a new code.");
        setVerifying(false);
        return;
      }

      // Consumed: without this, a later visit to /login would reopen the code
      // screen for a code that has already been spent.
      clearPendingOtpEmail();

      // Signed in. /auth/post-signin decides onboarding vs explore from the
      // cookies we just wrote, so this must be a full document load — a
      // client-side push would not carry them. Deliberately not router.push:
      // the whole point is to hand the new session to the server.
      window.location.assign("/auth/post-signin");
    } catch {
      setError("Something went wrong. Please try again.");
      setVerifying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otp-code">Sign-in code</Label>
        <Input
          id="otp-code"
          value={code}
          onChange={(e) =>
            // Strip as typed: people paste the code with stray spaces, and a
            // non-digit would only fail at Supabase.
            setCode(e.target.value.replace(/\D/g, "").slice(0, MAX_CODE_LENGTH))
          }
          // Numeric keypad on mobile without the spinners/validation of
          // type="number", which also mangles a leading zero.
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={MAX_CODE_LENGTH}
          disabled={verifying}
          autoFocus
          // `md:text-lg` is load-bearing: Input's base carries `md:text-sm`,
          // which is a different variant from `text-lg` and so survives merging.
          className="h-11 text-center text-lg font-medium tracking-[0.4em] md:text-lg"
          aria-describedby={error ? "otp-error" : undefined}
          aria-invalid={!!error}
        />
        {error ? (
          <p id="otp-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={verifying || code.length < MIN_CODE_LENGTH}
      >
        {verifying ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Verifying…
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      {/* The two ways out. Both are type="button" — inside a <form> the default
          is submit, which would fire the verify handler instead. */}
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleResend}
          disabled={resending || cooldown > 0 || verifying}
        >
          {resending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : cooldown > 0 ? (
            `Send a new code (${cooldown}s)`
          ) : (
            "Send a new code"
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onBack}
          disabled={verifying}
        >
          {backLabel}
        </Button>
      </div>
    </form>
  );
}
