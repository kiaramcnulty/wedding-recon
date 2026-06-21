-- Public storage bucket for user-uploaded recon images.

insert into storage.buckets (id, name, public)
values ('recon-media', 'recon-media', true)
on conflict (id) do nothing;

-- Anyone can read (public bucket, used in <img> on public vendor pages).
create policy "recon media public read" on storage.objects
  for select using (bucket_id = 'recon-media');

-- Authenticated users can upload into the bucket.
create policy "authenticated upload recon media" on storage.objects
  for insert to authenticated with check (bucket_id = 'recon-media');

-- Uploaders can manage their own objects.
create policy "owners update recon media" on storage.objects
  for update to authenticated using (bucket_id = 'recon-media' and owner = auth.uid());
create policy "owners delete recon media" on storage.objects
  for delete to authenticated using (bucket_id = 'recon-media' and owner = auth.uid());
