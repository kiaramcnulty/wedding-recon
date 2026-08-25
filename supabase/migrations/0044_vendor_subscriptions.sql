-- 0044_vendor_subscriptions.sql
-- Vendor Verification, part 3 of 4: subscription state + the perks predicate.
--
-- vendor_subscriptions mirrors Stripe and is written ONLY by the Stripe webhook
-- route on the service role. RLS is enabled with NO policies, which is
-- deny-all for every client role - correct, because nothing client-side reads
-- it directly (the portal reads it through a server component, and public
-- surfaces read the derived verified flag through the functions below).
--
-- The perks rule lives in EXACTLY ONE place: verified_vendor_ids(). It is
-- SECURITY DEFINER because it reads vendor_subscriptions (deny-all) and the
-- claim-scoped vendor_listings - a plain function runs under caller RLS and
-- would return an empty set for every anon reader, silently un-verifying the
-- whole map. Mirrors is_site_admin() from 0041. Every definer function pins
-- search_path (a definer function with a mutable search path is a privilege
-- escalation foothold, and the Supabase linter flags it); the non-definer
-- scalar wrapper does not need the pin but carries it for uniformity.
--
-- verified_vendor_ids returns table (vendor_id uuid) rather than setof uuid:
-- functionally identical in SQL joins, but PostgREST serializes it as
-- [{vendor_id: ...}] which is an unambiguous shape for the supabase-js rpc()
-- call the preview fetch makes. The plan doc sketched setof uuid; this is the
-- as-built refinement, noted there too.
--
-- Only published listings are ever returned by verified_listing_overrides, and
-- published rows are public by definition, so nothing here can leak a draft.
--
-- Grace period: Stripe keeps a subscription active until an invoice actually
-- fails; past_due here means perks off. That is intended - no custom grace
-- logic on our side.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file -
-- the Supabase SQL editor mis-lexes them and splits statements. Apostrophes in
-- BALANCED string literals inside the bodies are fine. See the Migrations
-- section of CLAUDE.md.
--
-- Not auto-applied to the hosted DB - hand-apply in the Supabase SQL editor.
-- Until applied: the functions do not exist, callers treat the RPC error as
-- nobody verified, and the app behaves exactly as it does today.

create table if not exists vendor_subscriptions (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deny-all for clients: RLS on, no policies. Service role bypasses RLS.
alter table vendor_subscriptions enable row level security;

-- The canonical perks rule: the set of vendor ids whose perks are live.
-- claim approved AND subscription active AND listing published.
-- Optional p_ids narrows to a caller-supplied list (the preview fetch);
-- null returns every verified vendor (the bbox left join in 0045).
create or replace function public.verified_vendor_ids(p_ids uuid[] default null)
returns table (vendor_id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select c.vendor_id
  from vendor_claims c
  join vendor_subscriptions s
    on s.vendor_id = c.vendor_id and s.status = 'active'
  join vendor_listings l
    on l.vendor_id = c.vendor_id and l.published = true
  where c.status = 'approved'
    and (p_ids is null or c.vendor_id = any (p_ids));
$fn$;

grant execute on function public.verified_vendor_ids(uuid[])
  to anon, authenticated;

-- The published filter overrides of verified vendors, for the read-time merge
-- in vendor_filters_in_bbox (0045). Reaches the claim-scoped vendor_listings
-- through the same definer boundary; only published listings can come back.
create or replace function public.verified_listing_overrides(p_ids uuid[] default null)
returns table (vendor_id uuid, filter_overrides jsonb)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.vendor_id, l.filter_overrides
  from vendor_listings l
  join verified_vendor_ids(p_ids) vv on vv.vendor_id = l.vendor_id;
$fn$;

grant execute on function public.verified_listing_overrides(uuid[])
  to anon, authenticated;

-- Thin scalar wrapper for single-row callers (the vendor page). Not itself
-- definer; it consumes the definer set above, so the rule stays in one place.
create or replace function public.vendor_is_verified(p_vendor_id uuid)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (
    select 1 from verified_vendor_ids(array[p_vendor_id])
  );
$fn$;

grant execute on function public.vendor_is_verified(uuid)
  to anon, authenticated;
