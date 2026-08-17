-- Only HUMAN recon marks a vendor for filter reconciliation.
--
-- Migration 0038 stamped filters_dirty_at on every recon write. That was right
-- when the daily pass only READ recon to compute tags. It is now wrong: the
-- daily pass also WRITES bot recon entries (the website tag/recon miner), and a
-- bot write that re-stamps the vendor makes the next run reconsider it, which
-- can write again - a nightly loop.
--
-- The fix follows from what the async pass is for. A bot writer produces the tag
-- in the SAME pass it writes the entry (enrich at upload, the website miner as
-- it drafts), so re-reconciling a bot entry only re-derives what the bot already
-- wrote. The async reconcile exists to tag recon whose author could not tag it,
-- and the only such author is a human - the app has no tag UI on Save Recon. So:
-- mark dirty on human insert or edit; a bot insert or bot content edit does not.
--
-- Two things still mark dirty regardless of authorship, and neither can feed the
-- loop (a removal never re-inserts):
--   1. Any removal - a DELETE, or an UPDATE that flips status to removed. A gone
--      entry can orphan a tag that must now be retracted.
--   2. Any status flip either way (active to removed, removed to active), since a
--      vote added or taken away changes the tally.
--
-- Not auto-applied to the hosted DB - run this by hand in the SQL editor.
-- See docs/filter-recon-on-write.md.

create or replace function mark_vendor_filters_dirty()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_bot boolean;
  v_status_changed boolean := false;
begin
  -- A removal always marks dirty, whatever the authorship: the tag it supported
  -- may need retracting, and a removal never re-inserts, so it cannot feed the
  -- write-loop the human-only rule exists to break.
  if tg_op = 'DELETE' then
    update vendors set filters_dirty_at = now() where id = old.vendor_id;
    return old;
  end if;

  -- INSERT or UPDATE. Look up whether the author is a bot. A missing profile or
  -- a null is_bot counts as human, so the default is to reconcile, never to skip.
  select is_bot into v_is_bot from profiles where id = new.author_id;

  if tg_op = 'UPDATE' then
    v_status_changed := old.status is distinct from new.status;
  end if;

  -- Mark dirty when a human writes, or when a status flip changes the tally. A
  -- bot insert or a bot content edit (status unchanged) does not: the bot writer
  -- already emitted this vendor tags in the same pass, so a reconcile would only
  -- re-derive them.
  if coalesce(v_is_bot, false) = false or v_status_changed then
    update vendors set filters_dirty_at = now() where id = new.vendor_id;
  end if;

  -- Vendor moved (carried over from 0038): the vendor it left also needs a
  -- recompute so a tag it uniquely supported can be retracted from that side.
  if tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id then
    update vendors set filters_dirty_at = now() where id = old.vendor_id;
  end if;

  return new;
end;
$$;

-- Trigger definition is unchanged from 0038; re-created idempotently so applying
-- this file alone installs the new function on the same trigger.
drop trigger if exists on_recon_entry_change on recon_entries;
create trigger on_recon_entry_change
  after insert or update or delete on recon_entries
  for each row execute function mark_vendor_filters_dirty();
