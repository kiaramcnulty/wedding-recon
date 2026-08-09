/**
 * Shared plumbing for the filter/recon reconciliation pass.
 *
 * The pass brings `vendors.filters` and `recon_entries` into agreement WITHOUT
 * reading any research: its whole input is a vendor's tags plus the text of its
 * existing recon entries. Both directions run off that same input.
 *
 *   A  tag exists, no entry mentions it  ->  append a clause to a bot entry
 *   B  an entry states it, no tag        ->  write the tag, with the quote
 *
 * Finding facts that NEITHER store holds needs the archived research and is a
 * separate, more expensive pass (Kiara, 2026-08-09 - deferred).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Locate `.env.local`.
 *
 * It is gitignored, so it exists only in the checkout the user actually works
 * in. Run from a worktree under `.claude/worktrees/`, `ROOT/.env.local` does not
 * exist and every script would die on a missing key that IS in fact configured.
 * `git rev-parse --git-common-dir` resolves to the MAIN repository's .git even
 * from inside a worktree, so its parent is the main checkout.
 */
function envCandidates() {
  const paths = [resolve(ROOT, ".env.local")];
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    const mainRoot = dirname(resolve(ROOT, common));
    paths.push(resolve(mainRoot, ".env.local"));
  } catch {
    // Not a git checkout, or git is unavailable. The ROOT candidate stands.
  }
  return paths;
}

export function loadEnv() {
  for (const p of envCandidates()) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
    return p;
  }
  return null;
}

/**
 * Service-role client. Reconciliation edits bot-authored rows across every
 * user, so it has to bypass RLS - same reasoning as the enrich upload path.
 */
export function serviceClient() {
  const from = loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      [
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        from ? `Read env from: ${from}` : "No .env.local found in:",
        from ? "" : envCandidates().map((p) => `  ${p}`).join("\n"),
        "",
        "This pass reads and writes the hosted database; it cannot run without them.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Page through a PostgREST table.
 *
 * PostgREST silently caps a response at its configured maximum (1000 rows on
 * this project) and returns NO error - it just hands back a short list. That
 * exact bug has now bitten this repo twice: the enrich upload deduped against a
 * truncated vendor list, and the map fetched a truncated pin set. Every read
 * here is over 2,163 vendors and several thousand recon entries, so every read
 * here pages explicitly.
 */
export async function fetchAll(db, table, select, tune = (q) => q, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await tune(db.from(table).select(select)).range(
      from,
      from + page - 1,
    );
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < page) return out;
  }
}

export function workdir(name) {
  const dir = resolve(ROOT, "data/reconcile", name);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "snapshot"), { recursive: true });
  return dir;
}

export const writeJsonl = (path, rows) =>
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

export const readJsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

/** Positional arg helper: `--flag value`. */
export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export const has = (name) => process.argv.includes(`--${name}`);
