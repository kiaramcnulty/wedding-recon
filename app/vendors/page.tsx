import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { Section, SectionHeading } from "@/components/landing/section";
import { PortalCtaLink } from "@/components/vendors/portal-cta-link";
import { VendorFaq } from "@/components/vendors/vendor-faq";
import { buttonVariants } from "@/components/ui/button";
import { CONTACT_EMAIL } from "@/lib/landing/content";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  BENEFITS_SECTION,
  CLOSING_CTA,
  FAQ_ITEMS,
  FAQ_SECTION,
  HERO,
  HONESTY,
  META,
  PRICING_SECTION,
  STEPS,
  STEPS_SECTION,
  VERIFICATION_BENEFITS,
} from "@/lib/vendors/content";

/**
 * The public vendor entry point.
 *
 * Why it exists: every vendor link in the app used to go straight to /portal,
 * which is auth-gated on its first line - so a vendor who had never heard of
 * Vendor Verification was dropped on a sign-in form with no idea what they were
 * signing up for. The pitch lived BEHIND the gate. This page is that pitch, and
 * /portal now redirects a signed-out visitor here instead of to /login.
 *
 * Deliberately at the app root, not under `(app)`: that layout mounts
 * <MarkVisited>, and a vendor reading about verification is not a couple using
 * the product - marking them as one would suppress the landing page. Same
 * reasoning as /terms and the portal itself.
 *
 * Reads no cookies, so it stays statically prerendered.
 */

const DESCRIPTION = META.description;

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s · Wedding Recon" template, which
  // would otherwise append the brand to a title that already opens with it.
  title: { absolute: META.title },
  description: DESCRIPTION,
  alternates: { canonical: "/vendors" },
  openGraph: {
    type: "website",
    url: "/vendors",
    siteName: "Wedding Recon",
    title: META.socialTitle,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: META.socialTitle,
    description: DESCRIPTION,
  },
};

/**
 * Structured data. Generated from the same FAQ_ITEMS the page renders, so the
 * visible answers and the structured ones can never disagree - Google treats a
 * mismatch as a violation. Its own @id, distinct from the landing page's.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/vendors#faq`,
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function VendorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <LandingHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 pb-14 pt-10 md:pb-20 md:pt-16">
          <div className="mx-auto w-full max-w-5xl">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-ink">
              {HERO.eyebrow}
            </p>

            <h1 className="mt-5 max-w-3xl font-heading text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              {HERO.heading}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {HERO.subheading}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <PortalCtaLink
                placement="hero"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 gap-2 bg-brand px-6 text-base text-white no-underline! hover:bg-brand/90",
                )}
              >
                {HERO.primaryCta}
                <ArrowRight className="size-4" aria-hidden />
              </PortalCtaLink>

              {/* Auth is a single OTP form that signs in OR creates the
                  account, so this is not a second destination - it is
                  reassurance for someone who already has an account and does
                  not want to make another. `back` sends the login screen's back
                  link here rather than to /portal, which would bounce a
                  signed-out visitor straight back into /login. */}
              <p className="text-sm text-muted-foreground">
                {HERO.signInPrompt}{" "}
                <PortalCtaLink
                  placement="signin"
                  href="/login?from=/portal&back=/vendors"
                  className="font-medium text-brand-ink underline underline-offset-2"
                >
                  {HERO.signInCta}
                </PortalCtaLink>
              </p>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {HERO.reassurance}
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* What you get. VERIFICATION_BENEFITS is the same constant the       */}
        {/* in-portal intro renders.                                           */}
        {/* ---------------------------------------------------------------- */}
        <Section className="border-y bg-muted/30">
          <SectionHeading eyebrow={BENEFITS_SECTION.eyebrow}>
            {BENEFITS_SECTION.heading}
          </SectionHeading>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {VERIFICATION_BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <b.icon className="size-[18px] text-brand-ink" aria-hidden />
                </span>
                <div>
                  <p className="font-heading font-semibold">{b.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {b.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works - the portal's own three steps, so the page is a      */}
        {/* preview of the flow rather than a separate pitch.                  */}
        {/* ---------------------------------------------------------------- */}
        <Section>
          <SectionHeading eyebrow={STEPS_SECTION.eyebrow}>
            {STEPS_SECTION.heading}
          </SectionHeading>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <p className="font-heading text-lg font-semibold">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* What verification is NOT. The couple side promises that vendors    */}
        {/* cannot pay to change what is written about them; this page has to  */}
        {/* say the same thing, in the vendor's direction.                     */}
        {/* ---------------------------------------------------------------- */}
        <Section className="border-y bg-muted/30">
          <div className="max-w-3xl">
            <SectionHeading eyebrow={HONESTY.eyebrow}>
              {HONESTY.heading}
            </SectionHeading>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {HONESTY.body}
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {HONESTY.reportNote}
            </p>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Pricing                                                           */}
        {/* ---------------------------------------------------------------- */}
        <Section>
          <SectionHeading eyebrow={PRICING_SECTION.eyebrow}>
            {PRICING_SECTION.heading}
          </SectionHeading>
          <div className="mt-8 max-w-3xl rounded-2xl border bg-card p-6 sm:p-8">
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {HERO.reassurance}
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {PRICING_SECTION.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-brand-ink"
                    aria-hidden
                  />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* FAQ                                                               */}
        {/* ---------------------------------------------------------------- */}
        <Section id="vendor-faq" className="border-y bg-muted/30">
          <SectionHeading eyebrow={FAQ_SECTION.eyebrow}>
            {FAQ_SECTION.heading}
          </SectionHeading>
          <div className="mt-8">
            <VendorFaq />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {FAQ_SECTION.footerPrompt}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              {FAQ_SECTION.footerLinkLabel}
            </a>
            .
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Closing CTA                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Section>
          <div className="rounded-3xl bg-brand px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {CLOSING_CTA.heading}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              {CLOSING_CTA.body}
            </p>
            <PortalCtaLink
              placement="closing"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 h-12 gap-2 bg-white px-6 text-base text-brand-ink no-underline! hover:bg-white/90",
              )}
            >
              {CLOSING_CTA.cta}
              <ArrowRight className="size-4" aria-hidden />
            </PortalCtaLink>
          </div>
        </Section>
      </main>

      <LandingFooter />
    </>
  );
}
