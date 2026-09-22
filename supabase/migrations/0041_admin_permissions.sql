-- 0041_admin_permissions.sql
-- Site admin accounts, and their first capability: editing bot-authored recon.
--
-- The model is deliberately small, with room to grow:
--   1. profiles.is_admin -- one boolean, mirroring is_bot (0012). A future admin
--      power gates on this same flag. Only when the roster of powers outgrows a
--      single boolean does this become a roles table, and not before.
--   2. is_site_admin() -- a STABLE SECURITY DEFINER helper answering "is the
--      current auth user an admin". SECURITY DEFINER so it reads profiles
--      regardless of caller RLS; STABLE so Postgres caches it per statement.
--      Wrapping auth.uid() in a scalar subselect is the Supabase initplan
--      optimization. Named is_site_admin, not is_admin, so it never reads as the
--      column of the same name inside a policy expression.
--   3. An additive UPDATE policy on recon_entries, SEPARATE from the author
--      policy: authorship and admin are two capabilities, and permissive
--      policies OR together, so the author path is untouched. Scoped to
--      bot-authored rows only -- an admin never edits a real persons words, the
--      same line 0036 and 0040 draw by gating on is_bot.
--
-- It also grants the launch owner account admin, by email lookup in auth.users
-- (profiles carries no email). Idempotent and safe to re-run; a no-op if that
-- account has not signed up yet, in which case set the flag by hand later.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file --
-- the Supabase SQL editor mis-lexes them and splits the function body. See the
-- Migrations section of CLAUDE.md.
--
-- Not auto-applied to the hosted DB -- hand-apply in the Supabase SQL editor.
-- Until applied: no account is admin, the new policy does not exist, and recon
-- editing stays author-only exactly as it is today.

-- 1. The flag ----------------------------------------------------------------
alter table profiles
  add column if not exists is_admin boolean not null default false;

-- 2. The helper --------------------------------------------------------------
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_admin
  );
$$;

grant execute on function public.is_site_admin() to authenticated;

-- 3. The capability: admins may update bot-authored recon --------------------
-- Additive to "authors update own recon" (0002). Bot-scoped in both USING (the
-- row targeted) and WITH CHECK (the row after the write, whose author_id an edit
-- never changes), so this policy can only ever reach a bot-authored row.
drop policy if exists "admins update bot recon" on recon_entries;
create policy "admins update bot recon" on recon_entries
  for update
  using (
    public.is_site_admin()
    and exists (
      select 1 from public.profiles a
      where a.id = recon_entries.author_id and a.is_bot
    )
  )
  with check (
    public.is_site_admin()
    and exists (
      select 1 from public.profiles a
      where a.id = recon_entries.author_id and a.is_bot
    )
  );

-- 4. Seed the owner account as admin -----------------------------------------
-- Case-insensitive email match; the is-distinct guard makes a re-run UPDATE 0.
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('kiaramcnulty@gmail.com')
  and p.is_admin is distinct from true;
