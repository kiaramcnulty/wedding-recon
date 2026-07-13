#!/bin/bash
# SessionStart setup for Claude Code on the web. Two jobs:
#   1. Install Node deps (the container caches this layer after the hook finishes).
#   2. In a REMOTE env only, materialize .env.local from configured environment
#      variables so the /enrichvendors + /launchvendors pipeline scripts — all
#      invoked as `node --env-file=.env.local ...` — run unchanged. Locally this
#      is a no-op: developers keep their own .env.local (and .env* is gitignored,
#      so the file this writes is never committed).
#
# Configure these as environment secrets on the Claude Code environment (web UI):
#   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (DB read/write — harvest, batch, upload, verify)
#   GOOGLE_PLACES_API_KEY                                (harvest: Places reviews/details)
#   ANTHROPIC_BATCH_API_KEY                              (draft.mjs: Batch drafting)
# Network access (set on the environment): api.anthropic.com and *.googleapis.com are
# in the Trusted default allowlist (draft.mjs + Places harvest work under Trusted).
# Add *.supabase.co via Custom access with "include defaults" for DB read/write.
# CAVEAT: harvest also crawls arbitrary vendor websites; the sandbox allowlist model
# can't cover the open web, so those site fetches fail in the cloud (harvest continues,
# dossiers are thinner — Places reviews only). Run harvest locally for full site coverage.
set -euo pipefail
cd "$CLAUDE_PROJECT_DIR"

npm install --no-audit --no-fund 1>&2

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  umask 077
  : > .env.local
  for var in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY GOOGLE_PLACES_API_KEY ANTHROPIC_BATCH_API_KEY NEXT_PUBLIC_SITE_URL; do
    val="${!var:-}"
    [ -n "$val" ] && printf '%s=%s\n' "$var" "$val" >> .env.local
  done
  echo "session-start: wrote .env.local ($(grep -c '=' .env.local || echo 0) var(s) from environment)" >&2
  for req in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY GOOGLE_PLACES_API_KEY ANTHROPIC_BATCH_API_KEY; do
    grep -q "^${req}=" .env.local || echo "session-start: WARNING ${req} not set in environment — pipeline steps that need it will fail" >&2
  done
fi
