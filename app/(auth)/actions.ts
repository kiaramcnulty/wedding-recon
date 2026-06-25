"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Set (or update) the current user's anonymous display username and record TOS acceptance.
 * Validates length, trims whitespace, and maps the Postgres unique-violation
 * error (23505) to a user-friendly message returned as a string rather than
 * thrown, so the client can surface it inline.
 *
 * Returns null on success (the action then redirects to /explore).
 * Returns an error message string when validation or DB write fails.
 */
export async function setUsername(
  formData: FormData | string,
  tosAgreed?: boolean,
): Promise<string | null> {
  const raw =
    typeof formData === "string"
      ? formData
      : (formData.get("username") as string | null) ?? "";

  const username = raw.trim();

  if (username.length < 2 || username.length > 30) {
    return "Username must be between 2 and 30 characters.";
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const updates: Record<string, unknown> = { username };
  if (tosAgreed) {
    updates.tos_accepted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    // Postgres unique-violation
    if (error.code === "23505") {
      return "That username is already taken. Please try another.";
    }
    return error.message ?? "Something went wrong. Please try again.";
  }

  redirect("/explore");
}

/** Sign the current user out and send them to the login screen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
