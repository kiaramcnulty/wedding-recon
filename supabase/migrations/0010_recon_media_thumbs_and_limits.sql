-- Recon media: add a thumbnail path and constrain the storage bucket.
-- Idempotent — safe to re-run. NOT auto-applied: run by hand in the Supabase
-- SQL editor.

-- Each photo now stores a small (~400px) thumbnail alongside the full image so
-- list/card views serve tiny files (egress saver). Nullable for existing rows.
alter table recon_media add column if not exists thumb_path text;

-- Storage backstop: cap each uploaded object at 50 MB and restrict to images.
-- Photos are compressed client-side to ~300 KB before upload, so this only ever
-- stops a pathological file; the user-facing 50 MB-per-photo check lives in the
-- picker (components/add/image-upload.tsx).
update storage.buckets
set file_size_limit = 52428800, -- 50 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'recon-media';
