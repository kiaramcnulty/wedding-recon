-- Remove ALL seed data before launch. Safe to run multiple times.
-- Deleting seed vendors cascades to their recon entries, media, and saves.
-- Deleting the sample auth user cascades to its profile and any remaining recon.

delete from vendors where source = 'seed';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000aa';
