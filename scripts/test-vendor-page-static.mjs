#!/usr/bin/env node
/**
 * The vendor page must stay a CACHED (ISR) render, and every app write that
 * changes it must expire it.
 *
 *   node scripts/test-vendor-page-static.mjs
 *
 * Why a source check: an ISR page that starts reading the request (cookies, the
 * query string, a no-store fetch) does not fail the build. `generateStaticParams`
 * returns [], so nothing is prerendered at build time and the build output
 * still shows the route as static; the regression only shows up at runtime, as
 * a ~37 ms billed render on every view again (docs/notes/function-cpu.md).
 * These are the specific ways it has been, or nearly was, made dynamic. The
 * real check is still `x-nextjs-cache: HIT` on a second request (see
 * docs/notes/vendor-page.md).
 *
 * The second half pins the writes: each file that changes what a vendor page
 * shows must call revalidateVendorPage(), or that change waits out the hour.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
/** Source with line and block comments removed, so prose never trips a check. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

// ── The page render reads nothing per-request ──────────────────────────────
const PAGE = "app/(app)/vendor/[id]/page.tsx";
const page = code(PAGE);

check("page exports a numeric revalidate", /export const revalidate = \d+;/.test(page));
check(
  "page exports generateStaticParams (an empty list is what makes it ISR)",
  /export function generateStaticParams\(/.test(page),
);
check("page does not take searchParams", !/searchParams/.test(page));
check(
  "page does not use the cookie-bound server client",
  !/from "@\/lib\/supabase\/server"/.test(page),
);
check("page does not read the viewer server-side", !/getClaims|getUser|getSession|isAdminUser/.test(page));
for (const api of ["cookies(", "headers(", "draftMode(", "connection("]) {
  check(`page does not call ${api}`, !page.includes(api));
}
check("page uses the cookie-free client", /createPublicClient\(\)/.test(page));

// Server modules the page renders through. A no-store fetch inside the render
// flips it to dynamic just like a cookie read (Next marks the scope dynamic).
for (const file of ["lib/google-photos.ts", "lib/supabase/public.ts"]) {
  const src = code(file);
  check(`${file}: no cache: "no-store"`, !/cache:\s*["']no-store["']/.test(src));
  check(`${file}: no revalidate: 0`, !/revalidate:\s*0\b/.test(src));
}
check(
  "lib/supabase/public.ts never touches cookies",
  !/cookies|next\/headers/.test(code("lib/supabase/public.ts")),
);

// The per-viewer parts are Client Components, so the cached HTML is public.
for (const file of [
  "components/vendor/recon-card.tsx",
  "components/vendor/recon-slot.tsx",
  "components/vendor/back-button.tsx",
  "lib/viewer.ts",
]) {
  check(`${file} is a Client Component`, /^"use client";/.test(read(file)));
}

// ── Every app write that changes a vendor page expires it ──────────────────
const WRITERS = {
  "app/(app)/add/actions.ts": "recon create",
  "app/(app)/recon/[id]/edit/actions.ts": "recon edit (author, and admin on bot recon)",
  "app/(app)/vendor/[id]/actions.ts": "report (can flag the entry)",
  "app/(portal)/portal/listing/actions.ts": "verified listing save",
  "app/(portal)/portal/actions.ts": "vendor claim",
  "app/(portal)/portal/admin/actions.ts": "claim revoke",
  "lib/stripe/sync.ts": "subscription mirror (webhook + reconcile)",
};
for (const [file, what] of Object.entries(WRITERS)) {
  check(
    `${file} (${what}) calls revalidateVendorPage`,
    /await revalidateVendorPage\(/.test(code(file)),
  );
}
// The whole-route form expires all ~2,300 vendor pages at once.
for (const file of Object.keys(WRITERS)) {
  check(
    `${file} does not expire every vendor page`,
    !/revalidatePath\(\s*["']\/vendor\/\[id\]["']/.test(code(file)),
  );
}
check(
  "ReportButton reports through the server action",
  /reportReconEntry\(/.test(code("components/vendor/report-button.tsx")) &&
    !/from\("reports"\)/.test(code("components/vendor/report-button.tsx")),
);

console.log(`vendor page static: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
