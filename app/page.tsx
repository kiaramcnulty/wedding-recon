import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { HeroVisual } from "@/components/landing/hero-visual";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { DataHighlight } from "@/components/landing/data-highlight";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProblemCard } from "@/components/landing/problem-card";
import { SwipeCarousel } from "@/components/landing/swipe-carousel";
import { buttonVariants } from "@/components/ui/button";
import {
  CLOSING_CTA,
  CONTACT_EMAIL,
  DATA_SECTION,
  FAQ_ITEMS,
  FAQ_SECTION,
  HERO,
  HOW_SECTION,
  META,
  PROBLEM_SOLUTIONS,
  PROBLEMS_SECTION,
} from "@/lib/landing/content";
import { APP_HREF } from "@/lib/landing/nav";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const DESCRIPTION = META.description;

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s · Wedding Recon" template, which
  // would otherwise append the brand to a title that already opens with it.
  title: { absolute: META.title },
  description: DESCRIPTION,
  // Query variants of `/` (?ref=app, campaign tags) must not split ranking
  // signals across URLs.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
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
 * Structured data. The FAQPage node makes the Q&A eligible for rich results,
 * and is generated from the same FAQ_ITEMS the page renders so the two can
 * never disagree — Google treats visible/structured mismatches as a violation.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Wedding Recon",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      email: CONTACT_EMAIL,
      description: DESCRIPTION,
      areaServed: { "@type": "State", name: "Colorado" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Wedding Recon",
      description: DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

/** Consistent page gutter + column width for every band on the page. */
function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("px-5 py-14 md:py-20", className)}>
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {children}
      </h2>
    </>
  );
}

export default function LandingPage() {
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
        <section className="px-5 pb-16 pt-10 md:pb-24 md:pt-16">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-12 md:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-ink">
                <MapPin className="size-3.5" aria-hidden />
                {HERO.eyebrow}
              </p>

              <h1 className="mt-5 font-heading text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                {HERO.heading}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {HERO.subheading}
              </p>

              <div className="mt-8">
                <Link
                  href={APP_HREF}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 gap-2 bg-brand px-6 text-base text-white hover:bg-brand/90",
                  )}
                >
                  {HERO.primaryCta}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {HERO.reassurance}
              </p>
            </div>

            <HeroVisual className="justify-self-center md:justify-self-end" />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works. Owns the `how-it-works` id that the header nav    */}
        {/* and the hero's secondary CTA both anchor to.                     */}
        {/* ---------------------------------------------------------------- */}
        <Section id="how-it-works" className="border-y bg-muted/30">
          <SectionHeading eyebrow={HOW_SECTION.eyebrow}>
            {HOW_SECTION.heading}
          </SectionHeading>
          <HowItWorks className="mt-10" />
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Problem -> solution, one full-width row per pair, alternating.   */}
        {/* ---------------------------------------------------------------- */}
        <Section>
          {/* Visible heading cut so the section opens straight into the cards;
              kept sr-only because four h3s still need an h2 over them for the
              document outline. */}
          <h2 className="sr-only">{PROBLEMS_SECTION.srHeading}</h2>
          <SwipeCarousel
            slideLabels={PROBLEM_SOLUTIONS.map((item) => item.problem)}
            label={PROBLEMS_SECTION.carouselLabel}
            hint={PROBLEMS_SECTION.carouselHint}
          >
            {PROBLEM_SOLUTIONS.map((item) => (
              <ProblemCard key={item.problem} item={item} />
            ))}
          </SwipeCarousel>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* The directory in numbers. Replaced the Colorado and category     */}
        {/* sections; carries their internal links and keywords - see        */}
        {/* DataHighlight.                                                   */}
        {/* ---------------------------------------------------------------- */}
        <Section className="border-y bg-muted/30">
          <SectionHeading eyebrow={DATA_SECTION.eyebrow}>
            {DATA_SECTION.headline.vendors}{" "}
            {DATA_SECTION.headline.vendorsLabel}, across{" "}
            {DATA_SECTION.headline.types} categories.
          </SectionHeading>
          <DataHighlight />
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* FAQ                                                               */}
        {/* ---------------------------------------------------------------- */}
        <Section id="faq">
          <SectionHeading eyebrow={FAQ_SECTION.eyebrow}>
            {FAQ_SECTION.heading}
          </SectionHeading>
          <div className="mt-8">
            <LandingFaq />
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
            <Link
              href={APP_HREF}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 h-12 gap-2 bg-white px-6 text-base text-brand-ink hover:bg-white/90",
              )}
            >
              {CLOSING_CTA.cta}
              <ArrowRight className="size-4" aria-hidden />
            </Link>

            {/* The sixth quote on file. It is praise for the product rather
                than a problem statement, so it closes the page instead of
                sitting on a carousel card. */}
            <figure className="mx-auto mt-10 max-w-lg border-t border-white/25 pt-6">
              <blockquote className="text-sm italic leading-relaxed text-white/90">
                {CLOSING_CTA.quote.text}
              </blockquote>
              <figcaption className="mt-2 text-xs text-white/70">
                {CLOSING_CTA.quote.name} · {CLOSING_CTA.quote.context}
              </figcaption>
            </figure>
          </div>
        </Section>
      </main>

      <LandingFooter />
    </>
  );
}
