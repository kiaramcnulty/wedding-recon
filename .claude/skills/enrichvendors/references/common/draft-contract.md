# Draft call — /enrichvendors single-turn contract (all vendor types)

You are drafting bot recon entries for the wedding vendors listed below. Everything you need is IN THIS FILE: this contract, the entry rules, the type-specific rules, the bot voices, and one research dossier per vendor. Do NOT read any other file, do NOT search the web, do NOT use any tool except one Write at the end. Never fabricate a price, quote, event, or booking.

## How many rows — read each block's `entries=` header
- Each vendor block assigns `entries=N` (1–3) with a bot and date per entry (`entry1: bot=botX date=M/YYYY | entry2: ...`). Write EXACTLY that many JSON lines for that vendor — one per assigned bot, dated with its assigned date. Override a date only if the dossier contains a clearly better-sourced real date (e.g. a dated reddit comment).
- Multi-entry vendors split by SOURCE CLUSTER, never by padding: entry 1 leads with site/published pricing; entry 2 leads with review/reddit experience color (staff, vibe, what working with them was like, quirks); entry 3 (rare) leads with logistics/booking-process details. Conflicting prices from different sources go in SEPARATE entries — that's a feature (more data points).
- Each entry stands ALONE. Different bots are different couples: clearly different voice and opening, NEVER reference another entry ("as someone else said", "the other listing") or hint the vendor is one of a set. A reader sees separate cards from different people.
- Every entry still carries `price_text` + `price_details`. Non-pricing-cluster entries derive a HEDGED version of the vendor's sourced pricing in their own words ("going off their posted rates it's about $X-$Y", "reviews put it around $X") or an honest "Quote only" — never copy a sibling entry's pricing wording verbatim, and ideally cite a different source than the sibling.
- If the dossier can't support N distinct honest entries, write fewer and append ` SHORT:<slug>` to your reply. Fewer real entries always beats padded ones.
- Write EXACTLY the assigned rows and no more — never an extra row, a test row, or any row containing placeholder text (`PLACEHOLDER`, `REMOVE`, `TODO`); one stray row fails the whole merge.

## Every row
- `recon_type` is always `online`.
- `price_text` + `price_details` REQUIRED (specifics per the entry rules and type rules below). NEVER invent a number, NEVER extrapolate a market rate onto a specific vendor.
- `notes`: ONE line (no embedded newlines; inline "-bullets" allowed), first person, in the assigned bot's voice per the voice cards. NO minimum length — a ~200-char note covering all the real intel is a great entry. Length follows intel; cap ~90 words; never pad or restate. Attribute borrowed experiences ("a bride on reddit said...", "a review mentions..."); never first person for things the bot didn't do. Include warts when sources have them.
- No em/en dashes (– —) anywhere; use hyphens, commas, periods. No banned marketing/AI phrases (list in the entry rules). Vary sentence openings and shapes across rows — no two rows share a long word-run.
- NEVER use research-tooling language: no "crawl", "scrape", "fetch", "parse", "harvest", "dossier", "boilerplate", "garbled text", or descriptions of pages failing to be machine-read. Describe gaps the way a person would: "their site doesn't list pricing", "you have to inquire for rates", "couldn't get their pricing page to load". Bracketed provenance tags in your research block (like [launchintel] or [zola]) name FILES, not sources — in entry text cite the underlying source ("a Knot listing", "a pricing guide", "their site"); the words "digest" and "launchintel" are validator-rejected.
- NEVER reference this project or how the entry was produced: no "batch", "enrich", "seeded", "roster", "dataset", "bot", "pipeline", or any hint that the vendor is one of a set being processed. The note is one couple writing about one vendor — it must read as if nothing else exists.
- `photos`: EMPTY. `sources`: short refs only, e.g. `site /pricing; google reviews; reddit:reddit-04.txt` — no commas inside.
- `service_region`: see the type rules — required for some types, always-null for others (include the key only when the type rules require it).

## Flags (append to your one-line reply, never draft a row for them)
- ` <NOTFLAG>:<slug>` — the exact wrong-type flag named in the type rules (e.g. `NOTAVENUE`, `NOTCATERER`): the dossier shows this vendor is a fundamentally DIFFERENT KIND of business than this run's type (a planner, rental company, caterer, officiant, tour operator, retail shop, day-use attraction). It is NOT for a business that plausibly IS the type but whose dossier lacks type-specific content — a hotel, resort, restaurant, ranch, or golf club with no wedding text is `THIN`, not `<NOTFLAG>` (venues host events even when their reviews are all about skiing). Write NO rows for it. When genuinely unsure, draft the row(s) NORMALLY (real facts, in voice — never meta-commentary like "flagging separately" or placeholder text; validator-rejected) and add the flag; the orchestrator decides.
- ` THIN:<slug>` — essentially nothing beyond name/city (no site text, no reviews, no digest or reddit lines, no google summary), OR a plausible-type business whose dossier has no honest type-relevant fact to write. Write NO rows; an entry must contain at least one real sourced fact.
- ` SHORT:<slug>` — you wrote fewer rows than the block assigned (dossier couldn't honestly support them all).

## Output format (exact) — JSON Lines
Write ONE JSON object per row, one object per line — no wrapping array, no markdown fences, no header line. Every object has ALL of these keys (plus `service_region` when the type rules require it):
`{"venue": "<the VENDOR'S business name — key is named venue for historical reasons>", "vendor_id": "<VERBATIM from the block>", "recon_type": "online", "month": <number>, "year": <number>, "price_text": "...", "price_details": "...", "notes": "...", "photos": "", "sources": "...", "bot": "<VERBATIM botN for THIS entry from the block>"}`
JSON handles all escaping — just emit valid JSON per line. Keep `notes` one logical line (no literal newline characters in the string).

## Finish
Write all the JSON lines to the OUTPUT FILE named at the bottom of this file, in ONE Write call. Then STOP and reply with exactly one line: `<output file>: done` (plus any ` <NOTFLAG>: slug1` / ` THIN: slug1, slug2` / ` SHORT: slug1` flags).

Do NOT read your output file back to check or count it, do NOT re-read this file, do NOT list directories or reach for any other tool. Downstream scripts validate every row for free (coverage, pricing fields, service_region, banned phrases, em-dashes, dedup) — a read-back only re-bills this whole file's tokens for nothing, and a wrong cell is cheaper to fix later than a re-read is now. Write once and stop.
