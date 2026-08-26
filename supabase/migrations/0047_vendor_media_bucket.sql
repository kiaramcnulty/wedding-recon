-- 0047_vendor_media_bucket.sql
-- Storage for vendor-uploaded listing photos (Vendor Verification).
--
-- Same shape as the recon-media bucket (0005/0010): PUBLIC READ, writes scoped
-- by RLS. Deliberately NOT a conditional-read policy or a serving proxy - a
-- storage policy cannot reasonably express "referenced by a published listing",
-- and it is not needed: paths are unguessable uuids, nothing public references
-- one until the listing publishes, and this is exactly the exposure recon-media
-- already accepts (a recon photo uploads before its entry exists).
--
-- The write scope is the difference from recon-media: an upload path is
-- namespaced <vendor_id>/<user_id>/<submission>/..., and insert is allowed only
-- when the caller holds an APPROVED CLAIM on that first-folder vendor id. So a
-- claimant can only ever write under a vendor they manage. Update and delete are
-- owner-only, the same as recon-media. The Save action re-validates the
-- namespace before recording paths on vendor_listings.photos.
--
-- Path folder is read with storage.foldername(name); the first element is the
-- vendor id, compared as TEXT so a malformed path simply matches no claim
-- rather than erroring on a uuid cast.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file.
-- Not auto-applied - hand-apply in the Supabase SQL editor. Idempotent.

insert into storage.buckets (id, name, public)
values ('vendor-media', 'vendor-media', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 52428800, -- 50 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'vendor-media';

-- Public read (used in <img> on public vendor pages).
drop policy if exists "vendor media public read" on storage.objects;
create policy "vendor media public read" on storage.objects
  for select using (bucket_id = 'vendor-media');

-- Insert only under a vendor the caller has an approved claim on.
drop policy if exists "claimants upload vendor media" on storage.objects;
create policy "claimants upload vendor media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vendor-media'
    and exists (
      select 1 from vendor_claims c
      where c.user_id = (select auth.uid())
        and c.status = 'approved'
        and c.vendor_id::text = (storage.foldername(name))[1]
    )
  );

-- Owners manage their own objects (Supabase stamps owner = auth.uid()).
drop policy if exists "owners update vendor media" on storage.objects;
create policy "owners update vendor media" on storage.objects
  for update to authenticated
  using (bucket_id = 'vendor-media' and owner = (select auth.uid()));

drop policy if exists "owners delete vendor media" on storage.objects;
create policy "owners delete vendor media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-media' and owner = (select auth.uid()));
