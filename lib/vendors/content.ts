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
 * EVERY WORD ON /vendors LIVES IN THIS FILE.
 * ============================================================================
 *
 * Same contract as `lib/landing/content.ts`: `app/vendors/page.tsx` is layout
 * only and contains no sentences of its own.
 *
 * Editing rules (identical to the landing page, so the two surfaces read as one
 * voice):
 *
 * 1. NO EM DASHES. Use a spaced hyphen ( - ) for a sentence break.
 * 2. US spelling.
 * 3. Use a typographic apostrophe (it is / does not) or escape a straight one.
 * 4. FAQ `answer` stays PLAIN TEXT with no markup - the same string is emitted
 *    as FAQPage structured data, and a visible/structured mismatch is a policy
 *    violation.
 * 5. NEVER hardcode the price. It comes from `lib/portal/verification.ts`, which
 *    is the one place the portal button, the step and this page all read.
 */

export const META = {
  title: "Wedding Recon for vendors - claim and verify your business",
  socialTitle: "Verify your business on Wedding Recon",
  description:
    "Claim your wedding business on Wedding Recon, add your own pricing, photos and booking link, and stand out to Colorado couples with a verified checkmark.",
} as const;

export const HERO = {
  eyebrow: "For wedding vendors",
  heading: "Couples are already researching you here.",
  subheading:
    "Wedding Recon is where Colorado couples compare real quotes and notes on local wedding vendors. Verification lets you claim your listing, tell them what you actually offer, and give them a way to get in touch.",
  primaryCta: "Get started",
  signInPrompt: "Already have a Wedding Recon account?",
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
 * The honesty section. This is the question every vendor asks first, and
 * answering it plainly up front is what keeps the couple side trustworthy - the
 * landing FAQ already promises couples that vendors cannot pay to change what is
 * written about them, and this page must not appear to promise the opposite.
 */
export const HONESTY = {
  eyebrow: "What verification is not",
  heading: "Paying does not change what couples wrote.",
  body: "Recon entries are posted by couples, and verification gives you no power to edit, hide, or remove them. A verified listing sits alongside them, in your own words. If an entry is inaccurate or unfair, you can report it like anyone else and it gets reviewed on its merits.",
  reportNote:
    "Your listing is clearly marked as coming from you, so couples can tell your details apart from their neighbors' notes.",
} as const;

export const PRICING_SECTION = {
  eyebrow: "Pricing",
  heading: "One price, one business.",
  points: [
    "Billed through Stripe. Cancel anytime from the portal, and your listing simply unpublishes at the end of the period.",
    "Verification covers one business. If you run several, each is claimed and subscribed separately.",
    "No setup fee, no commission, and no charge to couples for contacting you.",
  ],
} as const;

export const FAQ_SECTION = {
  eyebrow: "Questions",
  heading: "Vendor questions.",
  footerPrompt: "Still have a question?",
  footerLinkLabel: "Email us",
} as const;

export interface VendorFaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: readonly VendorFaqItem[] = [
  {
    question: "Do I need a separate vendor account?",
    answer:
      "No. Wedding Recon has one kind of account. Sign in with your email, claim your business, and the vendor portal appears for you. If you already have an account from browsing as a couple, use that one.",
  },
  {
    question: "My business is already on Wedding Recon. How did it get there?",
    answer:
      "Colorado vendors were added so couples had something to research, the same way a map lists businesses. Claiming yours puts you in control of the details on it.",
  },
  {
    question: "Can I edit or remove recon that couples posted about me?",
    answer:
      "No. Those entries belong to the people who wrote them. You can report an entry that is inaccurate or unfair and it gets reviewed, which is the same option any visitor has.",
  },
  {
    question: "What happens if I cancel?",
    answer:
      "Your listing unpublishes and your checkmark goes away at the end of the period you paid for. Your business stays on the map, and you can subscribe again later without redoing your listing.",
  },
  {
    question: "Does verification guarantee I rank first?",
    answer:
      "No. Verification moves you up among vendors who match what a couple searched for. It never puts you ahead of a vendor who is a better match for the filters they chose.",
  },
  {
    question: "How do I prove the business is mine?",
    answer:
      "Claiming is immediate, so you are never stuck waiting to build your listing. Claims are reviewed afterward and a claim on a business that is not yours is revoked. Signing up with an email at your business domain is the fastest way to be recognized.",
  },
];

export const CLOSING_CTA = {
  heading: "Claim your business.",
  body: "It takes a few minutes, and you can see the whole flow before you pay anything.",
  cta: "Get started",
} as const;
