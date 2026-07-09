# Draft call — /enrichvenues (single-turn contract)

You are drafting bot recon entries for the wedding venues listed below. Everything you need is IN THIS FILE: the rules, the bot voices, and one research dossier per venue. Do NOT read any other file, do NOT search the web, do NOT use any tool except one Write at the end. Never fabricate a price, quote, event, or visit.

## Output contract
- EXACTLY ONE CSV row per venue, authored by that venue's assigned `bot`, dated with its assigned `date` (override the date only if the dossier contains a clearly better-sourced real date, e.g. a dated reddit comment).
- `recon_type` is always `online`.
- `price_text` + `price_details` REQUIRED on every row. Dossier has real figures → an honest, hedged range tied to them (season/day/what's-included in `price_details`). No figures → `price_text` = `Quote only` and `price_details` honestly says what you checked and that they price per event. NEVER invent a number.
- `notes`: ONE line (no embedded newlines), first person, in the assigned bot's voice per the voice cards. **NO minimum length — a ~200-char note covering all the real intel is a great entry. Length follows intel; cap ~90 words; never pad or restate.** Cut filler words; keep concrete facts: capacity, inclusions, catering policy, a review specific, logistics quirks. Attribute borrowed experiences ("a review mentions...", "a bride on reddit said..."); never first person for things the bot didn't do. Include warts when sources have them.
- No em/en dashes (– —) anywhere; use hyphens, commas, periods. No banned marketing/AI phrases (list in the entry rules below). Vary sentence openings and shapes across rows — no two rows share a long word-run.
- NEVER use research-tooling language: no "crawl", "scrape", "fetch", "parse", "harvest", "dossier", "boilerplate", "garbled text", or descriptions of pages failing to be machine-read. Describe gaps the way a person would: "their site doesn't list pricing", "couldn't get their pricing page to load", "they only have a PDF menu and I didn't dig in".
- NEVER reference this project or how the entry was produced: no "batch"/"from this batch", "enrich"/"enrichment", "seeded", "roster", "dataset", "bot", "pipeline", or any hint that the venue is one of a set being processed. The note is one couple writing about one venue — it must read as if nothing else exists.
- `photos`: EMPTY. `sources`: short refs only, e.g. `site /pricing; google reviews; digest:weddingspot-denver` — no commas inside.
- If a dossier is unusually rich (real pricing table AND strong firsthand commentary), still write ONE row, but append ` RICH:<slug>` to that venue's line in your reply so a second entry can be commissioned separately.
- If a venue is actually a SERVICE vendor with no space of its own (caterer, photographer, DJ, florist, planner, officiant, stationery shop — see the entry rules), do NOT write a row for it; append ` NOTAVENUE:<slug>` to your reply instead.

## CSV format (exact)
Header once: `venue,vendor_id,recon_type,month,year,price_text,price_details,notes,photos,sources,bot`
Copy `vendor_id` and `bot` VERBATIM from each venue block. Wrap any field containing a comma or quote in double quotes; double internal quotes; never a raw newline inside a field.

## Finish
Write the complete CSV (header + all rows) to the OUTPUT FILE named at the bottom of this file, in ONE Write call. Then STOP and reply with exactly one line: `<output file>: done` (plus ` RICH: slug1, slug2` and/or ` NOTAVENUE: slug1, slug2` if any).

Do NOT read your CSV back to check or count it, do NOT re-read this file, do NOT list directories or reach for any other tool. Downstream scripts validate every row for free (coverage, pricing fields, banned phrases, em-dashes, dedup) — a read-back only re-bills this whole file's tokens for nothing, and a wrong cell is cheaper to fix later than a re-read is now. Write once and stop.
