-- Cache of a venue's top Google Places photos (references only — never the image
-- bytes; those are fetched on demand via /api/vendor-photo and CDN-cached, which
-- keeps us within Google's no-caching terms AND off Supabase Storage).
-- Idempotent — safe to re-run. NOT auto-applied: run by hand in the Supabase SQL
-- editor.
--
--   google_photos            jsonb array (max 3) of { name, attrib, attribUri }.
--                            null = never resolved; [] = resolved, no usable photos.
--   google_photos_fetched_at cache stamp; rows older than ~30d are re-resolved on
--                            the next vendor-page view.
alter table vendors add column if not exists google_photos jsonb;
alter table vendors add column if not exists google_photos_fetched_at timestamptz;
