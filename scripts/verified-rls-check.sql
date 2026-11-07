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
-- Prerequisites: migrations 0042-0045 applied (checks 6 and 7 also need 0050).
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

-- user_id references auth.users, so a made-up uuid fails the foreign key
-- (23503). Borrow any existing account: the claim is a fixture row inside this
-- transaction and is rolled back with everything else, and the one-live-claim
-- index is per VENDOR, so it cannot collide with a real claim.
insert into vendor_claims (vendor_id, user_id, status, contact_email)
select x.vendor_id, (select id from auth.users order by created_at limit 1), 'approved', 'x@example.com'
from (values
  ('ffffffff-0000-0000-0000-00000000aaaa'::uuid),
  ('ffffffff-0000-0000-0000-00000000bbbb'::uuid)
) as x(vendor_id);

insert into vendor_subscriptions (vendor_id, stripe_customer_id, status)
values
  ('ffffffff-0000-0000-0000-00000000aaaa', 'cus_rlscheck', 'active'),
  ('ffffffff-0000-0000-0000-00000000bbbb', 'cus_rlscheck', 'active');

insert into vendor_listings (vendor_id, published, photos)
values
  ('ffffffff-0000-0000-0000-00000000aaaa', true,
    '[{"storage_path":"rls/full.jpg","thumb_path":"rls/thumb.jpg"}]'::jsonb),
  ('ffffffff-0000-0000-0000-00000000bbbb', false,  -- draft: NOT published
    '[{"storage_path":"rls/full.jpg","thumb_path":"rls/thumb.jpg"}]'::jsonb);

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
--   6/7. The 0050 photo set sees the verified listing photos through the
--      definer boundary (anon cannot read vendor_listings), and never the
--      photos of a draft listing.
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
      not vendor_is_verified('ffffffff-0000-0000-0000-00000000bbbb')),
    ('6. anon sees verified listing photos via definer boundary',
      (select count(*) from verified_listing_photo_ids(array['ffffffff-0000-0000-0000-00000000aaaa'::uuid])) = 1),
    ('7. anon does not see draft listing photos',
      (select count(*) from verified_listing_photo_ids(array['ffffffff-0000-0000-0000-00000000bbbb'::uuid])) = 0)
) as t(check_name, passed)
order by check_name;

reset role;

-- Nothing persists.
rollback;
