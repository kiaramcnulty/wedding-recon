import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { postSignInPath } from "@/lib/auth/post-signin";
import {
  POST_SIGNIN_INTENT_COOKIE,
  readSignInDestinationCookie,
} from "@/lib/auth/post-signin-redirect";

/**
 * Completes a sign-in from the EMAILED LINK.
 *
 * Scope limit worth knowing before you debug a "magic link didn't log me in"
 * report: this mints the session server-side and hands the cookies back on the
 * redirect, so they land in whichever browser made the request. Email links are
 * opened by the mail client in the default browser, which on iOS is a different
 * storage container from an installed home-screen PWA — so this route can never
 * sign someone in *inside the PWA*. That is what the emailed-code path is for
 * (components/auth/otp-code-form.tsx); it is not a redirect bug to be fixed here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  // Email sign-in links can arrive in one of two shapes:
  //   • token_hash + type — the stateless OTP flow. Verified server-side against
  //     Supabase, so it works even when the link is opened in a DIFFERENT browser
  //     than the one that requested it (e.g. email submitted in an in-app browser,
  //     link tapped from the Mail app which opens Safari). This is the primary
  //     flow — see supabase/templates/magic-link.html.
  //   • code — the legacy PKCE exchange. Requires the code-verifier cookie set by
  //     the browser that requested the link, so it silently fails across browsers.
  //     Kept as a fallback for any PKCE links still in flight.
  let authFailed = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    authFailed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authFailed = Boolean(error);
  } else {
    // No credentials — malformed or expired link; send back to login.
    return NextResponse.redirect(`${origin}/login`);
  }

  if (authFailed) {
    // Verification failed (expired, already used, etc.)
    return NextResponse.redirect(`${origin}/login`);
  }

  // Onboarding (new user) vs the intent they arrived with vs explore (returning)
  // — shared with the code path so both sign-in routes land in the same place.
  const intended = readSignInDestinationCookie(
    request.cookies.get(POST_SIGNIN_INTENT_COOKIE)?.value,
  );
  const dest = await postSignInPath(supabase, intended);

  const res = NextResponse.redirect(`${origin}${dest}`);
  // Consumed once we route somewhere real; kept through onboarding so
  // setUsername can honor it after the new account is set up.
  if (dest !== "/onboarding") {
    res.cookies.set(POST_SIGNIN_INTENT_COOKIE, "", { maxAge: 0, path: "/" });
  }
  return res;
}
