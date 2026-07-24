-- Reclassify music vendors into `dj` / `band` ("Live music") — RECON-FIRST.
--
-- RUN AFTER 0020 — the `dj`/`band` enum values must already be committed (Postgres forbids
-- adding an enum value and using it in the same transaction). Run 0020 on its own, then this.
--
-- Why recon-first: a vendor's NAME is a weak, misleading signal — "West Star Productions"
-- is a live string ensemble, not a DJ. The enrichment recon, by contrast, states the act
-- type outright ("Act: live string musicians", "Act: DJ"). So this classifies from each
-- vendor's active recon text, and only falls back to a CONSERVATIVE name rule for a vendor
-- that has no usable recon signal yet.
--
-- RE-RUNNABLE + SELF-CORRECTING: it scans the whole music family
-- (`vendor_type in ('music','dj','band')`) and writes the recon-derived type, so re-running
-- also FIXES rows an earlier name-based split mislabeled (e.g. a live act tagged `dj`). It
-- only writes rows whose type actually changes, and is deterministic.
--
-- Precedence is biased toward Live music (the broad default): if the recon shows ANY live
-- performer, the vendor is `band` even when it also mentions a DJ — so an agency that does
-- both lands in Live music. Promote such a row to `dj` by hand if you'd rather.

with sig as (
  select v.id, v.name, v.vendor_type,
    lower(coalesce(string_agg(
      coalesce(r.notes, '') || ' ' || coalesce(r.price_details, '') || ' ' || coalesce(r.price_text, ''),
      ' '), '')) as t
  from vendors v
  left join recon_entries r on r.vendor_id = v.id and r.status = 'active'
  where v.vendor_type in ('music', 'dj', 'band')
  group by v.id, v.name, v.vendor_type
),
verdict as (
  select id, name, vendor_type,
    case
      -- 1) Recon signal (best): any live-performer language → Live music.
      when t ~* '\y(live band|live music|live musicians?|live string|string musicians?|string (duo|trio|quartet|band)|quartets?|trios?|duos?|ensembles?|orchestras?|acoustic|bluegrass|mariachi|pian(o|ist)|guitarists?|violinists?|cellists?|harpists?|vocalists?|singers?|choir|symphony|a cappella|bands?|strings?)\y'
        then 'band'
      -- 2) Recon says DJ (and nothing live above) → DJ.
      when t ~* '\y(djs?|disc jockeys?|turntablists?)\y'
        then 'dj'
      -- 3) No recon signal → CONSERVATIVE name rule: an explicit DJ word AND no live word.
      when name ~* '\y(djs?|disc jockeys?)\y'
       and name !~* '\y(bands?|quartets?|trios?|duos?|ensembles?|orchestras?|strings?|choir|acoustic|jazz|mariachi|bluegrass|pian(o|os|ist|ists)|guitars?|violins?|cellos?|harp|harpists?|sax|saxophone|vocals?|vocalist|singers?|symphony|a cappella)\y'
        then 'dj'
      -- 4) Default: Live music.
      else 'band'
    end as target
  from sig
)
update vendors u
set vendor_type = ver.target::vendor_type
from verdict ver
where u.id = ver.id
  and u.vendor_type <> ver.target::vendor_type;

-- ============================================================================
-- REVIEW (run separately in the SQL editor — read-only; not part of the change)
-- ============================================================================
-- A) Skim the whole split with each vendor's recon act-type snippet — the fastest way to
--    catch a wrong call (a `dj` whose recon talks strings, a `band` whose recon says DJ):
--
--   select v.vendor_type, v.name, left(string_agg(r.notes, ' | '), 160) as recon
--   from vendors v
--   left join recon_entries r on r.vendor_id = v.id and r.status = 'active'
--   where v.vendor_type in ('dj', 'band')
--   group by v.id, v.vendor_type, v.name
--   order by v.vendor_type, v.name;
--
-- B) DJ-tagged vendors with NO recon (classified by NAME alone — likeliest to be wrong):
--
--   select v.id, v.name, v.city, v.region
--   from vendors v
--   where v.vendor_type = 'dj'
--     and not exists (select 1 from recon_entries r where r.vendor_id = v.id and r.status = 'active')
--   order by v.name;
--
--   -- fix one:  update vendors set vendor_type = 'band' where id = '<uuid>';   (or 'dj')
