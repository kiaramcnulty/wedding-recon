#!/usr/bin/env node
/**
 * Tests for the /launchvendors denylist (.claude/skills/launchvendors/denylist.json) and
 * the closed-business filter in its lib.mjs.
 *
 *   node scripts/test-launch-denylist.mjs
 *
 * A vendor deleted from the hosted DB leaves no trace, so without the denylist the next
 * sweep of that type re-inserts it. These checks keep the file well-formed (it is loaded by
 * scout, resolve and upload, and a parse error must not ship), keep it free of anything but
 * business-level fields (the repo is public), and pin the matching rules: place_id when the
 * row has one, type-scoped normalized name when it does not.
 */
import fs from "node:fs";
import { denylisted, isPermanentlyClosed, loadDenylist, TYPE_PROFILES } from "../.claude/skills/launchvendors/scripts/lib.mjs";

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) passed++;
  else {
    failed++;
    console.error("FAIL:", name);
  }
}
const profile = (key) => ({ key, ...TYPE_PROFILES[key] });

// ── File shape ───────────────────────────────────────────────────────────────
const table = loadDenylist();
const raw = JSON.parse(fs.readFileSync(new URL("../.claude/skills/launchvendors/denylist.json", import.meta.url), "utf8"));
ok("denylist.json is a plain object", raw && typeof raw === "object" && !Array.isArray(raw));

const ALLOWED = new Set(["names", "vendor_type", "removed", "reason"]);
const KNOWN_TYPES = new Set(Object.values(TYPE_PROFILES).flatMap((p) => p.vendorTypes ?? [p.vendorType]));
for (const [pid, e] of Object.entries(table)) {
  ok(`${pid}: key looks like a Google place_id`, /^[A-Za-z0-9_-]{20,}$/.test(pid));
  ok(`${pid}: only business-level fields (${Object.keys(e).join(",")})`, Object.keys(e).every((k) => ALLOWED.has(k)));
  ok(`${pid}: has at least one name`, Array.isArray(e.names) && e.names.length > 0 && e.names.every((n) => typeof n === "string" && n.trim()));
  ok(`${pid}: vendor_type is a launch type`, KNOWN_TYPES.has(e.vendor_type));
  ok(`${pid}: removed is YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(e.removed || ""));
  ok(`${pid}: has a short reason`, typeof e.reason === "string" && e.reason.trim().length > 0 && e.reason.length <= 200);
  ok(`${pid}: no email address anywhere`, !/@/.test(JSON.stringify(e)));
}

// ── Seed entry (2026-09-24) ──────────────────────────────────────────────────
const JLE = "ChIJ765XCip_bIcR9FVXG_lH8ac";
const planner = profile("planner");
ok("seed entry present", !!table[JLE]);
ok("seed denied by place_id", denylisted({ place_id: JLE, name: "anything" }, planner)?.place_id === JLE);
ok("seed denied by place_id under ANY type profile", !!denylisted({ place_id: JLE }, profile("venue")));

// ── Matching rules ───────────────────────────────────────────────────────────
ok("a different place_id with the same name is NOT denied (different Google place)",
  denylisted({ place_id: "ChIJsomeOtherPlaceIdXXXXXX", name: "Jennifer Lane Events" }, planner) === null);
ok("pid-less row denied by name within the type", !!denylisted({ place_id: "", name: "Jennifer Lane Events" }, planner));
ok("name match is normalized (case, punctuation, &)", !!denylisted({ name: "  JENNIFER LANE EVENTS!! " }, planner));
ok("name match is scoped to the vendor type", denylisted({ name: "Jennifer Lane Events" }, profile("photos")) === null);
ok("an unrelated pid-less row is not denied", denylisted({ name: "Some Other Planner Co" }, planner) === null);
ok("a blank row is not denied", denylisted({ place_id: "", name: "" }, planner) === null);

// ── Closed-business filter ───────────────────────────────────────────────────
ok("CLOSED_PERMANENTLY is closed", isPermanentlyClosed({ businessStatus: "CLOSED_PERMANENTLY" }));
ok("CLOSED_TEMPORARILY is kept", !isPermanentlyClosed({ businessStatus: "CLOSED_TEMPORARILY" }));
ok("OPERATIONAL is kept", !isPermanentlyClosed({ businessStatus: "OPERATIONAL" }));
ok("missing status (cached pre-field response) is kept", !isPermanentlyClosed({ id: "x" }));
ok("null place is kept", !isPermanentlyClosed(null));

// ── The field that feeds it rides in the sweep mask without a SKU change ────
const lib = fs.readFileSync(new URL("../.claude/skills/launchvendors/scripts/lib.mjs", import.meta.url), "utf8");
const mask = (lib.match(/'X-Goog-FieldMask': '(places\.[^']+)'/) || [])[1] || "";
ok("placesSearch mask requests places.businessStatus", mask.includes("places.businessStatus"));
ok("placesSearch mask still carries websiteUri (already Enterprise, so businessStatus adds no tier)", mask.includes("places.websiteUri"));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
