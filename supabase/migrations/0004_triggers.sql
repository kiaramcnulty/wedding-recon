-- Trust & safety: threshold auto-hide.
-- Once a recon entry accumulates REPORT_THRESHOLD distinct reports, it is flipped
-- to 'flagged' so the public RLS read policy stops serving it, pending review.
-- Nothing is ever hard-deleted; a moderator can restore via status from the
-- Supabase dashboard.

create or replace function handle_new_report()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  report_threshold constant integer := 2;
  report_count integer;
begin
  select count(*) into report_count
  from reports
  where recon_entry_id = new.recon_entry_id;

  if report_count >= report_threshold then
    update recon_entries
    set status = 'flagged'
    where id = new.recon_entry_id and status = 'active';
  end if;

  return new;
end;
$$;

create trigger on_report_created
  after insert on reports
  for each row execute function handle_new_report();
