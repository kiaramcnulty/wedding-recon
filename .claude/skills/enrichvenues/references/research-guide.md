# Per-venue research guide

Work from cheapest source to most expensive. Every fact needs a source you can name.
NEVER invent a number, a quote, or an event.

## 1. Archived Reddit threads (read FIRST — richest intel per token)
- Location: `<workdir>/research/reddit-*.txt` AND `data/launchvenues/<slug>/research/reddit-*.txt`.
- These contain real prices ("our venue was 11k for a Sunday"), staff/ownership color,
  complaints, and comparisons between venues — exactly what recon entries need. Index on them.
- Reddit BLOCKS fetching (crawler and browser). To get new threads, ask the user to search
  (`site:reddit.com <region> wedding venue`, plus venue-specific queries) and paste each
  thread into chat. Save every paste VERBATIM to `research/reddit-NN.txt` with a header line
  `[subreddit — "title" — posted Xmo ago (~Mon YYYY), captured YYYY-MM-DD]` BEFORE doing
  anything else with the content. Raw threads are hard to re-acquire.
- Comment ages anchor collected-dates (see entry-rules.md).

## 2. Harvest output (already on disk after Phase 1)
- `research/<slug>/harvest.json` → `google.reviews` (up to 5 real Google reviews: coordinator
  names, tour impressions, complaints — prime firsthand commentary), rating, vendor_id.
- `research/<slug>/page-*.txt` → stripped venue-site pages. Pricing tables often live on
  `page-pricing`, `page-*fees*`, `page-wedding*`. Read selectively; skip `wp-json` calendar dumps.

## 3. Web search (only for venues still missing pricing/capacity)
- Query pattern: `"<venue name>" <city> wedding cost pricing` — photographer planning guides
  (e.g. "<venue> wedding venue guide"), wedding-spot.com, Zola, eventective, and local blogs
  publish real numbers.
- **The Knot**: `/marketplace/` pages reliably TIME OUT — never WebFetch them. Use WebSearch
  with `allowed_domains: ["theknot.com"]` or fetch its `/content/` articles instead.
- A WebFetch timeout is page-specific: skip that URL and move on; don't conclude the domain
  is blocked, and don't retry more than once.

## 4. Per-venue extraction record
For each venue, accumulate findings (a JSON or MD scratch file per venue in `research/<slug>/`)
with a source tag per fact:
```
{ "pricing": [{"fact": "...", "source": "mossdenver.com/pricing"}],
  "capacity": [...], "included_required": [...], "ownership_staff": [...],
  "firsthand": [{"fact": "...", "source": "reddit:reddit-02.txt", "when": "2026-03"}],
  "vibe": [...], "flags": [...] }
```
Subagents doing research batches must return these files, not prose summaries.
