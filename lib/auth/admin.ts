import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Whether a user id belongs to a site admin (profiles.is_admin).
 *
 * This is the ONE place app code asks "is this account an admin", so the growing
 * set of admin-gated features share a single definition. It is a UI/gating
 * convenience, not the security boundary: every admin-only write is also
 * enforced in RLS (see migration 0041), so this failing open would still be
 * caught at the database.
 *
 * Deliberately forgiving: a null/blank user id is not an admin, and a query
 * error resolves to `false` rather than throwing — an admin check that errors
 * must never grant access, and must never break a public page (the vendor page
 * calls this for logged-out viewers). `profiles` is public-read, so this works
 * under the caller's own RLS with no privileged client.
 */
export async function isAdminUser(
  supabase: ServerClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return (data as { is_admin?: boolean } | null)?.is_admin === true;
}
