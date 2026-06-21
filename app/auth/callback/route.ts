import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // No code — malformed or expired link; send back to login.
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    // Exchange failed (expired, already used, etc.)
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
