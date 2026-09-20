import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { Section, SectionHeading } from "@/components/landing/section";
import { PortalCtaLink } from "@/components/vendors/portal-cta-link";
import { buttonVariants } from "@/components/ui/button";
import { CONTACT_EMAIL } from "@/lib/landing/content";
import { cn } from "@/lib/utils";
import {
  BENEFITS_SECTION,
  CLOSING_CTA,
  CONTACT,
  HERO,
  META,
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
  alternates: { canonical: "/for-vendors" },
  openGraph: {
    type: "website",
    url: "/for-vendors",
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

export default function VendorsPage() {
  return (
    <>
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
        {/* Contact. All that is left of the FAQ band - a single line, so it  */}
        {/* gets a slim section rather than a full one.                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-t px-5 py-8">
          <p className="mx-auto w-full max-w-5xl text-sm text-muted-foreground">
            {CONTACT.prompt}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              {CONTACT.linkLabel}
            </a>
            .
          </p>
        </section>

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
