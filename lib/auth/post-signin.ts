import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeSignInDestination } from "./post-signin-redirect";

/**
 * Where a freshly authenticated user belongs: onboarding while their profile
 * still carries the auto-generated placeholder username; otherwise the intent
 * they arrived with (a validated internal path, e.g. /portal for a vendor
 * verifying their business) if there is one, else Explore.
 *
 * Shared by BOTH sign-in completions so they can never disagree about where a
 * login lands:
 *   • the emailed link  — /auth/callback, verified server-side;
 *   • the emailed code  — verified in the browser, then bounced through
 *     /auth/post-signin purely to run this check.
 *
 * `intendedPath` comes from the intent cookie those routes read (see
 * lib/auth/post-signin-redirect.ts). Onboarding still wins over it — a brand-new
 * account must set a username and accept the Terms first; setUsername honors the
 * same intent once that is done.
 *
 * Returns "/login" when there's no session, so a caller can redirect blindly.
 */
export async function postSignInPath(
  supabase: SupabaseClient,
  intendedPath?: string | null,
): Promise<string> {
  // A write path: worth the Auth round trip getClaims() would save, since this
  // runs once per sign-in and the very next thing we do is trust the identity.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/login";

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile || profile.username.startsWith("user_")) return "/onboarding";

  return sanitizeSignInDestination(intendedPath) ?? "/explore";
}
