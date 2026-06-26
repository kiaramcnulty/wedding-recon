-- Add recon_collected_at to track when the recon was collected (month/year granularity).
-- Idempotent: safe to re-run if a prior attempt partially applied (e.g. columns
-- added but constraints not). Postgres has no "add constraint if not exists", so
-- drop-then-add each constraint.
alter table recon_entries add column if not exists recon_collected_month integer;
alter table recon_entries add column if not exists recon_collected_year integer;

-- Constraints: month should be 1-12, year should be >= 2000.
alter table recon_entries drop constraint if exists recon_collected_month_check;
alter table recon_entries add constraint recon_collected_month_check check (recon_collected_month is null or (recon_collected_month >= 1 and recon_collected_month <= 12));
alter table recon_entries drop constraint if exists recon_collected_year_check;
alter table recon_entries add constraint recon_collected_year_check check (recon_collected_year is null or recon_collected_year >= 2000);
