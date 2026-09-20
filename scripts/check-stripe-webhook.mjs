#!/usr/bin/env node
/**
 * Liveness + registration check for the Vendor Verification Stripe webhook.
 *
 *   npm run check:stripe-webhook
 *   node scripts/check-stripe-webhook.mjs https://www.weddingrecon.com/api/stripe-webhook
 *
 * Deliberately NOT named test-*.mjs: it talks to the network and to Stripe, and
 * `npm test` must pass offline in a fresh checkout. Run it after any change to
 * the webhook, the domain config, or the Stripe dashboard.
 *
 * WHY THIS EXISTS. Vendor Verification shipped, a real vendor paid, and nothing
 * on the site changed. The perks predicate needs an ACTIVE subscription row,
 * vendor_subscriptions is written only by this webhook, and the webhook was
 * never reached -- so the table was empty and verified_vendor_ids() returned
 * nobody. Every symptom was in production; every cause was in configuration.
 * Three checks, one per way that happened:
 *
 *   1. REDIRECT. weddingrecon.com answers 308 -> www.weddingrecon.com. A
 *      browser follows it, curl -L follows it, and Stripe does NOT: it records
 *      the 3xx as a failed delivery. An endpoint registered on the apex looks
 *      perfectly correct in the dashboard and never fires. (The keep-alive
 *      workflow was bitten by the same 308 from the other side, and its fix --
 *      add -L -- is exactly the fix that is NOT available here.)
 *   2. MODE + URL. The only endpoint registered on the account pointed at a
 *      branch PREVIEW deployment left over from the verification PR. Checking
 *      test mode tells you nothing about live mode: run this with a live key.
 *   3. EVENTS. The registered endpoint subscribed to three customer.* events
 *      the handler ignores while omitting customer.subscription.updated, which
 *      it handles. HANDLED_EVENT_TYPES is the contract, and the offline test
 *      keeps that list honest against the handler itself.
 *
 * Exit status is 0 only when every applicable check passes.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { HANDLED_EVENT_TYPES } from "../lib/stripe/webhook-events.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Env from the process first (CI secrets), then .env.local if it exists.
try {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
} catch {
  // No .env.local (CI, fresh checkout) — the environment is the only source.
}

const URL_ =
  process.argv[2] ||
  process.env.STRIPE_WEBHOOK_URL ||
  (process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/stripe-webhook`
    : null);

if (!URL_) {
  console.error(
    "No URL to check. Pass one as an argument, or set STRIPE_WEBHOOK_URL or NEXT_PUBLIC_SITE_URL.",
  );
  process.exit(2);
}

let failed = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => {
  failed++;
  console.log(`  FAIL ${m}`);
};
const note = (m) => console.log(`  --   ${m}`);

console.log(`Checking ${URL_}\n`);

// --- 1. the endpoint answers Stripe directly, with no redirect -------------
console.log("Reachability (as Stripe sees it — redirects are NOT followed)");
let res;
try {
  res = await fetch(URL_, {
    method: "POST",
    redirect: "manual", // load-bearing: this is the whole point of the check
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
} catch (e) {
  bad(`request failed: ${e.message}`);
}

if (res) {
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    bad(
      `HTTP ${res.status} redirect to ${loc}\n` +
        `       Stripe treats a 3xx as a FAILED delivery and never follows it.\n` +
        `       Register the endpoint at the final URL instead: ${loc}`,
    );
  } else if (res.status === 500) {
    bad(
      "HTTP 500 — the route reports it is not configured; STRIPE_WEBHOOK_SECRET is unset on the deployment",
    );
  } else if (res.status === 400) {
    const body = await res.text();
    if (body.includes("no signature")) {
      ok("HTTP 400 no-signature — the handler is live and rejecting unsigned calls");
    } else {
      bad(`HTTP 400 but an unexpected body: ${body.slice(0, 200)}`);
    }
  } else {
    bad(`HTTP ${res.status} — expected 400 "no signature" from an unsigned POST`);
  }
}

// --- 2 + 3. what Stripe actually has registered ----------------------------
console.log("\nRegistration in Stripe");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  note("STRIPE_SECRET_KEY not set — skipping (reachability was still checked)");
} else {
  // Match on the _live_ infix, not an sk_ prefix: the key this is MEANT to run
  // with is a RESTRICTED key (rk_live_...) scoped to read Webhook endpoints,
  // and an sk_-only test would have called that test mode and printed the
  // "this proves nothing about live" warning on the one key that does.
  const mode = /^(sk|rk)_live_/.test(key) ? "live" : "test";
  if (mode === "live") {
    ok("using a live-mode key");
  } else {
    // Not a failure — a sandbox check is legitimate. But it is precisely how
    // a broken live endpoint stayed invisible, so say so loudly.
    note(
      "using a TEST-mode key: this says NOTHING about live mode, where real vendors pay.\n" +
        "       Re-run with a live key (STRIPE_SECRET_KEY=rk_live_... npm run check:stripe-webhook).",
    );
  }

  const r = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = await r.json();
  if (json.error) {
    bad(`Stripe API error: ${json.error.message}`);
  } else {
    const all = json.data ?? [];
    note(`${all.length} endpoint(s) registered in ${mode} mode`);
    for (const e of all) note(`   ${e.status.padEnd(8)} ${e.url}`);

    const match = all.find((e) => e.url === URL_);
    if (!match) {
      bad(
        `no endpoint registered at ${URL_}\n` +
          `       A checkout completes, nothing is delivered here, and the vendor never verifies.`,
      );
    } else if (match.status !== "enabled") {
      bad(`the endpoint at ${URL_} is ${match.status}, not enabled`);
    } else {
      ok(`enabled endpoint registered at exactly this URL`);
      const subscribed = new Set(match.enabled_events ?? []);
      const wildcard = subscribed.has("*");
      const missing = HANDLED_EVENT_TYPES.filter(
        (t) => !wildcard && !subscribed.has(t),
      );
      if (missing.length) {
        bad(`not subscribed to: ${missing.join(", ")}`);
      } else {
        ok(`subscribed to all ${HANDLED_EVENT_TYPES.length} handled event types`);
      }
      const extra = [...subscribed].filter(
        (t) => t !== "*" && !HANDLED_EVENT_TYPES.includes(t),
      );
      if (extra.length) {
        note(`also subscribed to ${extra.length} type(s) the handler ignores: ${extra.join(", ")}`);
      }
    }
  }
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
