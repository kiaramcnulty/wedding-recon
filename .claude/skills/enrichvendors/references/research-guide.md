# Per-venue research guide (for draft workers)

Work cheapest-source-first. Every fact needs a source you can name. NEVER invent a
number, a quote, or an event. You are drafting CSV rows in the same pass — research
just enough to write good entries, then stop.

## Read order (per venue)
1. **`research/<slug>/reddit-slice.txt`** (if present) — per-venue Reddit excerpts.
   When written by the thread-digest pass these are complete, attributed comments
   (pronouns and cross-thread references already resolved) — trust them as-is. Richest
   intel per token: real prices ("our venue was 11k for a Sunday"), staff/ownership
   color, complaints, dated comments (comment ages anchor collected-dates). Only if a
   slice is mechanical (raw ±4-line cuts) AND clearly clipped mid-story for YOUR venue
   may you open that one full `reddit-NN.txt` thread — never read threads for venues
   outside your batch.
2. **`research/<slug>/harvest.json`** — vendor_id + up to 5 Google reviews (coordinator
   names, tour impressions, complaints) + site-page list.
3. **`research/pricing-web-*.txt`** (workdir-level) — region pricing digests covering many
   venues at once (wedding-spot/Zola/photographer guides). Check here for pricing BEFORE
   any web search.
4. **`research/<slug>/page-*.txt`** — venue-site pages; pricing usually on `page-pricing`,
   `page-*fees*`, `page-wedding*`. Skip anything that looks like a calendar/API dump.

## Web search — gap-triggered, max 2 per venue, any tier
Searches follow MISSING DATA, not tier. Run up to 2 searches for a venue only if:
(a) its site crawl failed (`site_error` in harvest.json), or (b) no pricing surfaced
from harvest + the pricing digests. If the cheap sources already answered pricing and
capacity, run zero searches even for tier 1. Query: `"<venue name>" <city> wedding cost
pricing`. Photographer guides, wedding-spot.com, Zola, eventective publish real numbers.
**The Knot `/marketplace/` pages TIME OUT — never WebFetch them**; use WebSearch with
`allowed_domains: ["theknot.com"]` or its `/content/` articles. One timeout = skip that
URL, don't retry. If pricing still isn't findable after the gap searches, write the
honest "quote only" entry per entry-rules.md.

## Scratch extract (provenance only — nobody re-reads it in-pipeline)
Write `research/<slug>/extract.md`, **≤400 words, bullets only**, each fact tagged:
`(site:page-X)`, `(google-review)`, `(reddit:reddit-NN.txt ~date)`, `(web:domain)`.
Hedge unknowns explicitly ("catering policy not confirmed"). Then write the CSV rows.

## Reddit paste protocol (orchestrator, Phase 0)
Reddit blocks fetching. The user searches Reddit themselves and pastes threads into
chat. Save every paste VERBATIM to `research/reddit-NN.txt` with a header line
`[subreddit — "title" — posted Xmo ago (~Mon YYYY), captured YYYY-MM-DD]` BEFORE doing
anything else with it, then re-run `roster.mjs --slices`. Raw threads are hard to
re-acquire.

## Region pricing pass (orchestrator, Phase 1, once per region)
~5 fetches that cover pricing for dozens of venues at once: the wedding-spot.com city
page, the Zola city venues page, and 2-3 local photographer "venue guide"/"venue
prices" posts (find via WebSearch `<region> wedding venue prices guide`). Fetch prompt:
"List every wedding venue on this page with any pricing, capacity, or package details
given. One line per venue: name | price info | capacity | notes. No commentary." Save
each digest to `research/pricing-web-<domain>.txt`.
