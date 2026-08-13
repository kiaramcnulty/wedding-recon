-- Mark a vendor for filter reconciliation whenever its recon changes.
--
-- Any recon write - a couple through the site, a bot from enrich, a one-off
-- script - can change what the vendor filter tags should say. The reconcile
-- pass is a model call on the Batch API and cannot sit in front of a Save Recon
-- tap, so the write does not compute tags. It only stamps filters_dirty_at, and
-- a daily batch (scripts/reconcile, --dirty mode) recomputes the tags for the
-- stamped vendors from all of their active entries.
--
-- The stamp is set on INSERT, UPDATE and DELETE: an edit changes a fact, a
-- delete removes a vote (and may retract a tag no other entry supports), and a
-- status flip between active and removed is an UPDATE. It fires for every row,
-- so an enrich upload of many entries coalesces to one stamp per vendor.
--
-- Not auto-applied to the hosted DB - run this by hand in the SQL editor.

alter table vendors add column if not exists filters_dirty_at timestamptz;

-- Existing rows are left null (clean) on purpose. Backfilling every vendor as
-- dirty would make the first daily run reconcile the whole corpus, which is the
-- one-off offline pass job and is already done. Only recon written from now on
-- marks a vendor.

-- The dirty set is a small tail of the table between runs, so a partial index
-- keeps the daily selection cheap and is not taxed on the clean majority.
create index if not exists idx_vendors_filters_dirty
  on vendors (filters_dirty_at)
  where filters_dirty_at is not null;

create or replace function mark_vendor_filters_dirty()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update vendors set filters_dirty_at = now() where id = old.vendor_id;
    return old;
  end if;

  update vendors set filters_dirty_at = now() where id = new.vendor_id;

  -- A recon entry never moves between vendors, but if one ever did, the vendor
  -- it left also needs a recompute so a tag it uniquely supported can be
  -- retracted from that side too.
  if tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id then
    update vendors set filters_dirty_at = now() where id = old.vendor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_recon_entry_change on recon_entries;
create trigger on_recon_entry_change
  after insert or update or delete on recon_entries
  for each row execute function mark_vendor_filters_dirty();

comment on column vendors.filters_dirty_at is
  'Set by the on_recon_entry_change trigger when this vendor recon changes; cleared by the daily filter reconcile once the tags are recomputed. See supabase/migrations/0038 and docs/filter-recon-on-write.md.';
