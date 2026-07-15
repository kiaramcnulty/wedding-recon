-- Repair a comma-split bot recon entry (2026-07 enrich batch, worker-written
-- CSV era): "Starting at $3,400" was torn at the comma, leaving
-- price_text = 'Starting at $3', price_details = '400', and the price shape
-- duplicated into notes. Run by hand in the Supabase SQL editor.
-- Safe to run multiple times: the WHERE only matches the corrupted values.

update recon_entries e
set price_text    = 'Starting at $3,400',
    price_details = 'Her own site doesn''t post pricing. The $3,400 starting figure comes from a listing elsewhere, with no hours or tier breakdown to confirm what it includes.',
    notes         = 'Style reads as classic with a fun, personable approach, natural-looking poses rather than stiff posed shots. Based in Littleton.'
from vendors v, profiles p
where e.vendor_id = v.id
  and e.author_id = p.id
  and v.name ilike 'Katie Blondin%'
  and p.username = 'bouldergirl'
  and e.price_text = 'Starting at $3';

-- Sweep for any other rows with the same tear (price_text ends mid-number,
-- price_details starts with the orphaned thousands digits). Expect zero rows;
-- review any hits by hand before editing.
select v.name, p.username, e.id, e.price_text, left(e.price_details, 40) as price_details
from recon_entries e
join vendors v on v.id = e.vendor_id
join profiles p on p.id = e.author_id
where p.is_bot
  and e.price_text ~ '\$\d{1,3}$'
  and e.price_details ~ '^\d{3}([^0-9]|$)';
