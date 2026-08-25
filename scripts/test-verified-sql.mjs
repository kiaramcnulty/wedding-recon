#!/usr/bin/env node
/**
 * SQL validation for Vendor Verification (migrations 0044 + 0045), run against
 * an embedded Postgres (pglite, WASM — no native deps, no Docker).
 *
 *   node scripts/test-verified-sql.mjs
 *
 * WHAT THIS COVERS. The function BODIES are extracted verbatim from the
 * migration files and executed unmodified, so this tests the shipping SQL, not
 * a copy:
 *   - verified_vendor_ids(): the perks predicate. Fixtures cover every state
 *     (unclaimed / claimed-no-sub / draft / active+published / revoked /
 *     past_due / p_ids isolation).
 *   - verified_listing_overrides(): only published listings, right ids.
 *   - vendor_is_verified(): the scalar wrapper agrees with the set.
 *   - vendors_in_bbox().verified: the set-based left join reads is-not-null,
 *     and is false (never null) for an unverified row.
 *   - vendor_filters_in_bbox(): the read-time jsonb merge — override keys win,
 *     extracted keys survive, an unverified row is unchanged (0034 behavior),
 *     a null-filters-but-has-overrides verified row appears, and a DRAFT
 *     override never leaks.
 *
 * WHAT THIS CANNOT COVER. pglite is a single superuser with no anon/
 * authenticated roles and no RLS role-switching, so SECURITY DEFINER has no
 * effect here. The RLS boundary — that an anonymous public reader gets the
 * correct verified set THROUGH the definer boundary rather than an empty set —
 * is the one thing this harness cannot prove and MUST be checked on a real
 * Supabase (local CLI stack or the hosted project). See
 * scripts/verified-rls-check.sql for that manual step. This harness validates
 * the relational logic; that script validates the role boundary.
 *
 * PostGIS is stubbed (st_* return constants / always-intersects), because the
 * geometry filtering in these two functions is unchanged from 0034/0035 and
 * already validated; only the verified/merge logic is new and under test here.
 */

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG = resolve(ROOT, "supabase/migrations");

let pass = 0,
  fail = 0;
function ok(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
// Canonicalize objects (jsonb does not preserve key order) so a merge result
// compares by content, not by the order Postgres happened to serialize keys.
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  }
  return v;
}
function eq(label, got, want) {
  ok(`${label}  (got ${JSON.stringify(got)})`, JSON.stringify(canon(got)) === JSON.stringify(canon(want)));
}

/**
 * Pull every top-level `create ... function ... $fn$ ... $fn$;` block out of a
 * migration, so the harness runs the exact shipping bodies. The migrations use
 * the $fn$ delimiter uniformly for these functions.
 */
function extractFunctions(file) {
  const sql = readFileSync(resolve(MIG, file), "utf8");
  const re = /create (?:or replace )?function[\s\S]*?\$fn\$[\s\S]*?\$fn\$;/g;
  return sql.match(re) ?? [];
}

const db = await PGlite.create();

// --- Schema: minimal stand-ins for the tables the functions read. No FKs to
// auth.users; PostGIS stubbed. Columns match what the function bodies touch.
await db.exec(`
  create domain geometry as text;
  create domain geography as text;
  create function st_makeenvelope(a double precision,b double precision,c double precision,d double precision,e int)
    returns geometry language sql as 'select null::geometry';
  create function st_intersects(a geometry,b geometry) returns boolean language sql as 'select true';
  create function st_x(g geometry) returns double precision language sql as 'select 1::double precision';
  create function st_y(g geometry) returns double precision language sql as 'select 2::double precision';

  create table vendors (
    id uuid primary key default gen_random_uuid(),
    name text, vendor_type text, location geography,
    source text, google_place_id text, address_text text,
    google_photos jsonb, filters jsonb
  );
  create table vendor_claims (
    vendor_id uuid, user_id uuid,
    status text default 'approved'
  );
  create table vendor_subscriptions (
    vendor_id uuid primary key, status text default 'inactive'
  );
  create table vendor_listings (
    vendor_id uuid primary key, filter_overrides jsonb default '{}'::jsonb,
    published boolean default false
  );
  create table recon_entries (id uuid primary key default gen_random_uuid(), vendor_id uuid, status text);
  create table recon_media (recon_entry_id uuid);
`);

// vendor_type is an enum in prod; the bbox functions take vendor_type[] params.
// Stub the type as text-domain array so the real signatures load.
await db.exec(`create domain vendor_type as text;`);

// Load the REAL function bodies from 0044 then 0045.
for (const fn of [...extractFunctions("0044_vendor_subscriptions.sql"), ...extractFunctions("0045_vendors_in_bbox_verified.sql")]) {
  await db.exec(fn);
}

// --- Fixtures: one vendor per subscription state -----------------------------
const V = {
  unclaimed: "00000000-0000-0000-0000-000000000001",
  noSub: "00000000-0000-0000-0000-000000000002",
  draft: "00000000-0000-0000-0000-000000000003",
  verified: "00000000-0000-0000-0000-000000000004",
  revoked: "00000000-0000-0000-0000-000000000005",
  pastDue: "00000000-0000-0000-0000-000000000006",
  nullFilters: "00000000-0000-0000-0000-000000000007",
};
const U = "10000000-0000-0000-0000-000000000000";

async function vendor(id, filters = "{}") {
  await db.query(
    `insert into vendors(id,name,vendor_type,location,source,filters) values ($1,$2,'venue','x','google',$3::jsonb)`,
    [id, id.slice(-1), filters],
  );
}
await vendor(V.unclaimed);
await vendor(V.noSub);
await vendor(V.draft, '{"guest_max": 100}');
await vendor(V.verified, '{"guest_max": 100, "byo_alcohol": false}');
await vendor(V.revoked);
await vendor(V.pastDue);
// nullFilters: a verified vendor the extraction pipeline never reached.
await db.query(`insert into vendors(id,name,vendor_type,location,source,filters) values ($1,'n','venue','x','google',null)`, [V.nullFilters]);

async function claim(vid, status = "approved") {
  await db.query(`insert into vendor_claims(vendor_id,user_id,status) values ($1,$2,$3)`, [vid, U, status]);
}
async function sub(vid, status) {
  await db.query(`insert into vendor_subscriptions(vendor_id,status) values ($1,$2)`, [vid, status]);
}
async function listing(vid, published, overrides = "{}") {
  await db.query(`insert into vendor_listings(vendor_id,published,filter_overrides) values ($1,$2,$3::jsonb)`, [vid, published, overrides]);
}

// noSub: claimed + published listing, but NO subscription row.
await claim(V.noSub);
await listing(V.noSub, true);
// draft: claimed + active sub, listing NOT published.
await claim(V.draft);
await sub(V.draft, "active");
await listing(V.draft, false, '{"guest_max": 999}'); // override MUST NOT leak (draft)
// verified: the full house — claimed + active + published, with an override.
await claim(V.verified);
await sub(V.verified, "active");
await listing(V.verified, true, '{"byo_alcohol": true, "shuttle": true}');
// revoked: everything active/published but the claim is revoked.
await claim(V.revoked, "revoked");
await sub(V.revoked, "active");
await listing(V.revoked, true, '{"guest_max": 5}');
// pastDue: claimed + published but subscription past_due (grace off).
await claim(V.pastDue);
await sub(V.pastDue, "past_due");
await listing(V.pastDue, true);
// nullFilters: verified, and its ONLY filters come from the override.
await claim(V.nullFilters);
await sub(V.nullFilters, "active");
await listing(V.nullFilters, true, '{"guest_max": 250}');

// --- verified_vendor_ids: exactly the right set ------------------------------
const allIds = (await db.query(`select vendor_id from verified_vendor_ids() order by vendor_id`)).rows.map((r) => r.vendor_id);
eq("verified_vendor_ids returns only the two truly-verified vendors", allIds.sort(), [V.verified, V.nullFilters].sort());
ok("unclaimed vendor is not verified", !allIds.includes(V.unclaimed));
ok("claimed-but-no-subscription is not verified", !allIds.includes(V.noSub));
ok("active-sub-but-draft-listing is not verified", !allIds.includes(V.draft));
ok("revoked claim is not verified even with active sub + published listing", !allIds.includes(V.revoked));
ok("past_due subscription is not verified (grace off)", !allIds.includes(V.pastDue));

// p_ids isolation: asking about one id returns only that id if verified.
const oneVerified = (await db.query(`select vendor_id from verified_vendor_ids($1)`, [[V.verified]])).rows.map((r) => r.vendor_id);
eq("p_ids narrows to the asked id (verified)", oneVerified, [V.verified]);
const oneUnverified = (await db.query(`select vendor_id from verified_vendor_ids($1)`, [[V.draft]])).rows.map((r) => r.vendor_id);
eq("p_ids narrows to the asked id (unverified -> empty)", oneUnverified, []);

// --- vendor_is_verified scalar agrees with the set ---------------------------
const isV = (await db.query(`select vendor_is_verified($1) as v`, [V.verified])).rows[0].v;
const isNot = (await db.query(`select vendor_is_verified($1) as v`, [V.draft])).rows[0].v;
eq("vendor_is_verified true for a verified vendor", isV, true);
eq("vendor_is_verified false for a draft vendor", isNot, false);

// --- vendor_filters_in_bbox: read-time merge ---------------------------------
const filtersById = new Map(
  (await db.query(`select id, filters from vendor_filters_in_bbox(0,0,1,1)`)).rows.map((r) => [r.id, r.filters]),
);

// Verified vendor: override key wins, extracted key survives, a new override key is added.
eq(
  "verified vendor merges overrides over extracted (override wins, extracted survives)",
  filtersById.get(V.verified),
  { guest_max: 100, byo_alcohol: true, shuttle: true },
);
// Draft vendor: NOT verified, so its listing override must NOT appear — the
// extracted filters come through unchanged.
eq("draft vendor override does NOT leak; extracted filters unchanged", filtersById.get(V.draft), { guest_max: 100 });
// Unclaimed vendor: unchanged (0034 behavior).
eq("unclaimed vendor filters unchanged", filtersById.get(V.unclaimed), {});
// Verified vendor whose extracted filters are null shows up with just its overrides.
eq("verified vendor with null extracted filters shows overrides via widened WHERE", filtersById.get(V.nullFilters), { guest_max: 250 });
// Revoked vendor's override must not leak.
ok("revoked vendor override does not leak", JSON.stringify(filtersById.get(V.revoked) ?? {}) === "{}" );

// Evidence-quote stripping still happens (0033 behavior) alongside the merge.
await vendor("00000000-0000-0000-0000-0000000000aa", '{"guest_max": 50, "price_quote": "call us"}');
const stripped = (await db.query(`select filters from vendor_filters_in_bbox(0,0,1,1) where id='00000000-0000-0000-0000-0000000000aa'`)).rows[0].filters;
eq("price_quote evidence still stripped on an unverified row", stripped, { guest_max: 50 });

// --- vendors_in_bbox.verified: set-based flag, never null --------------------
const bbox = new Map((await db.query(`select id, verified from vendors_in_bbox(0,0,1,1)`)).rows.map((r) => [r.id, r.verified]));
eq("bbox verified=true for a verified vendor", bbox.get(V.verified), true);
eq("bbox verified=false (not null) for an unverified vendor", bbox.get(V.unclaimed), false);
eq("bbox verified=false for a draft vendor", bbox.get(V.draft), false);
const anyNull = (await db.query(`select count(*)::int as n from vendors_in_bbox(0,0,1,1) where verified is null`)).rows[0].n;
eq("no row has a null verified flag", anyNull, 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail ? 1 : 0);
