-- Reclassify existing `music` vendors into `dj` / `band` ("Live music").
--
-- RUN AFTER 0019 — the `dj` and `band` enum values must already be committed
-- (Postgres forbids adding an enum value and using it in the same transaction),
-- so run 0019 on its own first, then run this file.
--
-- Idempotent: every statement is scoped to rows still typed `music`, so once
-- this has run (no `music` rows remain) re-running is a no-op. Rows a later
-- launch/enrich run inserts directly as `dj`/`band` are never touched.
--
-- Heuristic (best-effort — pair with the REVIEW block at the bottom):
--   * `band` = "Live music" is the broad DEFAULT (bands, quartets, soloists,
--     pianists, ceremony ensembles). Anything not clearly DJ-led lands here.
--   * A row is promoted to `dj` only when its NAME shows a DJ signal AND carries
--     no live-instrument/band word — keeping the DJ carve-out high-precision.
-- Names alone can't settle every case (agencies that do both, bare "…
-- Entertainment"); the review query surfaces the ambiguous ones to fix by hand,
-- consulting the vendor's recon notes / website where the name isn't enough.

-- 1) Promote the clear + likely DJs.
update vendors
set vendor_type = 'dj'::vendor_type
where vendor_type = 'music'
  and (
        -- explicit DJ naming
        name ~* '\y(dj|djs|disc jockey|disc jockeys)\y'
        or (
             -- DJ-leaning company words, but only when nothing live-instrument
             -- is in the name (so "… Sound" flips to dj, "Strings & Sound" stays band)
             name ~* '\y(sound|sounds|productions?|entertainment|mobile|spins?|mixe?s?)\y'
             and name !~* '\y(band|bands|quartet|quartets|trio|trios|duo|duos|ensemble|ensembles|orchestra|orchestras|strings?|choir|acoustic|jazz|mariachi|bluegrass|pian(o|os|ist|ists)|guitar|guitars|violin|violins|cello|cellos|harp|harpist|harpists|sax|saxophone|vocal|vocals|vocalist|singer|singers|symphony|a cappella)\y'
           )
      );

-- 2) Everything still `music` is Live music.
update vendors
set vendor_type = 'band'::vendor_type
where vendor_type = 'music';

-- ============================================================================
-- REVIEW (run separately in the SQL editor — read-only; not part of the change)
-- ============================================================================
-- 1) Confirm every auto-tagged DJ is really a DJ (not a band the name fooled us on):
--
--   select id, name, city, region from vendors
--   where vendor_type = 'dj' order by region, name;
--
-- 2) Live-music rows whose NAME still hints DJ — hybrids the heuristic kept as
--    band. Promote any that are actually DJ-led:
--
--   select id, name, city, region from vendors
--   where vendor_type = 'band'
--     and name ~* '\y(dj|djs|disc jockey|sound|productions?|entertainment|mobile|spins?)\y'
--   order by region, name;
--
--   -- to fix one:  update vendors set vendor_type = 'dj' where id = '<uuid>';
--   -- (or the reverse, set vendor_type = 'band', for a mis-promoted DJ)
