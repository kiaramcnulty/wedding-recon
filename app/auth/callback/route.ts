import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

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

  // Determine where to send the user: onboarding (new user) vs explore (returning).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  // If the username is still the auto-generated placeholder, send to onboarding.
  if (!profile || profile.username.startsWith("user_")) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}/explore`);
}
