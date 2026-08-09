import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where a freshly authenticated user belongs: onboarding while their profile
 * still carries the auto-generated placeholder username, otherwise Explore.
 *
 * Shared by BOTH sign-in completions so they can never disagree about where a
 * login lands:
 *   • the emailed link  — /auth/callback, verified server-side;
 *   • the emailed code  — verified in the browser, then bounced through
 *     /auth/post-signin purely to run this check.
 *
 * Returns "/login" when there's no session, so a caller can redirect blindly.
 */
export async function postSignInPath(
  supabase: SupabaseClient,
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

  return "/explore";
}
