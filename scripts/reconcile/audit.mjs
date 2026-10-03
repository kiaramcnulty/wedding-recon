/**
 * Durable undo for every reconcile write: a per-run snapshot of exactly the rows
 * a run will touch, taken from a fresh read BEFORE the first write, plus an
 * append-only audit log of every field it changes.
 *
 * WHY THIS EXISTS. The 2026-08-09/11 Direction-A run appended sentences to 1,301
 * live bot entries. Its snapshot lived in `data/reconcile/<work>/` under the
 * worktree it ran from, and that worktree was deleted afterwards - taking the
 * only undo with it, since `recon_entries` keeps no history. An audit later found
 * false sentences among those appends and there was nothing to restore from and
 * no record of which sentence came from where (docs/bot-recon-quality-plan.md,
 * item 1).
 *
 * So two rules, enforced here rather than left to the README:
 *
 *   1. The snapshot + audit live OUTSIDE any worktree: in the MAIN checkout's
 *      `data/reconcile/<work>/`, found via `git rev-parse --git-common-dir`
 *      (which names the main repository's .git even from inside a worktree).
 *      Deleting a worktree can never delete the undo again. On a CI runner the
 *      checkout IS the main checkout, so the path is unchanged there and the
 *      report artifact still picks it up.
 *
 *   2. A write without a snapshot is impossible, not merely discouraged. Every
 *      mutation goes through WriteRun.update / insert / remove, which throw
 *      unless the row was snapshotted (and the snapshot fsynced) first. There is
 *      no "skip snapshot" flag.
 *
 * Layout under <main>/data/reconcile/<work>/:
 *   runs/<run_id>/run.json                 who/what/when/where for the run
 *   runs/<run_id>/snapshot-<table>.jsonl   pre-write rows (only the touched ones)
 *   audit.jsonl                            append-only, one line per field write
 *
 * restore.mjs reads these (`--run <id>`, or every run of the work) and reverts.
 */

import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { ROOT } from "./lib.mjs";

/** Columns each table's snapshot captures - everything a reconcile run may write. */
export const SNAPSHOT_COLUMNS = {
  recon_entries:
    "id,vendor_id,author_id,status,notes,price_text,price_details,service_region,recon_collected_month,recon_collected_year,updated_at",
  vendors: "id,name,vendor_type,website,city,address_text,location,filters,filters_meta,filters_source,filters_updated_at,filters_dirty_at",
};

const git = (args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/**
 * The main checkout's root. Throws when it cannot be established - and a caller
 * that cannot establish it must not write, because the fallback (ROOT) is
 * exactly the worktree-local path that lost the 2026-08-09 snapshot.
 */
export function mainCheckoutRoot() {
  let common;
  try {
    common = git(["rev-parse", "--git-common-dir"]);
  } catch {
    throw new Error(
      "cannot resolve the main checkout (git rev-parse --git-common-dir failed). " +
        "Refusing to write: the undo would land somewhere a worktree delete can remove.",
    );
  }
  const abs = resolve(ROOT, common);
  if (basename(abs) !== ".git") {
    throw new Error(`unexpected git common dir ${abs} (not a .git directory) - refusing to guess the main checkout`);
  }
  return dirname(abs);
}

/** Paths of every LINKED worktree (not the main one). */
function linkedWorktrees(main) {
  try {
    return git(["worktree", "list", "--porcelain"])
      .split("\n")
      .filter((l) => l.startsWith("worktree "))
      .map((l) => resolve(l.slice("worktree ".length)))
      .filter((p) => p !== main);
  } catch {
    return [];
  }
}

/**
 * <main>/data/reconcile/<work>/, created if needed.
 *
 * RECONCILE_DURABLE_ROOT overrides the parent directory (offline tests point it
 * at a scratch dir), but the inside-a-worktree refusal below applies to the
 * override too, so it cannot be used to put the undo back where it was lost.
 */
export function durableDir(work) {
  if (!work || /[\\/]|\.\./.test(work)) throw new Error(`bad work name "${work}"`);
  const main = mainCheckoutRoot();
  const parent = process.env.RECONCILE_DURABLE_ROOT
    ? resolve(process.env.RECONCILE_DURABLE_ROOT)
    : join(main, "data/reconcile");
  const dir = join(parent, work);
  const inside = (p, root) => p === root || p.startsWith(root + sep);
  const bad =
    dir.includes(`${sep}.claude${sep}worktrees${sep}`) ||
    linkedWorktrees(main).some((w) => inside(dir, w));
  if (bad) {
    throw new Error(
      `durable dir ${dir} is inside a git worktree - refusing. ` +
        "The 2026-08-09 reconcile snapshot was lost exactly this way.",
    );
  }
  mkdirSync(join(dir, "runs"), { recursive: true });
  return dir;
}

/** Write a file and fsync it, so "snapshot written" means on disk, not in a buffer. */
function writeDurable(path, text) {
  const fd = openSync(path, "a");
  try {
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/**
 * One writing run. Construct with apply=false for a dry run: every guard still
 * runs and the audit lines are printed-only, nothing touches the DB or disk.
 */
export class WriteRun {
  constructor({ work, script, apply, db }) {
    this.work = work;
    this.script = script;
    this.apply = Boolean(apply);
    this.db = db;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
    this.runId = `${stamp}-${script}-${randomBytes(3).toString("hex")}`;
    this.snap = { recon_entries: new Map(), vendors: new Map() };
    this.current = { recon_entries: new Map(), vendors: new Map() };
    this.writes = 0;
    if (this.apply) {
      if (!db) throw new Error("WriteRun with apply=true needs a db client");
      this.dir = durableDir(work);
      this.runDir = join(this.dir, "runs", this.runId);
      mkdirSync(this.runDir, { recursive: true });
      this.auditPath = join(this.dir, "audit.jsonl");
      let head = null;
      try {
        head = git(["rev-parse", "HEAD"]);
      } catch {}
      writeDurable(
        join(this.runDir, "run.json"),
        JSON.stringify(
          { run_id: this.runId, work, script, started_at: new Date().toISOString(), checkout: ROOT, git_head: head },
          null,
          2,
        ) + "\n",
      );
    }
  }

  /**
   * Snapshot the given rows from a FRESH read (not the export - the export can
   * be days old and something else may have edited the row since). Call before
   * the first write to any of them; may be called more than once per table.
   * Rows that do not exist are recorded as absent so restore can tell.
   */
  async snapshot(table, ids) {
    const cols = SNAPSHOT_COLUMNS[table];
    if (!cols) throw new Error(`no snapshot columns for table ${table}`);
    const want = [...new Set(ids)].filter((id) => id && !this.snap[table].has(id));
    if (!want.length) return;
    if (!this.apply) {
      // Dry run: mark them so the write guards behave as they will for real.
      for (const id of want) this.snap[table].set(id, null);
      return;
    }
    const rows = [];
    for (const part of chunk(want, 200)) {
      const { data, error } = await this.db.from(table).select(cols).in("id", part);
      if (error) throw new Error(`snapshot read ${table}: ${error.message} - nothing written`);
      rows.push(...data);
    }
    const found = new Map(rows.map((r) => [r.id, r]));
    const lines = want.map((id) =>
      JSON.stringify(found.has(id) ? { table, ...found.get(id) } : { table, id, absent: true }),
    );
    writeDurable(join(this.runDir, `snapshot-${table}.jsonl`), lines.join("\n") + "\n");
    for (const id of want) {
      this.snap[table].set(id, found.get(id) ?? null);
      if (found.has(id)) this.current[table].set(id, { ...found.get(id) });
    }
  }

  /** The last-known value of a row (snapshot, updated by this run's own writes). */
  row(table, id) {
    return this.current[table].get(id) ?? null;
  }

  #assertSnapshotted(table, id) {
    if (!this.snap[table].has(id))
      throw new Error(
        `REFUSING to write ${table} ${id}: it was not snapshotted first. ` +
          "Every reconcile write needs a pre-write snapshot (the 2026-08-09 run had none left).",
      );
  }

  #audit(line) {
    const full = { ts: new Date().toISOString(), run_id: this.runId, work: this.work, script: this.script, ...line };
    if (this.apply) writeDurable(this.auditPath, JSON.stringify(full) + "\n");
    return full;
  }

  /**
   * Update one row. The options describe the change for the audit log:
   * { evidence: [{quote, source}], reason }. old/new are derived here from the
   * snapshot so a caller cannot log something other than what is written.
   */
  async update(table, id, patch, { evidence = [], reason = "", refine = (q) => q } = {}) {
    this.#assertSnapshotted(table, id);
    const before = this.row(table, id) ?? {};
    for (const [field, next] of Object.entries(patch)) {
      if (field === "updated_at" || field === "filters_updated_at") continue;
      this.#audit({
        op: "update",
        table,
        row_id: id,
        ...(table === "recon_entries" ? { entry_id: id } : { vendor_id: id }),
        field,
        old: before[field] ?? null,
        new: next ?? null,
        evidence,
        reason,
        status: this.apply ? "pending" : "dry-run",
      });
    }
    if (!this.apply) return { error: null };
    // `refine` adds a guard to the UPDATE (daily-apply's compare-and-clear on
    // filters_dirty_at); the audit records intent either way.
    const { error } = await refine(this.db.from(table).update(patch).eq("id", id));
    this.#audit({ op: "update", table, row_id: id, status: error ? "failed" : "applied", error: error?.message });
    if (!error) {
      this.current[table].set(id, { ...before, ...patch });
      this.writes++;
    }
    return { error };
  }

  /**
   * Insert one row. There is nothing to snapshot for a row that does not exist
   * yet, so the audit line is written BEFORE the insert (intent) and again with
   * the new id after: restore.mjs deletes every applied insert of the run.
   */
  async insert(table, row, { evidence = [], reason = "" } = {}) {
    this.#audit({ op: "insert", table, row, evidence, reason, status: this.apply ? "pending" : "dry-run" });
    if (!this.apply) return { data: { id: "(dry-run)" }, error: null };
    const { data, error } = await this.db.from(table).insert(row).select("id").single();
    this.#audit({
      op: "insert",
      table,
      row_id: data?.id ?? null,
      vendor_id: row.vendor_id ?? null,
      status: error ? "failed" : "applied",
      error: error?.message,
    });
    if (!error) {
      this.snap[table].set(data.id, null); // absent before this run; restore deletes it
      this.current[table].set(data.id, { id: data.id, ...row });
      this.writes++;
    }
    return { data, error };
  }

  /** Delete one row (restore deleting a run's inserts). Snapshotted first, like any write. */
  async remove(table, id, { reason = "" } = {}) {
    this.#assertSnapshotted(table, id);
    this.#audit({ op: "delete", table, row_id: id, old: this.row(table, id), reason, status: this.apply ? "pending" : "dry-run" });
    if (!this.apply) return { error: null };
    const { error } = await this.db.from(table).delete().eq("id", id);
    this.#audit({ op: "delete", table, row_id: id, status: error ? "failed" : "applied", error: error?.message });
    if (!error) this.writes++;
    return { error };
  }

  /** Summary line for a script's output. */
  where() {
    return this.apply
      ? `run ${this.runId}: snapshot ${this.runDir}, audit ${this.auditPath}\n` +
          `undo: node scripts/reconcile/restore.mjs --work ${this.work} --run ${this.runId} --apply`
      : "dry run: nothing snapshotted or written";
  }
}

/** Every run recorded for a work, oldest first: [{run_id, meta, snapshots:{table: [rows]}}]. */
export function loadRuns(work) {
  const dir = durableDir(work);
  const runsDir = join(dir, "runs");
  const out = [];
  for (const id of existsSync(runsDir) ? readdirSync(runsDir).sort() : []) {
    const rd = join(runsDir, id);
    if (!existsSync(join(rd, "run.json"))) continue;
    const meta = JSON.parse(readFileSync(join(rd, "run.json"), "utf8"));
    const snapshots = {};
    for (const table of Object.keys(SNAPSHOT_COLUMNS)) {
      const p = join(rd, `snapshot-${table}.jsonl`);
      snapshots[table] = existsSync(p)
        ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
        : [];
    }
    out.push({ run_id: id, meta, snapshots });
  }
  return out;
}

/** The audit log for a work, as parsed lines. */
export function loadAudit(work) {
  const p = join(durableDir(work), "audit.jsonl");
  return existsSync(p)
    ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
}

/** Append a non-write note to the audit log (e.g. a rejected edit), apply runs only. */
export function auditNote(run, line) {
  if (!run.apply) return;
  appendFileSync(
    run.auditPath,
    JSON.stringify({ ts: new Date().toISOString(), run_id: run.runId, work: run.work, script: run.script, ...line }) + "\n",
  );
}
