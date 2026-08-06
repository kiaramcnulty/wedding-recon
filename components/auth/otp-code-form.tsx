"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

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
export function OtpCodeForm({ email }: { email: string }) {
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    </form>
  );
}
