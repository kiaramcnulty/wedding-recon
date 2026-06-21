# Setup

What you need to create so the app can run. Priority order: **GitHub → Supabase → Google Places**. The first two get the whole app running locally; Google only gates business search in Add Recon.

## 1. GitHub repo
Create a private repo named `wedding-recon` (empty). The local project will push to it. Powers code, the keep-alive cron, and Vercel deploys.

## 2. Supabase (unblocks auth, DB, storage)
1. Create a free account → **New project**. Pick a US region near Denver; set + save a strong DB password.
2. **Settings → API** → copy: **Project URL**, **anon public key**, **service_role key**.
3. **Authentication → Providers** → enable **Email** (magic link). Under URL config add `http://localhost:3000` (and later your prod URL) to redirect URLs.
4. Apply the database schema (choose one):
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`, then run `supabase/seed.sql`.
   - **Dashboard:** paste each file in `supabase/migrations/` (in order) then `supabase/seed.sql` into the SQL editor.
   - PostGIS, the `recon-media` storage bucket, and policies are all created by the migrations — no manual DB clicks needed.

Put the three values into `.env.local` (see below).

## 3. Google Cloud — Places API (only gates Add Recon search)
1. New Google Cloud project → enable **Places API (New)**.
2. ⚠️ Google requires a **billing account with a credit card** even for the free tier. Expected spend ~$0 at our volume, but the card is mandatory.
3. Create an **API key**, restrict it to the Places API. Keep it secret (used server-side).
4. Put it in `.env.local` as `GOOGLE_PLACES_API_KEY`.

## 4. Vercel (deploy — can wait)
Free account → connect GitHub → import the repo. Add the same env vars from `.env.local` in the Vercel project settings. Hobby tier is fine for a non-revenue app.

## 5. Keep-alive (free, avoids Supabase pausing)
After the first deploy, set a GitHub repo **variable** `HEALTHCHECK_URL` to `https://<your-domain>/api/health`. The workflow in `.github/workflows/keepalive.yml` pings it daily so the free Supabase project doesn't pause during low-traffic periods.

## 6. Domain (optional, not blocking)
Register at Cloudflare Registrar (at-cost, free WHOIS privacy). Add the domain in Vercel and set the DNS records Vercel provides.

## Local env
Copy `.env.example` → `.env.local` and fill in the values above. Then:

```
npm install
npm run dev
```

App runs at http://localhost:3000 (redirects to `/explore`).

> No Supabase cloud project yet? You can run it locally with `npx supabase start` (needs Docker Desktop) and use the local URL/anon key it prints. You'll still need the cloud project for deploy.
