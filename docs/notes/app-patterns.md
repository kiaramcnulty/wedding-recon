# React, UI, Supabase and form patterns (plus the gotchas)

Cross-cutting patterns that are not about one feature: portals and SSR, the mobile frame, Supabase idioms, form handling, and the bugs that cost real time.

Moved out of `CLAUDE.md` (2026-09-12) to keep the always-loaded file small. Content is unchanged -- these are the as-built notes, so prefer them over re-deriving a rule from the code.

### React + SSR patterns
- **Portal rendering requires mounted state guard:** use `useEffect` with `setTimeout(..., 0)` to defer `setMounted(true)` (satisfies `react-hooks/set-state-in-effect` lint rule and ensures DOM exists).
  ```tsx
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  ```
- **Portals escape containing block constraints:** `createPortal(el, document.body)` escapes `position: fixed` being relative to an ancestor with `backdrop-filter` or `transform`. Use for modals, drawers, popovers that need viewport-level positioning.
- **Server Actions + file uploads:** don't route image bytes through a Server Action — Next caps the action body at 1 MB, Vercel at ~4.5 MB. Compress + upload client-side directly to Supabase Storage and pass only the storage paths to the action (small structured data can ride along as a serialized arg). See **Recon photo uploads** below.

### UI layout & constraints
- Mobile frame: `max-w-[480px]` centered, tight padding, bottom nav always visible.
- Wider content (hub, vendor page): `max-w-[760px]` for better use of desktop space while staying readable.
- Bottom nav items: grid layout centered via `mx-auto` with the `max-w-[520px]` constraint (matches mobile frame + padding).
- Headers with profile menu: use `ProfileMenu className="ml-auto shrink-0"` to right-align; it auto-portals internally.
- **A `flex-1` item holding nowrap text needs `min-w-0`, and `truncate` is not a substitute.** A flex item's default `min-width: auto` floors it at its **min-content** width, so one `whitespace-nowrap` string inside (which is what `truncate` sets) becomes a width the item cannot shrink past — it overflows its row instead. The truncate classes only clip once the width is already definite; they cannot create the constraint. This is what pushed the Explore profile icon off-screen: the search box is `flex-1`, and its suggestion dropdown carries Nominatim area strings like "Denver, Denver County, Colorado, 80202, United States", so the box sat at 398px inside a 390px viewport (fixed 2026-08-06). **It only misbehaves when the long content is present** — the resting search bar looked perfect, so check the populated state, not the empty one.

### Supabase patterns
- **Idempotent upserts:** `upsert(..., { onConflict: "col1,col2" })` for operations that might repeat (e.g., save vendor to hub).
- **Case-insensitive uniqueness:** use a functional unique index `CREATE UNIQUE INDEX idx_name ON table (LOWER(col))` instead of relying on app-level normalization.
- **Vendor dedup:** 
  - Google Places path: upsert by `google_place_id` (guaranteed unique from Google).
  - Manual/user path: soft-dedup by `ilike("name", name)` + `ilike("city", city)` to catch duplicates, then insert if not found.
  - Pre-resolved vendor: lock the vendor type since it's canonical data; don't allow user to override.
- **RLS for public pages:** enable public read on `vendors`, `profiles.username`, `recon_entries` (filtered by status), `recon_media`; restrict write to authenticated users, update/delete to row owners.

### Form & field handling
- **Vendor type locking:** when adding recon for an existing vendor (via Hub "Add Recon" button), pass `vendorId` + `vendorType` as query params. Lock the type chip (read-only display) if both are present — the user cannot override.
- **Google Places integration:** server-side only; call `/api/places` route handler with an API key in `.env.local` (never exposed to client). Return place data (id, name, address, lat/lng) to client.
- **Image uploads:** compressed in the browser and uploaded **directly to Storage** (not through the action); the action only records `recon_media` paths. See **Recon photo uploads** below.

### Errors & gotchas

- **A raw NUL byte in a source file makes `grep` silently return NOTHING** (found 2026-09-12). `.claude/skills/launchvendors/scripts/lib.mjs` -- the largest, most central skill module -- carried four literal `0x00` bytes, written as cache-key separators where the escape was meant:
  ```js
  const key = `search\u0000${query}\u0000${pageToken || ''}`;   // correct
  ```
  With a raw NUL instead, `file` reports the source as `data`, and **grep treats it as binary: no matches printed, and exit code 0.** So `grep -n "typeProfile" lib.mjs` returned an empty result and no error, which reads exactly like "that symbol does not exist." `grep -a` works, but you have to already suspect the problem. `.claude/skills/enrichvendors/scripts/pdf-text.mjs` had the same thing inside a regex literal (`/\x00/g`, meant to strip NULs out of extracted PDF text).
  - **The runtime behavior was correct in both cases** -- a NUL is a fine string character and a fine cache-key separator, since it cannot appear in a query. Only the tooling broke. That is what let it sit there.
  - Fixed by writing the escapes (`\u0000` in the template literals, `\x00` in the regex), which produce byte-identical strings -- verified against the on-disk `places-cache.jsonl`, whose keys are stored JSON-escaped as `"search\u0000...\u0000"`, so the cache was NOT invalidated. That mattered: re-filling it costs real Places quota.
  - The check across the repo is a byte scan, not a grep: look for `b"\x00"` in every source file, or `file -b` on each and flag anything that does not say `text`.

- **The whole app was silently rendering in Times New Roman** (found 2026-08-04). `globals.css` carried an `@import "shadcn/tailwind.css"` (since **removed**, 2026-09-12 -- it was doing nothing), which used to supply `--font-sans`; the `shadcn` package (a caret range, `^4.11.0`) **no longer ships that file** — it publishes only `dist/` — so the import resolves to nothing, `--font-sans` was empty, and Tailwind's `font-sans` utility emitted `font-family: var(--font-sans)` → browser default serif. Geist was being downloaded by `next/font` and assigned to `--font-geist-sans`, then never referenced. Fixed by defining `--font-sans: var(--font-geist-sans)` in `:root`, which is now the only thing making `font-sans` work; the dead import was deleted afterwards and `shadcn` moved to devDependencies, where a component-adding CLI belongs. **Nothing fails loudly here** — the CSS import no-ops, the build passes, and a serif page just looks like a design choice. The check is one line in a browser: `getComputedStyle(document.body).fontFamily` should start with `Geist`.
- **Base UI + Radix confusion:** shadcn/ui wraps Base UI, not Radix — APIs differ. Check existing component files for patterns.
- **Console warning with render prop:** `<Button render={<Link>} />` triggers a warning; instead use `<Link className={buttonVariants()} />` directly.
- **Unique violation handling:** Google Places upsert can hit duplicate key; handle gracefully with `error?.code === "23505"` check.
- **Supabase free tier pausing:** after 7 days with zero requests, the project pauses (not deleted). Keep-alive is the daily `.github/workflows/keepalive.yml` ping of `/api/health` (repo variable `HEALTHCHECK_URL`). **A green run does not mean it worked** — it silently exits 0 when the variable is unset, and for weeks it was curling the apex domain, getting a **308** to the canonical host, and passing because the old test accepted any 2xx/3xx. `curl` does not follow redirects without `-L`, so Supabase was never touched. The step now uses `-L`, requires HTTP **200**, and greps the body for `"db":"ok"` — asserting on the payload, since the endpoint returns 200 even when its Supabase query fails. If you change the health check, keep it asserting on the body: status alone cannot tell you a query actually ran.
- **`getClaims()` over `getUser()` on read paths.** The project uses **asymmetric JWT signing keys**, so `getClaims()` verifies locally with no Auth-server round trip, while `getUser()` is always a network call. Used in `proxy.ts` (every request), the vendor page, the Hub, the recon-edit page, `ProfileMenu` (renders on nearly every page, and its `getUser()` sat serially in front of the profile query), and `useVendorPreviews`. **Writes keep `getUser()`** — `createRecon`, `updateRecon`, the auth callback, account actions — where the round trip is once-per-submit and catches a session revoked before its token expires. RLS re-validates the JWT at the database either way, so this is a latency choice, not the security boundary.
- **`generateMetadata` and the page share ONE vendor query, via React `cache()`.** They both need the row and each used to issue its own select, so every vendor page view paid two Supabase round trips for one row. `getVendor(id)` in `app/(app)/vendor/[id]/page.tsx` is wrapped in `cache()`, which dedupes within a single request render, so the second caller gets the first one's promise. It deliberately does the page's full `select("*")` even though metadata reads three columns: when the cost is a round trip rather than bytes, one wider query beats two narrow ones. Any new route that reads the same row in both places should do the same — the duplicate is easy to miss because both call sites look correct in isolation.
- **react-hook-form + React Compiler:** `watch("field")` triggers a benign "Compilation Skipped: incompatible library" lint warning (the compiler skips memoizing that component). Functionally fine; not worth chasing.
