-- 0043_vendor_listings.sql
-- Vendor Verification, part 2 of 4: the vendor-entered listing.
--
-- Everything a claimed vendor enters in the portal lives HERE, never on
-- vendors - the merge into public reads happens at read time only (migration
-- 0045), gated on the perks predicate (0044). That separation is what makes
-- cancelling a subscription a boolean flip with no restore step: the
-- recon-/extraction-sourced data in vendors is never mutated.
--
-- published tracks the subscription: an unpaid save persists as a draft
-- (published = false, the claim -> edit -> pay flow), and the Stripe webhook
-- flips it true when the subscription activates. Draft containment is
-- structural: no anon select below, and every public read path goes through
-- the definer functions in 0044, which require published = true.
--
-- pricing is repeatable rows [{label, price, unit}]; photos is
-- [{storage_path, thumb_path}] following the recon_media convention;
-- filter_overrides has the same shape as vendors.filters.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file -
-- the Supabase SQL editor mis-lexes them and splits statements. See the
-- Migrations section of CLAUDE.md.
--
-- Not auto-applied to the hosted DB - hand-apply in the Supabase SQL editor.

create table if not exists vendor_listings (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  intro text check (intro is null or char_length(intro) <= 600),
  cta_label text check (
    cta_label is null
    or cta_label in ('Book a tour', 'Check availability', 'Contact us', 'Get a quote')
  ),
  cta_url text check (cta_url is null or cta_url like 'https://%'),
  website text,
  instagram text,
  pricing jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  filter_overrides jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table vendor_listings enable row level security;

-- Only the holder of the approved claim on THIS vendor may read or write its
-- listing. The predicate is fully qualified (vendor_listings.vendor_id) and
-- identical in USING and WITH CHECK. Public (anon) select is deliberately NOT
-- granted: public reads go through the perks-gated definer functions (0044),
-- and an anon select policy would leak unpublished drafts.
drop policy if exists "claimants read own listing" on vendor_listings;
create policy "claimants read own listing" on vendor_listings
  for select to authenticated
  using (
    exists (
      select 1 from vendor_claims c
      where c.vendor_id = vendor_listings.vendor_id
        and c.user_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

drop policy if exists "claimants insert own listing" on vendor_listings;
create policy "claimants insert own listing" on vendor_listings
  for insert to authenticated
  with check (
    exists (
      select 1 from vendor_claims c
      where c.vendor_id = vendor_listings.vendor_id
        and c.user_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

drop policy if exists "claimants update own listing" on vendor_listings;
create policy "claimants update own listing" on vendor_listings
  for update to authenticated
  using (
    exists (
      select 1 from vendor_claims c
      where c.vendor_id = vendor_listings.vendor_id
        and c.user_id = (select auth.uid())
        and c.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from vendor_claims c
      where c.vendor_id = vendor_listings.vendor_id
        and c.user_id = (select auth.uid())
        and c.status = 'approved'
    )
  );
