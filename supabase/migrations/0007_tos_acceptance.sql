-- Track when users accept the Terms of Service
alter table profiles
add column tos_accepted_at timestamptz;
