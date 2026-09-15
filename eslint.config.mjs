import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Git worktrees live under .claude/worktrees/ and each one is a FULL copy of
    // the repo, so linting them lints the codebase two or three times over. Two
    // stale worktrees were what made `npm run lint` report 41,335 problems /
    // 1,516 errors while the app's own source was clean — 476 of the 492 flagged
    // files were inside them. That made the gate CLAUDE.md requires before a
    // commit unusable, which is the real cost. Kept as a pattern (not just
    // deleted with those two worktrees) so the next one cannot resurrect it.
    ".claude/worktrees/**",

    // Codex-flavored mirrors of .claude/skills + .claude/agents. Same files,
    // different agent runtime — linting them double-reports every finding.
    ".agents/**",
    ".codex/**",

    // Skill/pipeline working artifacts, not source: launch + enrich workdirs,
    // reconciliation snapshots, and one-off upload scratch scripts. These are
    // gitignored operational output (data/ alone is ~1.3 GB locally).
    "data/**",
    ".recon-upload-tmp/**",
  ]),
  {
    // The cost-sheet generator walks `vendors.filters`, which is untyped jsonb
    // whose shape is per-vendor-type (see lib/constants/vendor-filters.ts). Its
    // helpers take `any` deliberately rather than narrowing an unknown at every
    // facet. It is a one-off giveaway-workbook builder run by hand, not shipped
    // app code, so the rule is relaxed HERE and nowhere else — app source must
    // stay clean of explicit any.
    files: ["scripts/cost-sheet/**/*.{ts,mjs}"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
