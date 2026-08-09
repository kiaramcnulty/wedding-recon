#!/usr/bin/env node
/**
 * Phase 5 - write the gated output to the database.
 *
 *   node scripts/reconcile/apply.mjs --work co-all           (dry run)
 *   node scripts/reconcile/apply.mjs --work co-all --apply
 *
 * Dry run by default. Resumable: every success is logged to applied.jsonl and
 * skipped on a re-run, so an interrupted apply can be restarted without writing
 * anything twice.
 *
 * Filters are merged with a fresh read of the row rather than the export, so a
 * value that changed since the export is not clobbered by a stale copy. Keys
 * whose provenance is `manual` are never touched: precedence is manual over
 * recon over extraction, and a human setting a value through the app outranks
 * anything this pass concludes.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, arg, has } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: apply.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const db = serviceClient();
const dir = workdir(WORK);

const accepted = readJsonl(join(dir, "accepted.jsonl"));
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));

const logPath = join(dir, "applied.jsonl");
const done = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l).vendor_id)
    : [],
);
if (done.size) console.log(`Resuming: ${done.size} vendors already applied\n`);

/**
 * A collected month for a price that was not collected when the entry was.
 *
 * These dates were always synthetic on bot entries (Kiara, 2026-08-09), so
 * moving one is not corrupting a real measurement. Derived from the entry id so
 * a re-run lands on the same month, and capped at the current month - a random
 * month across the whole year puts a third of them in the future.
 */
const NOW = new Date();
function collectedMonth(entryId) {
  const h = parseInt(createHash("sha256").update(entryId).digest("hex").slice(0, 8), 16);
  return (h % (NOW.getMonth() + 1)) + 1;
}

const isPriceEdit = (e) =>
  e.field === "price_details" || (e.documents ?? []).some((k) => /price/.test(k));

let edited = 0;
let tagged = 0;
let skippedManual = 0;

for (const row of accepted) {
  if (done.has(row.vendor_id)) continue;
  const v = vendors.get(row.vendor_id);
  const entries = new Map(v.entries.map((e) => [e.id, e]));

  // --- prose ---------------------------------------------------------------
  for (const e of row.recon_edits) {
    const target = entries.get(e.entry_id);
    const current = (target[e.field] ?? "").trimEnd();
    // Append, never replace. The existing wording is somebody's account; this
    // pass adds a fact to it and has no mandate to rewrite what is there.
    //
    // How it joins matters, because much of this corpus is bullet-style notes
    // rather than prose, and a bullet line does not end in a period. Joining
    // with a space produced "...helping set up and serve The barn sits against
    // a mountain backdrop." on the first run - a visible run-on, since the
    // vendor page renders these with whitespace-pre-line.
    //
    //   append is itself a bullet    -> its own line
    //   previous ends a sentence     -> same paragraph, space
    //   otherwise (an open bullet)   -> its own line
    const joiner = !current
      ? ""
      : /^\s*-/.test(e.append) || !/[.!?]$/.test(current)
        ? "\n"
        : " ";
    const next = current ? `${current}${joiner}${e.append}` : e.append;

    const patch = { [e.field]: next, updated_at: new Date().toISOString() };
    if (isPriceEdit(e)) {
      patch.recon_collected_month = collectedMonth(e.entry_id);
      patch.recon_collected_year = NOW.getFullYear();
    }

    if (!APPLY) {
      console.log(`  ${v.name} / ${e.entry_id} .${e.field}`);
      console.log(`    + ${e.append}`);
    } else {
      const { error } = await db.from("recon_entries").update(patch).eq("id", e.entry_id);
      if (error) {
        console.error(`  entry ${e.entry_id}: ${error.message}`);
        continue;
      }
    }
    edited++;
  }

  // --- tags ----------------------------------------------------------------
  if (row.filter_writes.length) {
    const { data: live, error: readErr } = await db
      .from("vendors")
      .select("filters,filters_meta")
      .eq("id", row.vendor_id)
      .single();
    if (readErr) {
      console.error(`  vendor ${row.vendor_id}: ${readErr.message}`);
      continue;
    }

    const filters = { ...(live.filters ?? {}) };
    const meta = { ...(live.filters_meta ?? {}) };
    const stamp = new Date().toISOString();
    let changed = 0;

    for (const w of row.filter_writes) {
      if (meta[w.key]?.source === "manual") {
        skippedManual++;
        continue;
      }
      // Growing a list keeps what is already there; a set union, because
      // replacing would silently drop values the extraction found.
      if (Array.isArray(filters[w.key]) && Array.isArray(w.value)) {
        filters[w.key] = [...new Set([...filters[w.key], ...w.value])];
      } else {
        filters[w.key] = w.value;
      }
      meta[w.key] = { source: "recon", updated_at: stamp, quote: w.quote };
      if (w.basis) filters.price_basis ??= w.basis;
      if (w.kind) filters.price_kind ??= w.kind;
      changed++;
    }

    if (changed) {
      if (!APPLY) {
        console.log(
          `  ${v.name}: ${row.filter_writes.map((w) => `${w.key}=${JSON.stringify(w.value)}`).join(", ")}`,
        );
      } else {
        const { error } = await db
          .from("vendors")
          .update({ filters, filters_meta: meta, filters_updated_at: stamp })
          .eq("id", row.vendor_id);
        if (error) {
          console.error(`  vendor ${row.vendor_id}: ${error.message}`);
          continue;
        }
      }
      tagged += changed;
    }
  }

  if (APPLY) appendFileSync(logPath, JSON.stringify({ vendor_id: row.vendor_id }) + "\n");
}

console.log(
  [
    "",
    APPLY ? "APPLIED" : "DRY RUN - nothing written",
    `  recon entries edited: ${edited}`,
    `  filter tags written:  ${tagged}`,
    `  skipped (manual):     ${skippedManual}`,
    APPLY ? "" : "\nRe-run with --apply to write. restore.mjs undoes it.",
  ].join("\n"),
);
