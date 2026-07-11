---
name: verify
description: Run and drive Wedding Recon in an environment without Supabase credentials (e.g. Claude Code on the web) by pointing the app at a fake PostgREST backend and driving it with Playwright + the preinstalled Chromium.
---

# Verifying Wedding Recon without a hosted DB

`npm run build` needs only stub env to pass:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://stub.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="stub" npm run build
```

To actually **run and drive** the app, stand up a fake PostgREST server and point the app at it — supabase-js is plain REST, so a ~60-line `node:http` server suffices:

1. **Fake backend** (e.g. `:4590`): handle `GET /rest/v1/<table>?select=…&id=eq.…`. Requests with `Accept: …pgrst.object+json` (`.single()`/`.maybeSingle()`) get a bare object (406 + `{}` when no row); others get arrays. Honor the `select=` projection. Return `[]` for tables you don't care about; `{}` for `/auth/v1/*`. With no auth cookies, `getClaims()` never hits the network, so auth needs no real handling.
   - Vendor rows: give a valid `vendor_type` (see `lib/constants/categories.ts`), and set `google_photos: []` + `google_photos_fetched_at: now` so `getVendorGooglePhotos` stays on its cache path (no Google call).
2. **Dev server**: `NEXT_PUBLIC_SUPABASE_URL="http://localhost:4590" NEXT_PUBLIC_SUPABASE_ANON_KEY="stub" NEXT_PUBLIC_SITE_URL="http://localhost:3000" npm run dev`
3. **Drive it**: `npm i playwright-core` in the scratchpad, then `chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true })`. Mobile viewport 390×844 matches the app's frame.

Gotchas:
- The sandbox egress proxy 403s most external hosts (instagram.com, maps.google.com, vendor sites) at CONNECT — but **localhost is exempt**, so serve any "external site" fixtures from a second local `node:http` server. A clicked external link that can't load shows `chrome-error://chromewebdata/` as the popup URL — assert the anchor's `href` instead.
- Overlays/dialogs animate in over ~200ms — `waitForTimeout(~500)` before screenshots or they capture mid-fade and look transparent.
- Serve fixture HTML with `Content-Type: text/html; charset=utf-8` or emoji mojibake.
