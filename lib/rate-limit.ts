import { createServiceRoleClient } from "@/lib/supabase/server";

// SERVER-ONLY. Fixed-window rate limit backed by Postgres (check_rate_limit RPC,
// migration 0015) so limits hold across serverless instances — an in-memory
// counter doesn't on Vercel, where each instance would keep its own tally.

/**
 * Returns true if the request under `key` is allowed within `max` per
 * `windowSeconds`, false if it should be throttled.
 *
 * Fail-OPEN: if the limiter errors (RPC missing before 0015 is applied, DB
 * hiccup), the request is allowed. A rate-limiter outage must not take down
 * image serving; the tradeoff is that a broken limiter stops protecting.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] check failed (allowing):", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit] check threw (allowing):", e);
    return true;
  }
}

export type StrictRateLimitResult = "allowed" | "limited" | "unavailable";

/**
 * Connector policy: unlike image serving, a limiter outage must fail closed.
 * This leaves the existing fail-open behavior above untouched for images.
 */
export async function checkRateLimitStrict(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<StrictRateLimitResult> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] strict check failed:", error.message);
      return "unavailable";
    }
    return data === false ? "limited" : "allowed";
  } catch (error) {
    console.error("[rate-limit] strict check threw:", error);
    return "unavailable";
  }
}
