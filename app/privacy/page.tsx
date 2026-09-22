import type { Metadata } from "next";
import Link from "next/link";

import { BrandFooter } from "@/components/brand-lockup";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Wedding Recon collects, why, who we share it with, and how to get your data deleted.",
};

/**
 * Companion to /terms, and deliberately a top-level route for the same reason:
 * it is linked from the landing footer and the onboarding consent line, and
 * reading it should not count as "has used the product" (no <MarkVisited>).
 *
 * Keep this factual and in step with the code. The claims it makes that are
 * enforced elsewhere: PostHog runs with autocapture and session recording OFF
 * (lib/analytics/posthog.ts), the attribution cookie is first-touch and holds
 * no secret (lib/analytics/attribution.ts), browser location is never sent to
 * us (app/(app)/explore/page.tsx keeps it in component state), and card
 * details never reach our servers (Stripe Checkout; vendor_subscriptions
 * stores only Stripe ids and a status).
 */
const LAST_UPDATED = "September 20, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[480px] px-5 py-10 space-y-6 md:max-w-[640px] lg:max-w-[768px]">
      <h1 className="text-2xl font-medium">Privacy policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">The short version</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Wedding Recon is a community tool for engaged couples. We collect as
          little as we can get away with: an email address so you can sign in, a
          username, and whatever recon you choose to post. We do not sell your
          personal information, we do not run ads, and we do not record your
          screen or your browsing outside this site.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">What we collect</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="font-medium text-foreground">Your account.</strong>{" "}
          Your email address (used to send sign-in codes and to contact you about
          your account) and the username you pick. We never ask for a password —
          sign-in is a one-time code sent to your email.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="font-medium text-foreground">
            What you post.
          </strong>{" "}
          Recon entries — vendor, price quotes, notes, dates, and any photos you
          upload — along with the vendors you save to your Planning Hub.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="font-medium text-foreground">
            How you found us.
          </strong>{" "}
          On your first visit, if you arrived from a link that carries campaign
          tags or from another site, we store that source in a first-party
          cookie and attach it to your profile if you later sign up. It records
          where you came from and nothing else, it is never overwritten by a
          later visit, and a direct visit records nothing at all.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="font-medium text-foreground">Usage.</strong> Page
          views and a small set of named product events (for example: a recon
          saved, a vendor page opened) through PostHog, our analytics provider.
          Blanket click tracking and session recording are both switched off, and
          anonymous visitors stay anonymous to PostHog until they sign in.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="font-medium text-foreground">
            Technical data.
          </strong>{" "}
          Our hosting and database providers log ordinary request data — IP
          address, browser type, timestamps — for security and reliability.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="font-medium text-foreground">
            Vendors who claim a listing.
          </strong>{" "}
          A contact email, your role at the business, and the listing content you
          write. Payments run through Stripe: we store only Stripe identifiers
          and your subscription status. Card numbers never touch our servers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Location</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Explore map has a “find me” button. If you allow it, your browser
          gives us your position so the map can centre on you. It stays in your
          browser for that visit — we do not send it to our servers, store it, or
          attach it to your account. The map otherwise works from whatever area
          you have panned to.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">What is public</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Recon you post is public. It appears on the vendor page attributed to
          your username, is visible to anyone with the link whether or not they
          have an account, and may be indexed by search engines. Your email
          address is never shown publicly. Please do not put anything in a recon
          entry — including in photos — that you would not want a vendor, a
          guest, or a search engine to see.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Why we use it</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          To sign you in and keep your account secure; to show your recon and
          saved vendors back to you and to the community; to moderate reported
          content; to understand which parts of the product people actually use
          and where new couples are finding us; and to bill vendors who subscribe
          to a verified listing.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Who we share it with</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We do not sell your personal information or share it for advertising.
          We use a small number of service providers who process data on our
          behalf: <strong className="font-medium text-foreground">Supabase</strong>{" "}
          (database, authentication, photo storage),{" "}
          <strong className="font-medium text-foreground">Vercel</strong>{" "}
          (hosting), <strong className="font-medium text-foreground">PostHog</strong>{" "}
          (product analytics),{" "}
          <strong className="font-medium text-foreground">Stripe</strong>{" "}
          (vendor payments), and{" "}
          <strong className="font-medium text-foreground">Google</strong>{" "}
          (business search and vendor photos in the directory). Map tiles come
          from OpenFreeMap. We may also disclose information if the law requires
          it, or to investigate abuse of the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Cookies</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We use a session cookie to keep you signed in, the first-touch source
          cookie described above, and PostHog&rsquo;s analytics cookie. There are
          no advertising or cross-site tracking cookies. You can clear or block
          cookies in your browser; sign-in will stop working without the session
          cookie.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Keeping and deleting your data</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We keep your account data for as long as your account exists. You can edit
          any recon entry you posted from your Planning Hub at any time. There is no
          self-serve delete button yet — email us to have an entry taken down, or
          to delete your account and everything attached to it. Content you posted may remain in backups for a short
          period after deletion, and moderation records may be retained where we
          need them to prevent abuse.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your rights</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Depending on where you live — including Colorado, where we are based —
          you may have the right to access, correct, delete, or receive a copy of
          your personal data, and to opt out of its sale or of profiling (we do
          neither). Email us and we will action the request; we will not treat
          you differently for making one. If you are unhappy with our response,
          Colorado residents can raise it with the Colorado Attorney General.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Children</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Wedding Recon is not intended for anyone under 16, and we do not
          knowingly collect information from children. If you believe a child has
          created an account, let us know and we will remove it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Changes</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If we change this policy we will update the date at the top of this
          page. Material changes will be flagged in the app.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Contact</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Questions, requests, or concerns about privacy? Email
          kiara@weddingrecon.com.
        </p>
      </section>

      <p className="text-xs text-muted-foreground leading-relaxed pt-4 border-t">
        See also our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Terms &amp; disclaimer
        </Link>
        .
      </p>

      <BrandFooter />
    </div>
  );
}
