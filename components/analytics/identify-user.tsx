"use client";

import { useEffect } from "react";

import { identifyClient } from "@/lib/analytics/posthog";
import { createClient } from "@/lib/supabase/client";

/**
 * Merges the anonymous browsing session into the signed-in account in PostHog.
 *
 * Mounted once in the (app) layout, which persists across client navigations, so
 * this runs a single time per app session. For a signed-in user it calls
 * `posthog.identify(userId)`, which retroactively links the person's prior
 * anonymous pageviews to their account — connecting the top of the funnel
 * (browsing by source) to the conversions we fire server-side. Public/anonymous
 * visitors resolve to no user and it no-ops, so Explore stays anonymous.
 *
 * Uses `getClaims()` (local JWT verify, no Auth round trip) to read the id.
 */
export function IdentifyUser() {
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        const userId = data?.claims?.sub;
        if (active && userId) identifyClient(userId);
      } catch {
        // analytics identity is best-effort
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
