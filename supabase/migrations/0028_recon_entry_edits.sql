-- Recon entry editing: authors can revise their own entries.
--
-- 1. updated_at stays null until an entry is first edited, so a never-touched
--    row is distinguishable from one that was revised.
-- 2. One entry per (vendor, author). The UI has always assumed this -- the
--    vendor page hides its Add CTA once you have an entry -- but nothing
--    enforced it. Verified zero violations before adding the index.
--    Removed entries are excluded so a moderated takedown does not permanently
--    block that author from submitting fresh recon on the same vendor.

alter table recon_entries
  add column if not exists updated_at timestamptz;

create unique index if not exists recon_entries_vendor_author_uniq
  on recon_entries (vendor_id, author_id)
  where status <> 'removed';
