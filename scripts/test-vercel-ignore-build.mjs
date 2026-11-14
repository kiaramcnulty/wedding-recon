#!/usr/bin/env node
/**
 * scripts/vercel-ignore-build.sh, run for real against throwaway git repos.
 *
 *   node scripts/test-vercel-ignore-build.mjs
 *
 * The dangerous failure is a SKIPPED build for a change that should ship:
 * merged code that silently never deploys. So most of these cases pin the
 * "build" side -- an app file anywhere in the range, a public/ asset, a
 * dependency bump, a missing or unknown previous SHA -- and only a range that
 * is entirely notes/scripts/migrations/skills may skip.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/vercel-ignore-build.sh");

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "ignore-build-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  const write = (path, body = String(Math.random())) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  const commit = (...paths) => {
    for (const p of paths) write(p);
    git("add", "-A");
    git("commit", "-q", "-m", `touch ${paths.join(" ")}`);
    return git("rev-parse", "HEAD");
  };
  return { dir, git, commit };
}

/** Run the hook in `dir` with VERCEL_GIT_PREVIOUS_SHA = prev. true = skipped. */
function skipped(dir, prev) {
  const env = { ...process.env };
  if (prev === undefined) delete env.VERCEL_GIT_PREVIOUS_SHA;
  else env.VERCEL_GIT_PREVIOUS_SHA = prev;
  const r = spawnSync("sh", [SCRIPT], { cwd: dir, env, encoding: "utf8" });
  if (r.status !== 0 && r.status !== 1) throw new Error(`unexpected exit ${r.status}: ${r.stderr}`);
  return r.status === 0;
}

const r = repo();
try {
  const base = r.commit("app/page.tsx", "package.json", "README.md");

  // Only non-deployed paths since the last deployment: skip.
  for (const path of [
    "docs/notes/x.md",
    "CLAUDE.md",
    "scripts/launch/run.mjs",
    "scripts/cost-sheet/build.ts",
    "supabase/migrations/0099_x.sql",
    "data/vendor-crm/x.csv",
    "recon/spec.pdf",
    "mockups/a.svg",
    "outreach/a.txt",
    "analytics/a.json",
    ".claude/skills/x/SKILL.md",
    ".agents/skills/x/SKILL.md",
    ".codex/agents/x.toml",
    ".github/workflows/x.yml",
  ]) {
    const head = r.commit(path);
    check(`only ${path} -> skip`, skipped(r.dir, base));
    r.git("reset", "-q", "--hard", base);
    void head;
  }

  // Anything deployed: build.
  for (const path of [
    "app/(app)/explore/page.tsx",
    "components/x.tsx",
    "lib/x.ts",
    "proxy.ts",
    "public/robots-extra.txt",
    "public/guide.pdf",
    "app/notes.md", // a markdown file INSIDE the app is not a top-level note
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "vercel.json",
    "tsconfig.json",
  ]) {
    r.commit(path);
    check(`${path} changed -> build`, !skipped(r.dir, base));
    r.git("reset", "-q", "--hard", base);
  }

  // A docs-only HEAD on top of an app change that was never deployed: the
  // range is what counts, not the last commit.
  r.commit("lib/x.ts");
  r.commit("docs/notes/y.md");
  check("app change earlier in the range -> build", !skipped(r.dir, base));
  r.git("reset", "-q", "--hard", base);

  // Uncertainty builds.
  r.commit("docs/notes/z.md");
  check("no previous SHA -> build", !skipped(r.dir, undefined));
  check("empty previous SHA -> build", !skipped(r.dir, ""));
  check("previous SHA not in clone -> build", !skipped(r.dir, "0123456789abcdef0123456789abcdef01234567"));
  check("garbage previous SHA -> build", !skipped(r.dir, "not-a-sha"));
  check("nothing changed since previous -> skip", skipped(r.dir, r.git("rev-parse", "HEAD")));
} finally {
  rmSync(r.dir, { recursive: true, force: true });
}

console.log(`vercel ignore-build: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
