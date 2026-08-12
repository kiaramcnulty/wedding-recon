# Pilot runbook: on-write filter reconcile

Hand-off for a **local session with DB + Batch API credentials** (this feature was
built in a container that has none). Branch:
`claude/filter-tags-vendor-entries-2ewmy5`. Design: `docs/filter-recon-on-write.md`.

Goal: apply the trigger, prove the daily pass end-to-end on a small controlled
set, then enable the schedule. It writes `vendors.filters` only and **never edits
a recon entry** (human or bot) - verify that claim yourself with
`grep -nE "recon_entries|\.update\(|\.insert\(|\.delete\(" scripts/reconcile/daily-*.mjs`:
the only writes are `db.from("vendors").update(...)`.

Prereqs: on the branch above, `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_BATCH_API_KEY`; Node 24 (the scripts
import a `.ts` config and rely on Node's type stripping).

---

## Step 1 - apply migration 0038

Paste `supabase/migrations/0038_recon_marks_filters_dirty.sql` into the Supabase
SQL editor and run it. It adds `vendors.filters_dirty_at` + an AFTER
INSERT/UPDATE/DELETE trigger on `recon_entries` that stamps it. Existing rows stay
null on purpose (no backfill).

Verify:

```sql
select column_name from information_schema.columns
where table_name = 'vendors' and column_name = 'filters_dirty_at';   -- 1 row
select tgname from pg_trigger where tgname = 'on_recon_entry_change'; -- 1 row
select count(*) from vendors where filters_dirty_at is not null;      -- 0 for now
```

## Step 2 - seed a small dirty test set

Nothing is dirty until recon is written post-migration. Either add/edit one recon
entry through the site, or mark a controlled set directly. Pick vendors that have
both filters and active recon so the extend/overwrite paths can actually fire:

```sql
update vendors set filters_dirty_at = now()
where id in (
  select v.id from vendors v
  where v.vendor_type in ('venue','photos')
    and v.filters is not null
    and exists (select 1 from recon_entries r
                where r.vendor_id = v.id and r.status = 'active')
  order by v.vendor_type, v.id
  limit 8
);
select id, name, vendor_type from vendors where filters_dirty_at is not null;
```

## Step 3 - run the pilot locally (dry run first)

```sh
WORK=daily-pilot-$(date +%Y%m%d)
node scripts/reconcile/daily-export.mjs      --work "$WORK"   # dirty vendors + snapshot + watermark
node scripts/reconcile/daily-build-calls.mjs --work "$WORK"   # tags-only call files
node scripts/reconcile/batch.mjs submit      --work "$WORK"
node scripts/reconcile/batch.mjs status      --work "$WORK"   # repeat until it prints ": ended"
node scripts/reconcile/batch.mjs collect     --work "$WORK"
node scripts/reconcile/daily-apply.mjs       --work "$WORK"   # DRY RUN - writes data/reconcile/$WORK/report.md
```

Read `data/reconcile/$WORK/report.md`. Confirm: create/extend/overwrite/retract
counts look sane; **contradictions in the REVIEW section** cite real evidence and
the human-over-bot resolution is right; no manual key was touched; rejected writes
are genuinely bad evidence. Only then:

```sh
node scripts/reconcile/daily-apply.mjs --work "$WORK" --apply
```

Verify in the DB, then test the undo works:

```sql
select id, name, filters, filters_meta->'price_max', filters_dirty_at
from vendors where id in ( /* the pilot ids from step 2 */ );
-- expect: tags updated, filters_meta source 'recon' with a quote, filters_dirty_at NULL
```

```sh
node scripts/reconcile/restore.mjs --work "$WORK" --apply   # reverts filters to the pre-run snapshot
```

Re-run `--apply` after restore if you want the changes back; it is resumable.

## Step 4 - enable the schedule (only after step 3 passes clean)

The GitHub Action `.github/workflows/filter-recon-daily.yml` ships disabled. To
turn it on:

1. Set the three repo secrets (Settings -> Secrets and variables -> Actions):
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_BATCH_API_KEY`.
2. Uncomment the `schedule:` block at the top of the workflow, commit, push.

Or hand back to the container session: once steps 1-2 (migration + secrets) are
done and confirmed, it can trigger the workflow with `dry_run=true`, read the
report from the job log, run a real `--apply`, and uncomment the cron.

## Gotchas

- **Batch is async.** `status` may say `in_progress` for a while; poll until
  `ended`. Costs are pennies for a set this small.
- **Nothing dirty?** `daily-export` exits clean and the rest no-ops. Re-seed
  step 2.
- **A vendor with no changes still gets its dirty flag cleared** (it was
  reconciled, nothing to write). A vendor the batch dropped stays dirty and
  retries. This is intended.
- Working artifacts land in `data/reconcile/$WORK/` (gitignored). The snapshot
  there is the only undo - do not delete it until you are done verifying.
