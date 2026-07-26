-- Add the `beauty` vendor type — wedding-day HAIR & MAKEUP artists, deliberately ONE
-- joint category (Kiara, 2026-07): the large majority of these vendors do both, and an
-- artist who only does hair or only does makeup still belongs in the same bucket rather
-- than a second category couples would have to check twice.
--
-- App label "Hair & makeup" (Sparkles icon, teal) — see lib/constants/categories.ts.
--
-- ORDER OF OPERATIONS: `alter type ... add value` cannot be followed by a statement that
-- USES the new value inside the same transaction. This file only ADDS the value, so it is
-- safe to run on its own; if a later migration writes `'beauty'` rows, run this one first
-- as a separate execution in the Supabase SQL editor.
--
-- `add value if not exists` makes this idempotent — re-running is a no-op.

alter type vendor_type add value if not exists 'beauty';
