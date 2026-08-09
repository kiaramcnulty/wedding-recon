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
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("{")) continue; // drop stray prose or a markdown fence
      try {
        rows.push(JSON.parse(t));
      } catch {
        problems.push(`${res.custom_id}: unparseable line - ${t.slice(0, 80)}`);
      }
    }
  }

  writeJsonl(join(dir, RESULTS), rows);
  console.log(`Collected ${rows.length} vendor results -> ${RESULTS}`);
  if (problems.length) {
    console.log(`\n${problems.length} problems:`);
    for (const p of problems) console.log(`  ${p}`);
  }
  console.log(`\nNext: node scripts/reconcile/gate.mjs --work ${WORK}`);
}
