-- verified-rls-check.sql
-- The one thing scripts/test-verified-sql.mjs CANNOT prove: that the perks
-- predicate works THROUGH the SECURITY DEFINER boundary under the anon role.
-- pglite has no anon/authenticated roles, so definer has no effect there; this
-- has to run on a real Supabase (local `supabase` CLI stack, or the hosted SQL
-- editor).
--
-- It is SAFE TO RUN ON PROD: everything happens inside one transaction that
-- ROLLS BACK at the end, so no fixture row and no role change persists. Run the
-- whole file at once. The final SELECT returns one row per check with a
-- passed boolean; every row must read true.
--
-- Prerequisites: migrations 0042-0045 applied.
--
-- No apostrophes in comments; no dollar-quoted bodies anywhere in this file
-- (deliberately: the Supabase editor lexer mis-handles apostrophes inside a
-- dollar-quoted DO block, so the checks are plain VALUES rows instead). String
-- literals use doubled apostrophes where needed; none contain a backslash.

begin;

-- Fixture ids well outside any real uuid pattern, so a failed rollback leaves
-- something trivially identifiable. A fully-verified vendor and a draft one.
insert into vendors (id, name, vendor_type, source)
values
  ('ffffffff-0000-0000-0000-00000000aaaa', 'RLS check verified', 'venue', 'google'),
  ('ffffffff-0000-0000-0000-00000000bbbb', 'RLS check draft', 'venue', 'google');

insert into vendor_claims (vendor_id, user_id, status, contact_email)
values
  ('ffffffff-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-000000000000', 'approved', 'x@example.com'),
  ('ffffffff-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-000000000000', 'approved', 'x@example.com');

insert into vendor_subscriptions (vendor_id, stripe_customer_id, status)
values
  ('ffffffff-0000-0000-0000-00000000aaaa', 'cus_rlscheck', 'active'),
  ('ffffffff-0000-0000-0000-00000000bbbb', 'cus_rlscheck', 'active');

insert into vendor_listings (vendor_id, published)
values
  ('ffffffff-0000-0000-0000-00000000aaaa', true),
  ('ffffffff-0000-0000-0000-00000000bbbb', false);  -- draft: NOT published

-- Switch to the anonymous public role — the way a logged-out couple reads the
-- map. RLS is now enforced; the definer functions must still see past it.
set local role anon;

-- One row per check. Every passed value must be true.
--   1. THE silent-failure guard: the definer predicate returns the verified
--      vendor even though anon cannot read vendor_subscriptions. Without
--      SECURITY DEFINER this count is 0 and the whole map un-verifies.
--   2. The draft (unpublished) vendor is not verified for anon.
--   3. anon cannot read vendor_subscriptions directly (deny-all RLS) - which is
--      what makes the definer boundary necessary in the first place.
--   4/5. The scalar wrapper agrees under anon.
select *
from (
  values
    ('1. anon sees verified vendor via definer boundary',
      (select count(*) from verified_vendor_ids(array['ffffffff-0000-0000-0000-00000000aaaa'::uuid])) = 1),
    ('2. anon does not see draft vendor as verified',
      (select count(*) from verified_vendor_ids(array['ffffffff-0000-0000-0000-00000000bbbb'::uuid])) = 0),
    ('3. anon cannot read vendor_subscriptions directly',
      (select count(*) from vendor_subscriptions) = 0),
    ('4. scalar vendor_is_verified true for verified vendor',
      vendor_is_verified('ffffffff-0000-0000-0000-00000000aaaa')),
    ('5. scalar vendor_is_verified false for draft vendor',
      not vendor_is_verified('ffffffff-0000-0000-0000-00000000bbbb'))
) as t(check_name, passed)
order by check_name;

reset role;

-- Nothing persists.
rollback;
