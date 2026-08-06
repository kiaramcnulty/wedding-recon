"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getResumeFlag } from "@/lib/recon-draft";

/**
 * Mounted in the (app) shell. When a guest publishes a recon they're emailed a
 * sign-in code; after they authenticate they land on whichever page the auth
 * flow chooses (onboarding → explore, or explore directly). If a publish is
 * still pending (localStorage flag set) and they're now signed in, route them to
 * the resume step so their saved draft gets published.
 *
 * This hop is what lets the code path skip straight to sign-in without skipping
 * onboarding: /add hands off to /auth/post-signin, and this watcher picks the
 * draft back up on the far side.
 *
 * Deliberately inert on /add (the resume handler lives there and clears the flag
 * itself) and on (auth) pages, which don't render this shell — so it never yanks
 * a new user out of onboarding before they pick a username and accept the terms.
 */
export function ResumePublishWatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/add")) return;
    if (!getResumeFlag()) return;

    let active = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      router.replace("/add?resume=1");
    })();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  return null;
}
