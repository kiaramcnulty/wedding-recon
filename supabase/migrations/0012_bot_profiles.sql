-- Internal flag for seeded/curator bot accounts (enrichvenues pipeline).
-- Not surfaced in the UI yet; exists so a "Curated" badge can be added later
-- without guessing which authors were bots.
alter table profiles
add column if not exists is_bot boolean not null default false;
