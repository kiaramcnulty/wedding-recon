#!/usr/bin/env node
/**
 * Phase 3 - run the call files through the Anthropic Batch API.
 *
 *   node scripts/reconcile/batch.mjs submit  --work co-all
 *   node scripts/reconcile/batch.mjs status  --work co-all
 *   node scripts/reconcile/batch.mjs collect --work co-all
 *
 * Uses ANTHROPIC_BATCH_API_KEY, not ANTHROPIC_API_KEY - the same split the
 * enrich pipeline uses, because ANTHROPIC_API_KEY would shadow Claude Code's
 * own auth in a session that also runs this.
 *
 * Batch pricing is half the standard rate, which is most of why this pass is
 * cheap. The other half is the output contract: edits rather than rewritten
 * entries (see build-calls.mjs).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, workdir, writeJsonl, arg } from "./lib.mjs";

/**
 * Split a blob of concatenated top-level JSON objects, tolerating pretty-printed
 * ones. Walks character by character tracking brace depth, skipping anything
 * inside a string (and escaped quotes), and emits each depth-0 object. Returns
 * any dangling text after the last complete object so a truncated tail can be
 * reported rather than silently dropped.
 */
function extractObjects(text) {
  const objects = [];
  let depth = 0,
    start = -1,
    inStr = false,
    esc = false;
  let i = 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return { objects, trailing: start >= 0 ? text.slice(start) : "" };
}

const CMD = process.argv[2];
const WORK = arg("work");
if (!WORK || !["submit", "status", "collect"].includes(CMD)) {
  console.error("Usage: batch.mjs <submit|status|collect> --work <name>");
  process.exit(1);
}

loadEnv();
const key = process.env.ANTHROPIC_BATCH_API_KEY;
if (!key) {
  console.error(
    "Missing ANTHROPIC_BATCH_API_KEY in .env.local.\n" +
      "Deliberately not ANTHROPIC_API_KEY, which would shadow Claude Code's own auth.",
  );
  process.exit(1);
}
const client = new Anthropic({ apiKey: key });
// A pass keeps its call files, batch id, and results under one subdir so the
// reconciliation run and the corrections run share this driver without
// clobbering each other's files in the same workdir.
const CALLS = arg("calls", "calls");
const RESULTS = arg("results", "results.jsonl");
const dir = workdir(WORK);
const idPath = join(dir, CALLS, "batch-id.txt");

if (CMD === "submit") {
  const requests = readdirSync(join(dir, CALLS))
    .filter((f) => /^call-\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, CALLS, f), "utf8")));
  if (!requests.length) {
    console.error("No call files. Run build-calls.mjs first.");
    process.exit(1);
  }
  const batch = await client.messages.batches.create({ requests });
  writeFileSync(idPath, batch.id);
  console.log(`Submitted ${requests.length} calls as ${batch.id}`);
  console.log(`Poll with: node scripts/reconcile/batch.mjs status --work ${WORK}`);
} else {
  if (!existsSync(idPath)) {
    console.error("No batch-id.txt. Run submit first.");
    process.exit(1);
  }
  const id = readFileSync(idPath, "utf8").trim();
  const batch = await client.messages.batches.retrieve(id);

  if (CMD === "status") {
    console.log(`${id}: ${batch.processing_status}`);
    console.log(`  ${JSON.stringify(batch.request_counts)}`);
    process.exit(0);
  }

  if (batch.processing_status !== "ended") {
    console.error(`Batch is ${batch.processing_status}, not ended. Nothing to collect yet.`);
    process.exit(1);
  }

  const rows = [];
  const problems = [];
  for await (const res of await client.messages.batches.results(id)) {
    if (res.result.type !== "succeeded") {
      problems.push(`${res.custom_id}: ${res.result.type}`);
      continue;
    }
    const msg = res.result.message;
    // A truncated result is a silently half-written answer: the last vendor in
    // the call gets a partial JSON object. Refuse it rather than gate garbage.
    if (msg.stop_reason === "max_tokens") {
      problems.push(`${res.custom_id}: TRUNCATED - re-run this call with a higher --max-tokens`);
      continue;
    }
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    // Objects are extracted by brace balance, not by line. The contract asks for
    // one object per line, but the model sometimes pretty-prints an object
    // across several lines; a line-based split then hands JSON.parse a fragment
    // and drops the whole vendor. Scanning for balanced braces (ignoring braces
    // inside strings) accepts either shape.
    const found = extractObjects(text);
    for (const t of found.objects) {
      try {
        rows.push(JSON.parse(t));
      } catch {
        problems.push(`${res.custom_id}: unparseable object - ${t.slice(0, 80)}`);
      }
    }
    if (found.trailing.trim().startsWith("{"))
      problems.push(`${res.custom_id}: unterminated object at end - possible truncation`);
  }

  writeJsonl(join(dir, RESULTS), rows);
  console.log(`Collected ${rows.length} vendor results -> ${RESULTS}`);
  if (problems.length) {
    console.log(`\n${problems.length} problems:`);
    for (const p of problems) console.log(`  ${p}`);
  }
  console.log(`\nNext: node scripts/reconcile/gate.mjs --work ${WORK}`);
}
