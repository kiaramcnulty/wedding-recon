#!/usr/bin/env node
/**
 * Routing tests for the first-visit gate at `/`.
 *
 *   node scripts/test-first-visit-gate.mjs
 *
 * `firstVisitRedirect` (lib/landing/nav.ts) decides where a request for `/`
 * goes: the landing page (null), the vendor portal, or Explore. The order is
 * the contract - `?ref=app` beats everything, a business-side browser beats
 * "signed in / has used the product", and only a visitor with none of those
 * sees the landing page.
 *
 * Run after any change to lib/landing/nav.ts or lib/landing/first-visit.ts.
 */

import {
  APP_HREF,
  PORTAL_HREF,
  firstVisitRedirect,
} from "../lib/landing/nav.ts";

let pass = 0,
  fail = 0;
function eq(label, got, want) {
  if (got === want) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}\n         got  ${got}\n         want ${want}`);
  }
}

const base = { pathname: "/", ref: null, seen: false, vendor: false, signedIn: false };
const go = (over) => firstVisitRedirect({ ...base, ...over });

// The four routing cases.
eq("new visitor -> landing", go({}), null);
eq("has used the product -> Explore", go({ seen: true }), APP_HREF);
eq("signed in -> Explore", go({ signedIn: true }), APP_HREF);
eq("business-side -> portal", go({ vendor: true }), PORTAL_HREF);

// Priority.
eq("business-side beats signed in", go({ vendor: true, signedIn: true }), PORTAL_HREF);
eq("business-side beats has-used", go({ vendor: true, seen: true }), PORTAL_HREF);
eq(
  "business-side, everything set -> portal",
  go({ vendor: true, seen: true, signedIn: true }),
  PORTAL_HREF,
);
eq("?ref=app beats business-side", go({ ref: "app", vendor: true }), null);
eq("?ref=app beats signed in", go({ ref: "app", signedIn: true, seen: true }), null);
eq("unknown ref is ignored", go({ ref: "email", seen: true }), APP_HREF);

// Only `/` is decided.
eq("other paths untouched", go({ pathname: "/explore", vendor: true }), null);
eq("portal path untouched", go({ pathname: "/portal", seen: true }), null);
eq("for-vendors untouched", go({ pathname: "/for-vendors", vendor: true }), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
