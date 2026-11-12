-- 0052_vendor_slugs.sql
-- Readable vendor URLs: /vendor/dj-blnce instead of /vendor/<uuid>.
--
-- Every vendor gets a slug, made from its name once and then kept. The slug
-- is generated in the database (a before-insert trigger), so every writer
-- gets one without knowing about it: the Add Recon form, the vendor portal
-- claim form, and the launch pipeline upload.
--
-- Rules, in order:
--   1. The name, lowercased, accents folded, an ampersand read as and,
--      apostrophes dropped, every other run of non-alphanumerics a single
--      hyphen, capped at 80 characters. Example: Cafe & Bar -> cafe-and-bar.
--   2. Taken already: append the city (hampton-inn-boulder), unless the name
--      already ends in it.
--   3. Still taken, or no city: append -2, -3, and so on.
-- The backfill below walks vendors oldest first, so the longest-standing row
-- keeps the bare name.
--
-- STABLE ON PURPOSE. A name edit does NOT change the slug: shared links and
-- search-engine entries keep working. The trigger fires on insert only, and it
-- overwrites any slug a client sends, so nobody can claim a slug through the
-- public insert policy. An admin can still set one by hand with the service
-- role; the check constraint keeps it URL-shaped. The old uuid URLs keep
-- working too: the vendor page redirects /vendor/<uuid> to /vendor/<slug>.
--
-- Two concurrent inserts of the same new name can race to the same slug; the
-- unique index makes the second insert fail rather than duplicate, which is
-- the right failure for a case this rare.
--
-- APPLY BEFORE DEPLOYING the app change that reads vendors.slug: the preview
-- cards select the column by name, and PostgREST rejects a select of a column
-- that does not exist.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file.
-- Not auto-applied - hand-apply in the Supabase SQL editor. Idempotent.

alter table vendors add column if not exists slug text;

-- The name part of a slug. Pure text work, no table reads.
create or replace function public.slugify_vendor_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select coalesce(
    nullif(
      trim(both '-' from
        left(
          trim(both '-' from
            regexp_replace(
              regexp_replace(
                replace(
                  translate(
                    lower(coalesce(p_name, '')),
                    'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūñçýÿ',
                    'aaaaaaaeeeeeiiiiiooooooouuuuuncyy'
                  ),
                  '&', ' and '
                ),
                '[''’]', '', 'g'
              ),
              '[^a-z0-9]+', '-', 'g'
            )
          ),
          80
        )
      ),
      ''
    ),
    'vendor'
  )
$fn$;

-- A free slug for a vendor: the name, then name-city, then a counter.
-- p_id is the row being slugged, so it never collides with itself.
create or replace function public.unique_vendor_slug(
  p_name text,
  p_city text,
  p_id uuid
)
returns text
language plpgsql
stable
set search_path = public
as $fn$
declare
  base text := slugify_vendor_name(p_name);
  city_part text := case
    when nullif(trim(coalesce(p_city, '')), '') is null then null
    else slugify_vendor_name(p_city)
  end;
  candidate text;
  n integer := 2;
begin
  -- A slug shaped like a uuid would be unreachable: the vendor page reads a
  -- uuid-shaped path segment as an id. No real name produces one, but the
  -- guard is one line.
  if base ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    base := 'vendor-' || base;
  end if;

  candidate := base;
  if not exists (select 1 from vendors where slug = candidate and id is distinct from p_id) then
    return candidate;
  end if;

  if city_part is not null and base <> city_part and base not like '%-' || city_part then
    base := base || '-' || city_part;
    candidate := base;
    if not exists (select 1 from vendors where slug = candidate and id is distinct from p_id) then
      return candidate;
    end if;
  end if;

  loop
    candidate := base || '-' || n;
    exit when not exists (select 1 from vendors where slug = candidate and id is distinct from p_id);
    n := n + 1;
  end loop;
  return candidate;
end
$fn$;

create or replace function public.set_vendor_slug()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.slug := unique_vendor_slug(new.name, new.city, new.id);
  return new;
end
$fn$;

drop trigger if exists vendors_set_slug on vendors;
create trigger vendors_set_slug
  before insert on vendors
  for each row execute function public.set_vendor_slug();

-- Backfill, oldest first. One row at a time so each pick sees the ones before.
do $fn$
declare
  r record;
begin
  for r in
    select id, name, city from vendors where slug is null order by created_at, id
  loop
    update vendors
      set slug = unique_vendor_slug(r.name, r.city, r.id)
      where id = r.id;
  end loop;
end
$fn$;

alter table vendors alter column slug set not null;

create unique index if not exists vendors_slug_key on vendors (slug);

alter table vendors drop constraint if exists vendors_slug_format;
alter table vendors add constraint vendors_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 200);
