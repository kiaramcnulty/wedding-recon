-- Enforce case-insensitive uniqueness on profile usernames.
-- Without this, "spainlove26" and "SpainLove26" are treated as different
-- usernames by the plain UNIQUE constraint on profiles.username. A functional
-- unique index on lower(username) closes that gap. Display case is preserved —
-- only uniqueness is case-folded. The existing UNIQUE(username) constraint is
-- left in place (it is now redundant but harmless).
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));
