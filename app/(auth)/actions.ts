"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ATTRIBUTION_COOKIE,
  parseAttribution,
  type Attribution,
} from "@/lib/analytics/attribution";
import {
  POST_SIGNIN_INTENT_COOKIE,
  readSignInDestinationCookie,
} from "@/lib/auth/post-signin-redirect";
import { captureServer } from "@/lib/analytics/posthog-server";
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

  // Is this the one-time onboarding completion, or a later username edit?
  // tos_accepted_at is null until onboarding accepts the Terms, so a null-before
  // + tosAgreed-now is the account activating. We tie both the conversion event
  // and the first-touch stamp to this so neither can double-fire or clobber the
  // original source on a subsequent edit.
  const { data: existing } = await supabase
    .from("profiles")
    .select("tos_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  const isOnboarding = !existing?.tos_accepted_at && !!tosAgreed;

  // First-touch marketing source, recorded in the browser and read back here.
  // Only read + parse on actual onboarding, and never let a corrupted cookie
  // value (a bad decode) throw out of a signup.
  let attribution: Attribution | null = null;
  if (isOnboarding) {
    const rawAttr = (await cookies()).get(ATTRIBUTION_COOKIE)?.value;
    let decoded: string | null = null;
    if (rawAttr) {
      try {
        decoded = decodeURIComponent(rawAttr);
      } catch {
        decoded = rawAttr; // tolerate a value that was not percent-encoded
      }
    }
    attribution = parseAttribution(decoded);
  }

  const updates: Record<string, unknown> = { username };
  if (tosAgreed) {
    updates.tos_accepted_at = new Date().toISOString();
  }
  if (attribution) {
    updates.utm_source = attribution.utm_source ?? null;
    updates.utm_medium = attribution.utm_medium ?? null;
    updates.utm_campaign = attribution.utm_campaign ?? null;
    updates.referrer_host = attribution.referrer_host ?? null;
    updates.landing_path = attribution.landing_path ?? null;
    updates.attributed_at = new Date().toISOString();
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

  // Conversion event, fired server-side because the success path below is a
  // redirect() (no client success moment) and a server event can't be
  // ad-blocked. Stamps the account's first-touch source as $set_once person
  // properties. No-ops without a PostHog key. Runs only on actual onboarding.
  if (isOnboarding) {
    const setOnce: Record<string, unknown> = {};
    if (attribution?.utm_source) setOnce.initial_utm_source = attribution.utm_source;
    if (attribution?.utm_medium) setOnce.initial_utm_medium = attribution.utm_medium;
    if (attribution?.utm_campaign)
      setOnce.initial_utm_campaign = attribution.utm_campaign;
    if (attribution?.referrer_host)
      setOnce.initial_referrer_host = attribution.referrer_host;
    await captureServer(user.id, "signup_completed", undefined, setOnce);
  }

  // Honor a sign-in intent carried through onboarding (a new vendor who came in
  // via "Verify this business" lands on /portal, not /explore). The auth routes
  // leave the cookie in place while routing to onboarding; consume it here.
  const jar = await cookies();
  const intended = readSignInDestinationCookie(
    jar.get(POST_SIGNIN_INTENT_COOKIE)?.value,
  );
  if (intended) {
    jar.set(POST_SIGNIN_INTENT_COOKIE, "", { maxAge: 0, path: "/" });
  }

  redirect(intended ?? "/explore");
}

/** Sign the current user out and send them to the login screen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
