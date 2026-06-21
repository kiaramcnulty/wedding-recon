-- Row-Level Security. Public read is intentional: shared vendor deeplinks must
-- render for people without an account.

alter table profiles enable row level security;
alter table vendors enable row level security;
alter table recon_entries enable row level security;
alter table recon_media enable row level security;
alter table saved_vendors enable row level security;
alter table reports enable row level security;

-- Profiles: usernames are public; users manage their own row. --------------
create policy "profiles are public" on profiles
  for select using (true);
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Vendors: public read; any authenticated user can add. --------------------
create policy "vendors are public" on vendors
  for select using (true);
create policy "authenticated insert vendors" on vendors
  for insert to authenticated with check (auth.uid() = created_by or created_by is null);

-- Recon entries: public can read only active entries; flagged/removed hidden.
create policy "active recon is public" on recon_entries
  for select using (status = 'active' or author_id = auth.uid());
create policy "authenticated insert recon" on recon_entries
  for insert to authenticated with check (auth.uid() = author_id);
create policy "authors update own recon" on recon_entries
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own recon" on recon_entries
  for delete using (auth.uid() = author_id);

-- Recon media: readable when its parent entry is readable. -----------------
create policy "recon media follows entry visibility" on recon_media
  for select using (
    exists (
      select 1 from recon_entries e
      where e.id = recon_media.recon_entry_id
        and (e.status = 'active' or e.author_id = auth.uid())
    )
  );
create policy "authors insert media for own recon" on recon_media
  for insert to authenticated with check (
    exists (
      select 1 from recon_entries e
      where e.id = recon_media.recon_entry_id and e.author_id = auth.uid()
    )
  );

-- Saved vendors: strictly private to the owner. ----------------------------
create policy "users read own saves" on saved_vendors
  for select using (auth.uid() = user_id);
create policy "users insert own saves" on saved_vendors
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own saves" on saved_vendors
  for delete using (auth.uid() = user_id);

-- Reports: any authenticated user can file one; nobody reads via the client.
create policy "authenticated file reports" on reports
  for insert to authenticated with check (auth.uid() = reporter_id);
