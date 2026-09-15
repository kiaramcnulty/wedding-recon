#!/usr/bin/env node
/**
 * Regenerate the Codex skill mirrors from the canonical Claude Code tree.
 *
 * `.claude/skills` + `.claude/agents` + `.claude/hooks` are the source of truth.
 * Codex reads the same material from different places (`.agents/skills`,
 * `.codex/agents`, `.codex/hooks`), so the repo carries a second copy -- and a
 * hand-maintained second copy drifts. It already had, twice:
 *
 *   - Every `.agents/skills/<name>/SKILL.md` told the agent to run scripts from
 *     `.Codex/skills/.../scripts/`, a directory that does not exist. A Codex
 *     session following its own skill file failed on the first command. 26
 *     occurrences across two files.
 *   - `pipeline.mjs` hardcoded its references path as `.claude/skills/...`, so
 *     the Codex copy silently read the CLAUDE tree's drafting rules. It
 *     "worked" only because both trees coexist here, and would have diverged
 *     the moment one mirror's rules changed. (Now derived from
 *     `import.meta.url`, so each copy reads its own.)
 *
 * Hence this script: one command, no judgment, and a `--check` mode so CI or a
 * pre-commit pass can fail when someone edits a skill and forgets the mirror.
 *
 * Usage:
 *   node scripts/sync-codex-mirrors.mjs            # write the mirrors
 *   node scripts/sync-codex-mirrors.mjs --check    # exit 1 if they are stale
 *
 * NOTE the mirrors are also ignored by eslint (see eslint.config.mjs): linting
 * them double-reports every finding in the canonical tree.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/**
 * Text rewrites applied to every mirrored .md and .mjs file.
 *
 * These are path/runtime-name substitutions ONLY -- never content edits, so a
 * rule change lands in both trees identically. Applied to script files too, not
 * just SKILL.md: the original hand-mirroring only ever touched SKILL.md, which
 * left 11 type cards and 16 script headers in the Codex tree still instructing
 * the reader to run `.claude/...` paths. That is the same defect as the
 * `.Codex/` one, just quieter.
 */
const REWRITES = [
  [/\.claude\/skills\//g, ".agents/skills/"],
  [/\.claude\/agents\//g, ".codex/agents/"],
  [/\.claude\/hooks\//g, ".codex/hooks/"],
  // The runtime's own name, e.g. "(e.g. Claude Code on the web)".
  [/Claude Code/g, "Codex"],
];

const TEXT_EXT = new Set([".md", ".mjs", ".json", ".sh"]);

function rewrite(text) {
  return REWRITES.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

/** Every file under `dir`, as paths relative to it. */
function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

const stale = [];
let written = 0;

/**
 * Write `content` to `rel`, or record it as stale under --check.
 *
 * `checked: false` writes the file but exempts it from --check. That is for
 * output which is gitignored AND machine-specific, so comparing it proves
 * nothing: it is legitimately absent in a fresh clone (which would otherwise
 * fail `npm test` on a clean checkout -- caught by cloning the repo and running
 * the check) and legitimately different on another machine.
 */
function emit(rel, content, { checked = true } = {}) {
  const abs = path.join(ROOT, rel);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
  const next = Buffer.from(content);
  if (existing && existing.equals(next)) return;
  if (CHECK) {
    if (checked) stale.push(rel + (existing ? " (differs)" : " (missing)"));
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next);
  written++;
}

// ── 1. skills: .claude/skills -> .agents/skills ──────────────────────────────
for (const rel of walk(path.join(ROOT, ".claude/skills"))) {
  const src = path.join(ROOT, ".claude/skills", rel);
  const ext = path.extname(rel);
  // Binary-safe: only rewrite known text types, copy anything else byte for byte.
  const content = TEXT_EXT.has(ext)
    ? rewrite(fs.readFileSync(src, "utf8"))
    : fs.readFileSync(src);
  emit(path.join(".agents/skills", rel), content);
}

// ── 2. agents: .claude/agents/*.md -> .codex/agents/*.toml ───────────────────
// A format conversion, not a copy. The Claude form is YAML frontmatter plus a
// markdown body; the Codex form is flat TOML with the body as
// `developer_instructions`. `tools` and `model` are deliberately DROPPED --
// Codex expresses those elsewhere, and emitting them as TOML keys would be
// inventing a schema.
for (const rel of walk(path.join(ROOT, ".claude/agents"))) {
  if (path.extname(rel) !== ".md") continue;
  const raw = fs.readFileSync(path.join(ROOT, ".claude/agents", rel), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    console.error(`skip ${rel}: no YAML frontmatter`);
    continue;
  }
  const [, fm, body] = m;
  const field = (key) => {
    const hit = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
    return hit ? hit[1].trim() : null;
  };
  const name = field("name") ?? path.basename(rel, ".md");
  const description = rewrite(field("description") ?? "");
  const instructions = rewrite(body.trim());
  // TOML basic strings need escaped backslashes and quotes; the multi-line
  // literal only needs a guard against a stray triple quote.
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const toml =
    `name = "${esc(name)}"\n` +
    `description = "${esc(description)}"\n` +
    `developer_instructions = """\n${instructions.replace(/"""/g, '\\"\\"\\"')}"""\n`;
  emit(path.join(".codex/agents", rel.replace(/\.md$/, ".toml")), toml);
}

// ── 3. hooks: .claude/hooks -> .codex/hooks ──────────────────────────────────
for (const rel of walk(path.join(ROOT, ".claude/hooks"))) {
  const src = path.join(ROOT, ".claude/hooks", rel);
  const ext = path.extname(rel);
  const content = TEXT_EXT.has(ext)
    ? rewrite(fs.readFileSync(src, "utf8"))
    : fs.readFileSync(src);
  emit(path.join(".codex/hooks", rel), content);
  if (!CHECK) fs.chmodSync(path.join(ROOT, ".codex/hooks", rel), fs.statSync(src).mode);
}

// ── 4. .codex/hooks.json ─────────────────────────────────────────────────────
// Generated, and GITIGNORED, because Codex wants an absolute command path and
// that is machine-specific -- committing this developer's home directory would
// break it for anyone else. Run this script once per checkout to produce it.
const hooksJson =
  JSON.stringify(
    {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `'${path.join(ROOT, ".codex/hooks/session-start.sh")}'`,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  ) + "\n";
emit(".codex/hooks.json", hooksJson, { checked: false });

// ── self-check: no canonical-tree paths may survive into a mirror ────────────
// The rewrites are blind string substitutions, so a sentence that MENTIONS the
// other tree gets mangled rather than translated -- an explanatory comment
// reading ".claude/skills for Claude Code, .agents/skills for Codex" came out
// as ".claude/skills for Codex, .agents/skills for Codex", which is nonsense in
// the mirror AND leaves a stale path behind. Cheap to detect, so detect it:
// anything left pointing at the canonical tree is a wording problem in the
// SOURCE file, to be fixed there rather than patched here.
if (!CHECK) {
  const leftovers = [];
  for (const [dir, sub] of [[".agents", "skills"], [".codex", ""]]) {
    const base = path.join(ROOT, dir, sub);
    if (!fs.existsSync(base)) continue;
    for (const rel of walk(base)) {
      if (!TEXT_EXT.has(path.extname(rel))) continue;
      const text = fs.readFileSync(path.join(base, rel), "utf8");
      text.split("\n").forEach((line, i) => {
        if (line.includes(".claude/")) {
          leftovers.push(`${path.join(dir, sub, rel)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
  if (leftovers.length) {
    console.warn(
      `\nWARNING — ${leftovers.length} line(s) in the mirrors still point at the` +
        ` canonical tree.\nReword the SOURCE file so the substitution cannot mangle` +
        ` it (avoid naming either tree literally):`,
    );
    for (const l of leftovers) console.warn(`  ${l}`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (CHECK) {
  if (stale.length) {
    console.error(
      `Codex mirrors are stale (${stale.length} file(s)). Run:\n` +
        `  node scripts/sync-codex-mirrors.mjs\n`,
    );
    for (const s of stale) console.error(`  ${s}`);
    process.exit(1);
  }
  console.log("Codex mirrors are in sync.");
} else {
  console.log(
    written === 0
      ? "Codex mirrors already in sync — nothing written."
      : `Codex mirrors synced — ${written} file(s) written.`,
  );
}
