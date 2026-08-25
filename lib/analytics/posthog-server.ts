/**
 * Server-side PostHog, for the two CONVERSION events only.
 *
 * `signup_completed` and `recon_saved` both succeed via a server `redirect()`,
 * which throws `NEXT_REDIRECT` — so the client `await` never resolves on success
 * and there is no client "success" moment to hook. Firing them here, in the
 * Server Action where success is authoritative, fixes that AND makes them
 * un-blockable (a client event to an ad-blocked host is simply lost, and our
 * launch channels — Reddit especially — are ad-blocker-heavy).
 *
 * `captureImmediate` awaits the single-event network send, so the event is
 * delivered before the caller proceeds to its `redirect()`. No client lifecycle
 * / shutdown to manage. Without a key, every call is a silent no-op.
 *
 * Anonymous browsing is stitched to the account CLIENT-side (see
 * `identifyClient` / `<IdentifyUser>`), which merges the anon distinct_id into
 * `userId`; here we simply use `userId` as the distinct id.
 */
import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // captureImmediate flushes per-call, so batching thresholds are moot; set
      // them tight anyway so nothing lingers in a warm lambda's queue.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export type ServerEvent =
  | "signup_completed"
  | "recon_saved"
  | "vendor_claim_created";

/**
 * Capture a conversion event and await its delivery. `setOnce` becomes
 * `$set_once` person properties (written only if not already set) — used to
 * stamp the account's first-touch source in PostHog. Never throws: analytics
 * must not break a signup or a recon save.
 */
export async function captureServer(
  distinctId: string,
  event: ServerEvent,
  properties?: Record<string, unknown>,
  setOnce?: Record<string, unknown>,
): Promise<void> {
  const c = getClient();
  if (!c || !distinctId) return;

  const props: Record<string, unknown> = { ...(properties ?? {}) };
  if (setOnce && Object.keys(setOnce).length > 0) props.$set_once = setOnce;

  try {
    await c.captureImmediate({ distinctId, event, properties: props });
  } catch {
    // swallow — the user's action must succeed regardless
  }
}
