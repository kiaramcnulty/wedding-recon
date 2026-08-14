// Follow-up to fix-floral-prices.mjs: two of those rows were real per-ITEM
// floral prices (individual bouquets), not junk — they were only mis-tagged as
// `package`. Restore their price from the backup with price_basis = per_item, so
// the sheet shows an honest "$X per item" instead of overstating a wedding total.
// (Garden Sweet and Ladybird Poppy stay removed — an anecdote and a workshop fee,
// not per-item floral prices.)
//
// Run: node --env-file=.env.local scripts/cost-sheet/rebasis-floral-per-item.mjs [--apply]

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const BACKUP = new URL("./floral-fix-backup.json", import.meta.url);
const REBASIS = new Set(["Bonnie Brae Flowers Inc.", "Buckley House of Flowers"]);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const backup = JSON.parse(fs.readFileSync(BACKUP, "utf8"));

for (const row of backup) {
  if (!REBASIS.has(row.name)) continue;
  const filters = { ...row.filters, price_basis: "per_item" };
  console.log(`\n${row.name}`);
  console.log(`  restore: min=${filters.price_min} max=${filters.price_max} basis=package -> per_item kind=${filters.price_kind}`);
  if (APPLY) {
    const { error } = await supabase.from("vendors").update({ filters }).eq("id", row.id);
    if (error) { console.error("update failed", row.name, error.message); process.exit(1); }
    console.log("  APPLIED");
  }
}
console.log(APPLY ? "\ndone (applied)" : "\nDRY RUN — re-run with --apply to write");
