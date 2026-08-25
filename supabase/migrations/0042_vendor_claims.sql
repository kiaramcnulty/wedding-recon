-- 0042_vendor_claims.sql
-- Vendor Verification, part 1 of 4: business claims.
--
-- A vendor user claims their business by inserting a row here. Claims are
-- AUTO-APPROVED (status defaults to approved) - Kiara reviews retroactively
-- via the claim-report email and the admin page, and revocation is a
-- service-role write from the admin page, never a client one.
--
-- One live claim per vendor, enforced by a partial unique index that excludes
-- revoked rows, so revoking a bad claim frees the vendor for the real owner.
--
-- email_domain_matches_website is computed AT CLAIM TIME by the app (auth email
-- domain vs the hostname of vendors.website) and stored for the retroactive
-- review - a strong it-is-really-them signal when true.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file -
-- the Supabase SQL editor mis-lexes them and splits statements. See the
-- Migrations section of CLAUDE.md.
--
-- Not auto-applied to the hosted DB - hand-apply in the Supabase SQL editor.
-- Until applied: nothing breaks, the portal claim flow just errors on insert.

create table if not exists vendor_claims (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'approved'
    check (status in ('approved', 'revoked')),
  claimant_role text,
  contact_email text not null,
  email_domain_matches_website boolean,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- One live claim per vendor; a revoked claim frees the vendor again.
create unique index if not exists idx_vendor_claims_one_live
  on vendor_claims (vendor_id) where (status = 'approved');

create index if not exists idx_vendor_claims_user
  on vendor_claims (user_id);

alter table vendor_claims enable row level security;

-- Authenticated users may claim for THEMSELVES only, and read their own claims.
-- No update or delete policies: status changes (revocation) go through the
-- service role from the admin page.
drop policy if exists "users insert own claims" on vendor_claims;
create policy "users insert own claims" on vendor_claims
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users read own claims" on vendor_claims;
create policy "users read own claims" on vendor_claims
  for select to authenticated
  using (user_id = (select auth.uid()));
