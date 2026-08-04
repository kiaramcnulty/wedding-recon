import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { HeroVisual } from "@/components/landing/hero-visual";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { buttonVariants } from "@/components/ui/button";
import {
  CATEGORY_LIST,
  CATEGORY_PLURAL,
} from "@/lib/constants/categories";
import {
  CATEGORY_GRID_LABEL,
  CLOSING_CTA,
  COLORADO_SECTION,
  CONTACT_EMAIL,
  COVERAGE_AREAS,
  FAQ_ITEMS,
  HERO,
  HOW_IT_WORKS,
  RECON_GLOSS,
  VALUE_PROPS,
} from "@/lib/landing/content";
import { APP_HREF } from "@/lib/landing/nav";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "See what Colorado couples were actually quoted for wedding venues, catering, photography, flowers and music — then keep your own quotes and notes in one planning hub. Free, no account needed to browse.";

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s · Wedding Recon" template, which
  // would otherwise append the brand to a title that already opens with it.
  title: {
    absolute:
      "Wedding Recon — Colorado wedding vendor prices, from the couples who asked",
  },
  description: DESCRIPTION,
  // Query variants of `/` (?ref=app, campaign tags) must not split ranking
  // signals across URLs.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Wedding Recon",
    title: "Wedding Recon — real Colorado wedding vendor prices",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Wedding Recon — real Colorado wedding vendor prices",
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

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <Link
                  href="#how-it-works"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 px-6 text-base",
                  )}
                >
                  {HERO.secondaryCta}
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
        {/* Why it exists                                                     */}
        {/* ---------------------------------------------------------------- */}
        <Section className="border-y bg-muted/30">
          <SectionHeading eyebrow="Why this exists">
            Planning a wedding means paying for the same research over and over.
          </SectionHeading>

          <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-7">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-brand/20 bg-background px-5 py-5 sm:px-7">
            <p className="font-heading text-lg font-semibold">
              {RECON_GLOSS.word}
              <span className="ml-2 text-sm font-normal italic text-muted-foreground">
                {RECON_GLOSS.partOfSpeech}
              </span>
            </p>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {RECON_GLOSS.definition}
            </p>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                      */}
        {/* ---------------------------------------------------------------- */}
        <Section id="how-it-works">
          <SectionHeading eyebrow="How it works">
            Three things, on your phone, for free.
          </SectionHeading>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-7">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-heading text-sm font-semibold text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-base font-semibold">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Categories — each tile deep-links Explore to that filter          */}
        {/* ---------------------------------------------------------------- */}
        <Section className="border-y bg-muted/30">
          <SectionHeading eyebrow="What you can look up">
            Every vendor a Colorado wedding needs.
          </SectionHeading>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pick a category to open the map filtered to it. Colours and icons
            are the same ones you will see on the pins.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORY_LIST.map(({ type, icon: Icon, colorHex, lightHex }) => (
              <li key={type}>
                <Link
                  href={`${APP_HREF}?types=${type}`}
                  className="flex items-center gap-3 rounded-xl border bg-background px-3.5 py-3 no-underline transition-colors hover:bg-muted/60"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: lightHex, color: colorHex }}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="text-sm font-medium first-letter:uppercase">
                    {CATEGORY_GRID_LABEL[type] ?? CATEGORY_PLURAL[type]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Colorado                                                          */}
        {/* ---------------------------------------------------------------- */}
        <Section>
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-start md:gap-14">
            <div>
              <SectionHeading eyebrow="Where we cover">
                {COLORADO_SECTION.heading}
              </SectionHeading>
              {COLORADO_SECTION.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="mt-4 text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="flex flex-wrap gap-2 md:pt-12">
              {COVERAGE_AREAS.map((area) => (
                <li
                  key={area}
                  className="rounded-full border border-brand/25 bg-brand-soft/50 px-3 py-1.5 text-sm text-brand-ink"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* FAQ                                                               */}
        {/* ---------------------------------------------------------------- */}
        <Section id="faq" className="border-y bg-muted/30">
          <SectionHeading eyebrow="Questions">
            Before you start clicking around.
          </SectionHeading>
          <div className="mt-8">
            <LandingFaq />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Something else on your mind?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              Email the person who built this
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
          </div>
        </Section>
      </main>

      <LandingFooter />
    </>
  );
}
