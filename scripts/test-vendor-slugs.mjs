#!/usr/bin/env node
/**
 * Vendor slugs (migration 0052), run against an embedded Postgres (pglite).
 *
 *   node scripts/test-vendor-slugs.mjs
 *
 * The WHOLE migration file runs unmodified against a minimal vendors table
 * that already holds rows, so this covers the shipping SQL end to end: the
 * slugify rules, the collision ladder (name, name-city, counter), the
 * oldest-first backfill, the insert trigger, and that running the file twice
 * is harmless (the hand-apply contract is idempotent).
 *
 * Also checks the app-side twin: `isVendorUuid()` in lib/vendors/slug.ts must
 * agree with the uuid guard in unique_vendor_slug(), or a slug could be read
 * as an id.
 */

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = readFileSync(
  resolve(ROOT, "supabase/migrations/0052_vendor_slugs.sql"),
  "utf8",
);

let pass = 0,
  fail = 0;
function eq(label, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else fail++;
  console.log(`  ${good ? "ok  " : "FAIL"} ${label}  (got ${JSON.stringify(got)})`);
}

const db = await PGlite.create();
await db.exec(`
  create table vendors (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    city text,
    created_at timestamptz not null default now()
  );
  insert into vendors (id, name, city, created_at) values
    ('00000000-0000-0000-0000-000000000001', 'DJ BLNCE', 'Denver', '2026-01-01'),
    ('00000000-0000-0000-0000-000000000002', 'Hampton Inn', 'Denver', '2026-01-02'),
    ('00000000-0000-0000-0000-000000000003', 'Hampton Inn', 'Boulder', '2026-01-03'),
    ('00000000-0000-0000-0000-000000000004', 'Hampton Inn', 'Boulder', '2026-01-04'),
    ('00000000-0000-0000-0000-000000000005', 'Hampton Inn', null, '2026-01-05'),
    ('00000000-0000-0000-0000-000000000006', 'Café & Crème''s Bakery', 'Golden', '2026-01-06'),
    ('00000000-0000-0000-0000-000000000007', 'Sweet Pea Events Denver', 'Denver', '2026-01-07'),
    ('00000000-0000-0000-0000-000000000008', 'Sweet Pea Events Denver', 'Denver', '2026-01-08'),
    ('00000000-0000-0000-0000-000000000009', '!!!', null, '2026-01-09'),
    ('00000000-0000-0000-0000-000000000010', 'Jenny’s  --  Photos', 'Estes Park', '2026-01-10');
`);

await db.exec(MIGRATION);

const slugOf = async (id) =>
  (await db.query(`select slug from vendors where id = $1`, [id])).rows[0]?.slug;
const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

console.log("backfill");
eq("plain name", await slugOf(id(1)), "dj-blnce");
eq("oldest duplicate keeps the bare name", await slugOf(id(2)), "hampton-inn");
eq("second duplicate takes its city", await slugOf(id(3)), "hampton-inn-boulder");
eq("same name AND city takes a counter", await slugOf(id(4)), "hampton-inn-boulder-2");
eq("duplicate with no city takes a counter", await slugOf(id(5)), "hampton-inn-2");
eq("accents, ampersand, apostrophe", await slugOf(id(6)), "cafe-and-cremes-bakery");
eq("name already ending in its city", await slugOf(id(7)), "sweet-pea-events-denver");
eq("...is not doubled on collision", await slugOf(id(8)), "sweet-pea-events-denver-2");
eq("nothing usable falls back", await slugOf(id(9)), "vendor");
eq("curly apostrophe and dash runs", await slugOf(id(10)), "jennys-photos");

console.log("insert trigger");
const ins = async (name, city, slug = null) =>
  (
    await db.query(
      `insert into vendors (name, city, slug) values ($1, $2, $3) returning slug`,
      [name, city, slug],
    )
  ).rows[0].slug;
eq("new vendor gets a slug", await ins("Blue Sky Florals", "Denver"), "blue-sky-florals");
eq("new duplicate climbs the ladder", await ins("DJ BLNCE", "Aurora"), "dj-blnce-aurora");
eq("a client-sent slug is ignored", await ins("Mile High DJs", null, "dj-blnce"), "mile-high-djs");
eq("long names are capped at 80", (await ins("a".repeat(120), null)).length, 80);

console.log("rename keeps the slug");
await db.query(`update vendors set name = 'DJ Balance' where id = $1`, [id(1)]);
eq("slug unchanged after a name edit", await slugOf(id(1)), "dj-blnce");

console.log("constraints");
let rejected = false;
try {
  await db.query(`update vendors set slug = 'Bad Slug!' where id = $1`, [id(1)]);
} catch {
  rejected = true;
}
eq("a malformed hand-set slug is rejected", rejected, true);
rejected = false;
try {
  await db.query(`update vendors set slug = 'hampton-inn' where id = $1`, [id(1)]);
} catch {
  rejected = true;
}
eq("a duplicate hand-set slug is rejected", rejected, true);

console.log("idempotent");
await db.exec(MIGRATION);
eq("re-running the migration changes nothing", await slugOf(id(3)), "hampton-inn-boulder");

console.log("uuid guard agrees with the app");
const { isVendorUuid } = await import("../lib/vendors/slug.ts").catch(async () => {
  // Node without TS stripping: read the regex out of the source instead.
  const src = readFileSync(resolve(ROOT, "lib/vendors/slug.ts"), "utf8");
  const m = src.match(/const UUID_RE = (\/.*\/[a-z]*);/);
  const re = eval(m[1]);
  return { isVendorUuid: (s) => re.test(s) };
});
eq("a real id reads as an id", isVendorUuid("13702a46-593a-4544-94ea-ec5ea89b9010"), true);
eq("a slug does not", isVendorUuid("dj-blnce"), false);
eq("a uppercase id reads as an id", isVendorUuid("13702A46-593A-4544-94EA-EC5EA89B9010"), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
