-- Postgres-backed fixed-window rate limiter, so limits hold across serverless
-- instances (an in-memory counter doesn't on Vercel). Used by /api/vendor-photo
-- to cap Google Places Photo billing from unauthenticated abuse.
-- Idempotent — safe to re-run. NOT auto-applied: run by hand in the Supabase SQL
-- editor. Until applied, the RPC is absent and lib/rate-limit.ts fails open
-- (requests allowed), so the photo endpoint still works — just unthrottled.
--
-- Stale rows (old window_start) can be pruned by any periodic job; the daily
-- /api/health ping is a convenient hook if the table ever grows large.

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- No policies: RLS on with zero policies blocks anon/authenticated entirely. Only
-- the security-definer function below (and the service role) ever touch this table.
alter table rate_limits enable row level security;

-- Atomic check-and-increment for a fixed window. Returns true when the request
-- is within p_max for the current window, false when it should be throttled.
-- One upsert per call; the window resets in-place once it has elapsed.
create or replace function check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;
