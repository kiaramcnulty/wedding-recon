-- First-touch marketing attribution, stamped onto the account at signup.
--
-- The browser records where a visitor first came from (utm_* params or an
-- external referrer host) in a first-party cookie; setUsername reads that cookie
-- and writes these columns on the new profile. That makes the whole pilot funnel
-- (source -> account -> recon) answerable directly off Supabase, and therefore
-- in Hex, with no PostHog export step and no exposure to ad-blockers.
--
-- All columns are nullable: a direct or organic visit has no source, which reads
-- correctly as null. Stamped once per account (setUsername uses coalesce, so a
-- later username edit never overwrites the original touch). Referrer is stored
-- as HOST only, never a full URL, to keep stray query-string PII out of the DB.
--
-- Hand-apply in the Supabase SQL editor (migrations are not auto-applied).
-- Idempotent: re-running is a no-op.

alter table profiles add column if not exists utm_source text;
alter table profiles add column if not exists utm_medium text;
alter table profiles add column if not exists utm_campaign text;
alter table profiles add column if not exists referrer_host text;
alter table profiles add column if not exists landing_path text;

-- When the first-touch record was stamped. Distinct from created_at, which the
-- new-user trigger sets at first OTP verify, before onboarding.
alter table profiles add column if not exists attributed_at timestamptz;

-- Group signups by channel without scanning: partial index over the rows that
-- actually carry a source.
create index if not exists idx_profiles_utm_source
  on profiles (utm_source)
  where utm_source is not null;
