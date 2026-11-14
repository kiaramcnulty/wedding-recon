#!/bin/sh
# Vercel "Ignored Build Step" (vercel.json `ignoreCommand`).
# Exit 0 = SKIP this build. Exit 1 = build.
#
# Why: every production deploy starts Vercel's CDN cache over (it is keyed per
# deployment), so the first visitors after it pay function CPU to refill the
# map, photo and page caches -- on Hobby, out of the 4 CPU-hour allowance
# (docs/notes/function-cpu.md). A commit that only touches notes, scripts,
# migrations or skill files changes nothing that is deployed, so it should not
# cost a refill.
#
# The rule: skip ONLY when every file that changed since the last successful
# deployment of this branch is in the list below. Anything uncertain builds:
# no previous deployment, a previous SHA the shallow clone does not have, or
# any git error. Building when unsure is cheap; skipping a real change means
# merged code that never ships.
#
# Not deployed, so excluded: top-level *.md, docs/, scripts/ (the pipelines,
# test scripts and this file), supabase/ (migrations are hand-applied), data/,
# recon/, mockups/, outreach/, analytics/, the skill trees (.claude, .agents,
# .codex) and .github/. A type error in a scripts/*.ts file therefore does not
# block a deploy until the next app change builds. That is the intended
# trade-off, not a gap. Keep this list in sync with
# scripts/test-vercel-ignore-build.mjs.

prev="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$prev" ]; then
  echo "ignore-build: no previous deployment SHA, building"
  exit 1
fi
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  echo "ignore-build: previous SHA ${prev} is not in this clone, building"
  exit 1
fi

git diff --quiet "$prev" HEAD -- . \
  ':(exclude,glob)*.md' \
  ':(exclude)docs' \
  ':(exclude)scripts' \
  ':(exclude)supabase' \
  ':(exclude)data' \
  ':(exclude)recon' \
  ':(exclude)mockups' \
  ':(exclude)outreach' \
  ':(exclude)analytics' \
  ':(exclude).claude' \
  ':(exclude).agents' \
  ':(exclude).codex' \
  ':(exclude).github'
status=$?

if [ "$status" -eq 0 ]; then
  echo "ignore-build: only non-deployed files changed since ${prev}, skipping"
  exit 0
fi
if [ "$status" -eq 1 ]; then
  echo "ignore-build: deployed files changed since ${prev}, building"
else
  echo "ignore-build: git diff failed (${status}), building"
fi
exit 1
