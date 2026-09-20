import {
  ArrowUpRight,
  BadgeCheck,
  PencilRuler,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { PRICE_BILLING_NOTE, PRICE_PER_MONTH } from "@/lib/portal/verification";

/**
 * ============================================================================
 * EVERY WORD ON /for-vendors LIVES IN THIS FILE.
 * ============================================================================
 *
 * Same contract as `lib/landing/content.ts`: `app/for-vendors/page.tsx` is layout
 * only and contains no sentences of its own.
 *
 * Editing rules (identical to the landing page, so the two surfaces read as one
 * voice):
 *
 * 1. NO EM DASHES. Use a spaced hyphen ( - ) for a sentence break.
 * 2. US spelling.
 * 3. Use a typographic apostrophe (it is / does not) or escape a straight one.
 * 4. NEVER hardcode the price. It comes from `lib/portal/verification.ts`, which
 *    is the one place the portal button, the step and this page all read.
 */

/**
 * Where every CTA on this page goes.
 *
 * NOT /portal: that route redirects a signed-out visitor to /for-vendors, so a
 * CTA here pointing at it is a loop back to the page you are already on. `from` is
 * where sign-in lands, `back` is where the back link returns - see
 * lib/auth/post-signin-redirect.ts.
 */
export const SIGN_IN_HREF = "/login?from=/portal&back=/for-vendors";

export const META = {
  title: "Wedding Recon for vendors - claim and verify your business",
  socialTitle: "Verify your business on Wedding Recon",
  description:
    "Claim your wedding business on Wedding Recon, add your own pricing, photos and booking link, and stand out to Colorado couples with a verified checkmark.",
} as const;

export const HERO = {
  eyebrow: "For wedding vendors",
  heading: "Verify your wedding business",
  subheading:
    "Wedding Recon is a community for Colorado couples to find vendors and compare real quotes and experiences. Verification gives your business credibility and increased visibility, tells couples what you offer directly from you, and provides interested leads a path to get in touch.",
  primaryCta: "Get started",
  signInPrompt: "Already have an account?",
  signInCta: "Sign in",
  reassurance: `${PRICE_PER_MONTH}, ${PRICE_BILLING_NOTE}. Cancel anytime.`,
} as const;

/**
 * What a vendor gets for verification. Shared with the in-portal pitch
 * (`components/portal/verification-intro.tsx`) so the page a vendor reads before
 * signing up and the one they land on after can never disagree about what was
 * promised.
 *
 * Kept to what the product actually delivers - a checkmark, a modest Explore
 * ranking boost, a CTA link, and vendor-provided listing details. Nothing here
 * promises a perk the app does not ship.
 */
export const VERIFICATION_BENEFITS: readonly {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: BadgeCheck,
    title: "A verified checkmark",
    body: "A trust signal on your profile and in couples' search results.",
  },
  {
    icon: TrendingUp,
    title: "Higher visibility",
    body: "Verified vendors sort ahead of unverified ones in the same Explore results.",
  },
  {
    icon: ArrowUpRight,
    title: "Guide couples onward",
    body: "A call-to-action button that links straight to your inquiry or booking page.",
  },
  {
    icon: PencilRuler,
    title: "Your own verified details",
    body: "Add pricing, photos, website, and the services couples filter by.",
  },
];

export const BENEFITS_SECTION = {
  eyebrow: "What you get",
  heading: "Verification, in four parts.",
} as const;

/**
 * The three steps of the portal, in the order the portal itself walks them
 * (`app/(portal)/portal/page.tsx`). This section exists so the page IS a preview
 * of the flow rather than a separate pitch - if the portal ever gains or loses a
 * step, change it here too.
 */
export const STEPS_SECTION = {
  eyebrow: "How it works",
  heading: "Three steps, about ten minutes.",
} as const;

export const STEPS: readonly { title: string; body: string }[] = [
  {
    title: "Find or create your business",
    body: "Search for your business by name. Most Colorado wedding vendors are already listed. If yours is not, you can add it.",
  },
  {
    title: "Create your verified listing",
    body: "Add your intro, pricing, photos, a link couples can act on, and the services they filter by. Nothing goes live until you subscribe.",
  },
  {
    title: "Subscribe to verification",
    body: `${PRICE_PER_MONTH}, ${PRICE_BILLING_NOTE}. This publishes your listing and adds your checkmark. Cancel anytime.`,
  },
];

/**
 * The contact line. All that remains of the FAQ band (removed 2026-09-20,
 * Kiara) - the questions themselves are gone, the way to ask one is not.
 */
export const CONTACT = {
  prompt: "Questions about verification?",
  linkLabel: "Email us",
} as const;

export const CLOSING_CTA = {
  heading: "Verify your business.",
  body: `Create trust and visibility with couples actively looking for wedding vendors, for 10 minutes of time and just ${PRICE_PER_MONTH}.`,
  cta: "Get started",
} as const;
