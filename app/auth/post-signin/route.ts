import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { postSignInPath } from "@/lib/auth/post-signin";
import {
  POST_SIGNIN_INTENT_COOKIE,
  readSignInDestinationCookie,
} from "@/lib/auth/post-signin-redirect";

/**
 * Destination hop for the emailed-code path.
 *
 * The code is verified in the BROWSER (so the session lands in the calling
 * context's own cookie jar — the whole point of the code, see
 * components/auth/otp-code-form.tsx). That leaves the client holding a session
 * but not knowing whether this account still needs onboarding, so it navigates
 * here and this route answers with the same routing rule /auth/callback uses.
 *
 * Reached by a full document load, not a client-side push: the redirect target
 * is decided from the cookies on THIS request, so they have to be sent.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // The destination the visitor arrived with (e.g. /portal), stashed by the
  // login page. Honored unless this account still needs onboarding — in which
  // case the cookie is left in place so setUsername can honor it afterwards.
  const intended = readSignInDestinationCookie(
    request.cookies.get(POST_SIGNIN_INTENT_COOKIE)?.value,
  );
  const dest = await postSignInPath(supabase, intended);

  const res = NextResponse.redirect(`${origin}${dest}`);
  if (dest !== "/onboarding") {
    res.cookies.set(POST_SIGNIN_INTENT_COOKIE, "", { maxAge: 0, path: "/" });
  }
  return res;
}
