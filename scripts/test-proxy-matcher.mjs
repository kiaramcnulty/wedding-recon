#!/usr/bin/env node
/**
 * Where proxy.ts runs, checked against Next's OWN matcher compiler.
 *
 *   node scripts/test-proxy-matcher.mjs
 *
 * The matcher decides which requests are a billed proxy invocation (Fluid
 * Active CPU) and which never reach a function. It fails silently both ways:
 * too broad and the CPU allowance burns on no-op invocations (2026-11-14,
 * docs/notes/function-cpu.md); too narrow and a signed-in visitor stops getting
 * the session refresh, which can end in a revoked session (see proxy.ts). So
 * this pins both directions, plus the two literals that must agree with code
 * elsewhere: the auth cookie name, and the outage-critical API exclusions.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { getMiddlewareMatchers } = require("next/dist/build/analysis/get-page-static-info");

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

// ── The config object, evaluated as the literal it must be ───────────────────
const proxySrc = read("proxy.ts");
const configStart = proxySrc.indexOf("export const config = ");
check("proxy.ts exports a config", configStart !== -1);
const configText = proxySrc
  .slice(configStart + "export const config = ".length)
  .replace(/;\s*$/, "");
const config = new Function(`return (${configText});`)();
const matchers = getMiddlewareMatchers(config.matcher, {});

const AUTH_COOKIE_NAME = /AUTH_COOKIE_NAME = "([^"]+)"/.exec(
  read("lib/supabase/auth-cookie.ts"),
)?.[1];
check("auth-cookie.ts defines AUTH_COOKIE_NAME", !!AUTH_COOKIE_NAME);

/**
 * Does the proxy run for this URL, given the cookie names the request carries?
 * Mirrors Next's `has` / `missing` semantics for the two condition types the
 * matcher uses (a `value` is an anchored regex, as in Next's matchHas).
 */
function runs(url, cookies = []) {
  const { pathname, searchParams } = new URL(url, "http://x");
  const present = (c) => {
    if (c.type === "cookie") return cookies.includes(c.key);
    if (c.type === "query") {
      const v = searchParams.get(c.key);
      return v !== null && (c.value === undefined || new RegExp(`^${c.value}$`).test(v));
    }
    throw new Error(`test does not model condition type ${c.type}`);
  };
  return matchers.some(
    (m) =>
      new RegExp(m.regexp).test(pathname) &&
      (m.has ?? []).every(present) &&
      !(m.missing ?? []).some(present),
  );
}

// ── The cookie literals agree with the constant every client pins ────────────
const cookieKeys = matchers.flatMap((m) => (m.has ?? []).map((h) => h.key));
check(
  "matcher keys on AUTH_COOKIE_NAME and its first chunk",
  cookieKeys.length === 2 &&
    cookieKeys.includes(AUTH_COOKIE_NAME) &&
    cookieKeys.includes(`${AUTH_COOKIE_NAME}.0`),
  JSON.stringify(cookieKeys),
);
const gatedSources = config.matcher
  .filter((m) => typeof m === "object" && m.has)
  .map((m) => m.source);
check(
  "both cookie-gated entries cover the same paths",
  gatedSources.length === 2 && gatedSources[0] === gatedSources[1],
);
// The `/?ref=app` skip is only safe while the gate always renders that URL.
const navSrc = read("lib/landing/nav.ts");
const refParam = /LANDING_REF_PARAM = "([^"]+)"/.exec(navSrc)?.[1];
const refApp = /LANDING_REF_APP = "([^"]+)"/.exec(navSrc)?.[1];
const rootEntry = config.matcher.find((m) => typeof m === "object" && m.source === "/");
check(
  "the `/` skip names LANDING_REF_PARAM=LANDING_REF_APP",
  rootEntry?.missing?.length === 1 &&
    rootEntry.missing[0].key === refParam &&
    rootEntry.missing[0].value === refApp,
  JSON.stringify(rootEntry?.missing),
);
check(
  "firstVisitRedirect still returns null for ref=app before any other rule",
  /if \(input\.pathname !== "\/"\) return null;\s*if \(input\.ref === LANDING_REF_APP\) return null;/.test(navSrc),
);

for (const file of ["lib/supabase/client.ts", "lib/supabase/server.ts", "lib/supabase/middleware.ts"]) {
  check(
    `${file} pins the auth cookie name`,
    read(file).includes("cookieOptions: { name: AUTH_COOKIE_NAME }"),
  );
}

// ── Anonymous: only the two paths every visitor needs ────────────────────────
const UUID = "0b6bc234-3338-456f-b37e-a5f6a77a8646";
for (const path of [
  "/",
  "/?utm_source=reddit",
  "/?ref=other",
  `/vendor/${UUID}`,
  `/vendor/${UUID.toUpperCase()}`,
  `/vendor/${UUID}?from=%2Fexplore`,
]) {
  check(`anonymous ${path} runs the proxy`, runs(path));
}
for (const path of [
  // LANDING_HREF: the gate always renders the landing page for it, so the
  // proxy is a no-op -- and every app page prefetches it.
  "/?ref=app",
  "/explore",
  "/start",
  "/hub",
  "/portal",
  "/add",
  "/login",
  "/for-vendors",
  "/vendor/dj-blnce",
  "/ingest/e/",
  "/ingest/flags/",
  "/api/vendor-search",
]) {
  check(`anonymous ${path} skips the proxy`, !runs(path));
}

// ── Signed in, unchunked or chunked: every page and app API route ────────────
for (const cookies of [[AUTH_COOKIE_NAME], [`${AUTH_COOKIE_NAME}.0`, `${AUTH_COOKIE_NAME}.1`]]) {
  const label = cookies.length === 1 ? "signed-in" : "signed-in (chunked)";
  for (const path of [
    "/",
    "/?ref=app",
    "/explore",
    "/hub",
    "/portal",
    "/portal/listing/abc",
    "/add",
    "/vendor/dj-blnce",
    `/vendor/${UUID}`,
    "/recon/abc/edit",
    "/auth/post-signin",
    "/api/vendor-search",
    "/api/places",
  ]) {
    check(`${label} ${path} runs the proxy`, runs(path, cookies));
  }
  // Never, cookie or not: no session work can matter, and on the two edge-cached
  // routes a Set-Cookie would make the response uncacheable (the 2026-08-14
  // outage contract, docs/notes/map-serving.md).
  for (const path of [
    "/ingest/e/",
    "/ingest/static/array.js",
    "/api/map/vendors",
    "/api/vendor-photo/abc",
    "/api/stripe-webhook",
    "/api/connectors/v1/vendors",
    "/api/health",
    "/robots.txt",
    "/sitemap.xml",
    "/_next/static/chunks/a.js",
    "/_next/image",
    "/icon.svg",
    "/favicon.ico",
    "/opengraph-image.png",
    "/manifest.webmanifest",
  ]) {
    check(`${label} ${path} skips the proxy`, !runs(path, cookies));
  }
}

// The PKCE verifier is not a session: nothing to refresh until sign-in lands.
check(
  "a code-verifier cookie alone does not run the proxy",
  !runs("/explore", [`${AUTH_COOKIE_NAME}-code-verifier`]),
);

console.log(`proxy matcher: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
