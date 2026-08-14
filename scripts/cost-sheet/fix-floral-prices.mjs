// One-off upstream fix: clear misextracted floral "prices" from vendors.filters.
//
// These rows carried a number that is not a wedding-floral engagement price —
// a Reddit stems anecdote, a retail single-bouquet tag, a floral-workshop class
// fee — mislabeled with a package/per-person basis, so the sheet (and the app's
// filters) read them as typical floral spend. We strip ONLY the price_* keys and
// leave every other tag (style, engagement_model, delivers_installs…) intact.
//
// Durable: the daily filter-reconcile cron is shipped disabled, so nothing
// re-derives these automatically; when it is eventually piloted it is model
// judgment and would reach the same conclusion. Reversible: original filters are
// backed up to the path below and printed before/after.
//
// Run: node --env-file=.env.local scripts/cost-sheet/fix-floral-prices.mjs [--apply]

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const PRICE_KEYS = ["price_min", "price_max", "price_basis", "price_kind", "price_confidence", "price_quote", "price_tiers"];

// The rows to fix, with the reason (for the report). ids verified from the live pull.
const TARGETS = [
  { id: "dec4d3a2-7a3c-4792-b499-9b4086a58a4b", name: "Garden Sweet", why: "$20 loose-stems Reddit anecdote (inferred), not a floral service price" },
  { id: "c53c5049-4663-4af8-b59c-e85b003acb6f", name: "Bonnie Brae Flowers Inc.", why: "$27.50 retail carry-bunch, a single stem price, not a wedding package" },
  { id: "ba486a38-3caa-49d4-839d-de0ca6126375", name: "Ladybird Poppy", why: "$85/person floral-design WORKSHOP (a class), not wedding florals" },
  { id: "4dd5d646-088a-437c-b210-702d90b297c5", name: "Buckley House of Flowers", why: "$175 single bridal bouquet tagged as a package total (borderline)" },
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const backup = [];
for (const t of TARGETS) {
  const { data, error } = await supabase.from("vendors").select("id,name,filters").eq("id", t.id).single();
  if (error) { console.error("fetch failed", t.name, error.message); process.exit(1); }
  const before = data.filters || {};
  backup.push({ id: t.id, name: data.name, filters: before });

  const after = { ...before };
  for (const k of PRICE_KEYS) delete after[k];

  console.log(`\n${data.name}  — ${t.why}`);
  console.log(`  before: min=${before.price_min} max=${before.price_max} basis=${before.price_basis} conf=${before.price_confidence}`);
  console.log(`  quote:  ${(before.price_quote || "").slice(0, 90)}`);
  console.log(`  after:  price_* keys removed; ${Object.keys(after).length} tags remain (${Object.keys(after).join(", ") || "none"})`);

  if (APPLY) {
    const { error: upErr } = await supabase.from("vendors").update({ filters: after }).eq("id", t.id);
    if (upErr) { console.error("update failed", data.name, upErr.message); process.exit(1); }
    console.log("  APPLIED");
  }
}

// Never overwrite the committed original-values record on a re-run (after the
// fix has applied, the live rows no longer hold the originals).
const backupPath = new URL("./floral-fix-backup.json", import.meta.url);
if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`\nbackup of original filters → ${backupPath.pathname}`);
console.log(APPLY ? "\ndone (applied)" : "\nDRY RUN — re-run with --apply to write");
