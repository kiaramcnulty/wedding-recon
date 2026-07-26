-- Add the `hotel` vendor type — hotels that hold a WEDDING ROOM BLOCK for guests.
-- App label "Hotel blocks" (Hotel icon, navy) — see lib/constants/categories.ts.
--
-- SCOPE, and the rule that settles the overlap (Kiara, 2026-07): this type is about GUEST
-- LODGING, not event space. **A venue supersedes a hotel** — a property with a ballroom,
-- ceremony site, or reception space is a `venue`, even when it also blocks rooms. `hotel`
-- is for stay-only properties whose wedding-relevant offering is the room block itself.
-- That rule is already enforced mechanically at seed time: `upload.mjs` dedups
-- google_place_id GLOBALLY across vendor types, so a property already seeded as a `venue`
-- is skipped rather than re-inserted as a `hotel`.
--
-- ORDER OF OPERATIONS: `alter type ... add value` cannot be followed by a statement that
-- USES the new value inside the same transaction. This file only ADDS the value, so it is
-- safe to run on its own; if a later migration writes `'hotel'` rows, run this one first
-- as a separate execution in the Supabase SQL editor.
--
-- `add value if not exists` makes this idempotent — re-running is a no-op.

alter type vendor_type add value if not exists 'hotel';
