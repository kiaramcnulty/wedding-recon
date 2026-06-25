# Setup

What you need to create so the app can run. Priority order: **GitHub → Supabase → Google Places**. The first two get the whole app running locally; Google only gates business search in Add Recon.

## 1. GitHub repo
Create a private repo named `wedding-recon` (empty). The local project will push to it. Powers code, the keep-alive cron, and Vercel deploys.

## 2. Supabase (unblocks auth, DB, storage)
1. Create a free account → **New project**. Pick a US region near Denver; set + save a strong DB password.
2. **Settings → API** → copy: **Project URL**, **anon public key**, **service_role key**.
3. **Authentication → Providers** → enable **Email** (magic link). Under URL config add `http://localhost:3000` (and later your prod URL) to redirect URLs. The built-in email sender works for local testing but is rate-limited and not for production — set up custom SMTP (section 7) before sharing the app.
4. Apply the database schema (choose one):
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`, then run `supabase/seed.sql`.
   - **Dashboard:** paste each file in `supabase/migrations/` (in order) then `supabase/seed.sql` into the SQL editor.
   - PostGIS, the `recon-media` storage bucket, and policies are all created by the migrations — no manual DB clicks needed.

Put the three values into `.env.local` (see below).

## 3. Google Cloud — Places API (only gates Add Recon search)
1. New Google Cloud project → enable **Places API (New)**.
2. ⚠️ Google requires a **billing account with a credit card** even for the free tier. Expected spend ~$0 at our volume, but the card is mandatory.
3. Create an **API key**. Under **API restrictions**, restrict it to **Places API (New)** — *not* the legacy "Places API". Restricting to the wrong one (or leaving "Places API (New)" disabled) causes a 403 `API_KEY_SERVICE_BLOCKED` and the business search silently falls back to manual entry. Keep the key secret (used server-side, so leave **Application restrictions** at "None" or IP-based — an HTTP-referrer restriction would block the server call).
4. Put it in `.env.local` as `GOOGLE_PLACES_API_KEY`.

## 4. Vercel (deploy — can wait)
Free account → connect GitHub → import the repo. Add the same env vars from `.env.local` in the Vercel project settings. Hobby tier is fine for a non-revenue app.

## 5. Keep-alive (free, avoids Supabase pausing)
After the first deploy, set a GitHub repo **variable** `HEALTHCHECK_URL` to `https://<your-domain>/api/health`. The workflow in `.github/workflows/keepalive.yml` pings it daily so the free Supabase project doesn't pause during low-traffic periods.

## 6. Domain (optional, not blocking)
Register at Cloudflare Registrar (at-cost, free WHOIS privacy). Add the domain in Vercel and set the DNS records Vercel provides.

## 7. Custom SMTP for auth emails (Resend + your Cloudflare domain)
Supabase's built-in email sender is **for testing only** — it's capped at a few emails/hour (you'll hit "email rate limit exceeded" fast) and won't reliably land magic links in real inboxes. Before sharing the app, route auth email through Resend. Free tier: 3,000 emails/month — far above soft-launch volume.

> You do **not** need an email mailbox/hosting on the domain. Sending only needs DNS control (which Cloudflare gives you) so the provider can be authorized via DKIM/SPF. The "from" address (e.g. `login@yourdomain.com`) doesn't have to be a receivable inbox.

1. **Resend account** → sign up (free, no card). **Add Domain** → enter your domain.
2. **DNS in Cloudflare** → Resend shows ~3–4 records (a **DKIM** `TXT`, an **SPF**/`MX` pair on a `send.` subdomain, and a **DMARC** `TXT`). Add each in Cloudflare **DNS**. Set them to **DNS only (grey cloud, not proxied)** — proxied/orange-cloud breaks mail records. Back in Resend, click **Verify** (propagation is usually minutes).
3. **API key** → Resend **API Keys → Create** (send-access is enough). Copy the `re_...` value — it's the SMTP password.
4. **Supabase** → **Authentication → Emails → SMTP Settings → Enable Custom SMTP**:
   - Host: `smtp.resend.com`  ·  Port: `465`
   - Username: `resend`  ·  Password: the `re_...` API key
   - Sender email: `login@yourdomain.com`  ·  Sender name: `Wedding Recon`
5. **Raise the cap** → **Authentication → Rate Limits** → bump "Rate limit for sending emails" (e.g. 30+/hour) now that you're off the built-in sender.
6. **Test** → trigger a magic link (login page or guest Add-Recon flow) and confirm it arrives in the inbox, not spam.

> Optional: enable Cloudflare **Email Routing** (free) to forward replies to `login@`/`hello@` to your Gmail. Not needed for sending.

## Local env
Copy `.env.example` → `.env.local` and fill in the values above. Then:

```
npm install
npm run dev
```

App runs at http://localhost:3000 (redirects to `/explore`).

> No Supabase cloud project yet? You can run it locally with `npx supabase start` (needs Docker Desktop) and use the local URL/anon key it prints. You'll still need the cloud project for deploy.
