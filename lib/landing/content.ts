import type { VendorType } from "@/lib/constants/categories";

/**
 * ============================================================================
 * EVERY WORD ON THE LANDING PAGE LIVES IN THIS FILE.
 * ============================================================================
 *
 * The components under `components/landing/` and `app/page.tsx` are layout
 * only - they contain no sentences of their own. To reword the page, edit the
 * strings below and nothing else.
 *
 * Editing rules:
 *
 * 1. Keep the quotes and the trailing commas. Text goes between the quotes.
 * 2. Use a typographic apostrophe (it is / does not) or escape a straight one
 *    (\'). An unescaped ' inside a '...' string breaks the build.
 * 3. NO EM DASHES in copy. Use a spaced hyphen ( - ) for a sentence break
 *    (Kiara, 2026-08-04). Same house style the enrich pipeline enforces on
 *    recon text, where upload.mjs hard-fails an em dash outright.
 * 4. FAQ `answer` must stay PLAIN TEXT with no markup - the same string is
 *    emitted as FAQPage structured data for Google, and a mismatch between the
 *    visible answer and the structured one is a policy violation. Use the
 *    optional `link` field if an answer needs a link.
 * 5. Nothing here may name a real vendor or attach a price to one. The figures
 *    in EXAMPLE_RECON are invented and the card no longer carries an "Example"
 *    badge, so its anonymity is the only thing keeping it honest.
 * 6. Length guides where they matter are noted inline (META especially).
 *
 * Run `npm run build` after editing to catch a stray quote or comma.
 */

/* -------------------------------------------------------------------------- */
/* Search engine + social preview                                             */
/* -------------------------------------------------------------------------- */

export const META = {
  /**
   * The blue headline in Google results and the browser tab.
   * Google truncates around 60 characters - front-load the important words.
   * Current length is 58, so it displays in full. Keep it under 60.
   */
  title:
    "Wedding Recon - Colorado wedding vendor intel from couples",
  /**
   * The gray paragraph under the headline in Google results, and the preview
   * text when the link is shared. Google shows roughly 155 characters.
   * Current length is 252, cut after "...Manage and share y". The vendor-type
   * list lands inside the visible window; the planning hub and the free-to-use
   * line fall outside it.
   */
  description:
    "See quotes and insights from real Colorado couples for 10+ wedding vendor types: venues, catering, photography, florists, music and more. Manage and share your own quotes and notes in one central planning hub. Free, no account needed to explore vendors.",
  /** Shorter title used for link previews (iMessage, X, Facebook). */
  socialTitle: "Wedding Recon - real Colorado wedding vendor prices and intel",
} as const;

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export const HEADER = {
  howItWorks: "How it works",
  faq: "FAQ",
  cta: "Explore vendors",
} as const;

/* -------------------------------------------------------------------------- */
/* Hero — the first screen                                                    */
/* -------------------------------------------------------------------------- */

export const HERO = {
  /** Small green pill above the headline. */
  eyebrow: "Colorado wedding vendors",
  /** The one <h1> on the page. Keep it short enough to sit on two lines. */
  heading: "Real prices & intel from real Colorado weddings.",
  subheading:
    "Wedding Recon is a community of couples sharing their firsthand quotes, intel and experiences with florists, hotel blocks, photographers and other vendors. So you can find great-fit, in-budget vendors for your perfect day.",
  primaryCta: "Explore Colorado vendors",
  reassurance: "Free to use. No account needed to explore vendors.",
} as const;

/**
 * The sample recon entry floating over the hero illustration.
 *
 * Intentionally anonymous, and that anonymity is the whole safeguard: every
 * number here is invented, so `place` must stay a region ("Boulder County")
 * and never a business a reader could go and check. There is no "Example"
 * badge on the card any more (dropped 2026-08-04 as redundant), which leaves
 * nothing else marking the figures as illustrative.
 */
export const EXAMPLE_RECON = {
  category: "Venue",
  place: "Boulder County",
  price: "$8,400",
  priceDetail: "price for Saturday in September · we did DIY package tier, price can range up to $12k",
  notes:
    "Ceremony site, chairs and the bridal suite are included. The bar minimum is separate, that costs about $3.5k for 120 guests. Outside catering is allowed, which we are doing.",
  reconType: "In person",
  collected: "Collected Jun 2026",
} as const;

/* -------------------------------------------------------------------------- */
/* How it works - the three steps, shown as an auto-advancing stepper          */
/* -------------------------------------------------------------------------- */

/**
 * Which in-app visual a step or a solution row shows. The visuals are stylised
 * mock-ups drawn in code (components/landing/app-visual.tsx), not screenshots:
 * they stay sharp at any size, cost no bytes, take their colors straight from
 * CATEGORIES so they cannot drift from the real map, and - the reason that
 * matters most - they invent no vendor names or prices attached to one.
 *
 * SWAP POINT: to use real screenshots instead, replace the switch in
 * app-visual.tsx with an <img>. Capture them from a session that has DB
 * credentials, and check what is on screen before shipping it - a screenshot
 * reads as authoritative in a way an illustration does not.
 */
export type AppVisual = "map" | "filters" | "intel" | "reviews" | "hub";

export const HOW_SECTION = {
  eyebrow: "How it works",
  heading: "Three steps, on your phone, for free.",
} as const;

export interface HowStep {
  title: string;
  body: string;
  visual: AppVisual;
}

export const HOW_STEPS: HowStep[] = [
  {
    title: "Explore vendors in your wedding region",
    body: "Open the map where you are getting married and filter by the criteria that actually decide it for you.",
    visual: "map",
  },
  {
    title: "See real quotes, advice and feedback",
    body: "Open a vendor to read what couples were quoted, what the fine print covered, and how the day itself went.",
    visual: "reviews",
  },
  {
    title: "Save your favorites",
    body: "Keep every candidate in one hub, sorted by category, with your own notes and quotes alongside.",
    visual: "hub",
  },
];

/* -------------------------------------------------------------------------- */
/* Problem -> solution rows                                                    */
/* -------------------------------------------------------------------------- */

export const PROBLEMS_SECTION = {
  eyebrow: "Why this exists",
  heading: "Four things that are broken about choosing a wedding vendor.",
  /** Small labels over each half of a row, so which is which is never in doubt. */
  problemLabel: "The problem",
  solutionLabel: "On Wedding Recon",
} as const;

export interface Quote {
  /** Verbatim. Do not paraphrase a real person. */
  text: string;
  name: string;
  /** Wedding year and town, shown under the name. */
  context: string;
}

export interface ProblemSolution {
  /** What is broken about vendor selection today. */
  problem: string;
  quote: Quote;
  /** What Wedding Recon does about it. */
  solution: string;
  solutionBody: string;
  visual: AppVisual;
}

/**
 * The spine of the page: four things that are wrong with picking wedding
 * vendors, each in a real couple's words, each answered by something the
 * product does.
 *
 * Every quote is a real thing a real couple said, reproduced verbatim - these
 * are attributed testimonials, not illustrative copy, so the wording is not
 * ours to tidy. If one is ever cut for length, cut whole sentences from the end
 * rather than editing inside one, and never add words.
 *
 * All six people confirmed they are happy to be quoted publicly under a first
 * name, wedding year and town (Kiara, 2026-08-04). That consent covers the
 * wording as it stands; a NEW quote, or a new attribution, needs its own. Note
 * none of them names a vendor, which is what keeps an unflattering experience a
 * personal account rather than a claim about a named business - keep it so.
 *
 * A seventh quote is on file and unused, kept here so it is not lost:
 *
 *   Danielle, married 2024 in Boulder - "The florist was super nice and
 *   responsive ahead of time, but on the day-of, the arrangements were nothing
 *   like what we had discussed in the consult. They were objectively beautiful
 *   but contained flowers I specifically asked not to have."
 *
 * Danielle is a straight swap for Julia below (both are about quality only
 * showing up on the day), or a fifth row. Julia was picked so that no two rows
 * lean on the same vendor type: florist, hotel, music, planning.
 */
export const PROBLEM_SOLUTIONS: ProblemSolution[] = [
  {
    problem: "Pricing is rarely available online",
    quote: {
      text: "This would have saved me so much time and heartache... all the florists I was referred to had minimum spend of over $20k. I would have never bothered going to their site in the first place",
      name: "Erika",
      context: "married 2025, South Denver",
    },
    solution: "Real, filterable pricing from real couples",
    solutionBody:
      "Every recon entry carries the number a couple was actually quoted and the fine print underneath it, so you can rule a vendor in or out before you spend an evening on an inquiry form.",
    visual: "filters",
  },
  {
    problem: "Important details are hard to figure out",
    quote: {
      text: "For out of town guests, hotels were super hard and confusing to understand the cost of block rates",
      name: "Emily",
      context: "married 2026, Breckenridge",
    },
    solution: "Key intel, specific to each type of vendor",
    solutionBody:
      "What matters about a hotel block is not what matters about a florist. Each vendor type is researched against the things couples actually get caught out by - block terms, delivery radius, catering policy, travel fees.",
    visual: "intel",
  },
  {
    problem: "Quality is unknown until the big day",
    quote: {
      text: "The singer/DJ showed up late and didn't play any of the songs on our request list. The whole night was amazing but this was kind of crazy. And stressful.",
      name: "Julia",
      context: "married 2025, Buena Vista",
    },
    solution: "Feedback from couples who have been through it",
    solutionBody:
      "Recon is written after the fact, not from a sales page - what the tasting was like, whether they turned up on time, what the contract actually delivered.",
    visual: "reviews",
  },
  {
    problem: "Research is scattered across sites and tools",
    quote: {
      text: "Ours was such a mess. We had pages and pages of spreadsheets",
      name: "Wyatt",
      context: "married 2024, Colorado Springs",
    },
    solution: "One hub to manage every vendor candidate",
    solutionBody:
      "Save anyone you are considering to your Planning Hub, sorted by category, with your own quotes and notes attached. It replaces the spreadsheet, and it is private to you.",
    visual: "hub",
  },
];

/* -------------------------------------------------------------------------- */
/* Data highlight                                                             */
/* -------------------------------------------------------------------------- */

/**
 * STATIC, HAND-ENTERED FIGURES. Measured against the live DB on 2026-08-01 and
 * recorded in docs/vendor-filters-proposal.md; re-measure and update the date
 * when the directory grows materially.
 *
 * Deliberately not a live query. Reading the DB here would make `/` dynamic,
 * losing static generation on the one page whose whole job is to be fast and
 * crawlable - and it would render "0 vendors" whenever the free-tier project is
 * paused. Nothing on this page changes often enough to be worth that.
 *
 * The derived percentages come from regex over recon text at partial coverage,
 * so each one carries its base in `note`. Do not drop the note: a percentage
 * without its denominator is the difference between a fact and a claim. When
 * the filter tagging pipeline lands these become properly queryable and the
 * section can move to ISR.
 */
export const DATA_SECTION = {
  eyebrow: "Quick facts",
  /** Screen-reader label for the deck, and the hint under it. */
  carouselLabel: "Quick facts about the directory",
  carouselHint: "Swipe or use the arrows",
  headline: {
    vendors: "2,100+",
    vendorsLabel: "Colorado wedding vendors",
    types: "10",
    typesLabel: "categories, from venues to hotel blocks",
    recon: "3,100+",
    reconLabel: "recon entries on file",
  },
  measuredOn: "Measured August 2026",
  categoryChart: {
    title: "Vendors by category",
    subtitle: "Tap a row to open the map filtered to it.",
  },
  reconFact: {
    value: "3,100+",
    label: "recon entries on file",
    note: "Price quotes, notes and photos, collected from couples, reviews and vendor sites across Colorado.",
  },
  beautyChart: {
    title: "Hair and makeup: do they come to you?",
    subtitle:
      "A hard logistics constraint on the wedding morning, and the kind of detail no directory lists. Recorded from recon, not from how an artist markets themselves.",
  },
  medianVenue: {
    value: "$2,250",
    label: "median venue starting price",
    note: "Median of the 37% of venues with a published or reported starting figure. Site fee only - catering, bar and rentals sit on top.",
  },
  /**
   * Towns named so the page still carries them as search terms after the old
   * Colorado section was removed. No counts: per-town figures were never
   * measured, and inventing them to fill a chart is not on.
   */
  coverageTitle: "Across the Front Range and the mountain towns",
  coverageAreas: [
    "Denver",
    "Boulder",
    "Colorado Springs",
    "Fort Collins",
    "Golden",
    "Littleton",
    "Aurora",
    "Arvada",
    "Lakewood",
    "Longmont",
    "Loveland",
    "Morrison",
    "Evergreen",
    "Castle Rock",
    "Estes Park",
    "Breckenridge",
    "Vail",
    "Steamboat Springs",
  ],
} as const;

/** Vendor counts per category. Sums to 2,163 - the whole directory. */
export const VENDOR_COUNTS: { type: VendorType; count: number }[] = [
  { type: "venue", count: 679 },
  { type: "photos", count: 274 },
  { type: "hotel", count: 253 },
  { type: "flowers", count: 183 },
  { type: "beauty", count: 183 },
  { type: "food", count: 182 },
  { type: "planner", count: 148 },
  { type: "band", count: 119 },
  { type: "dj", count: 77 },
  { type: "dress", count: 65 },
];

/**
 * Where hair and makeup artists work: they travel to you, or you go to them.
 *
 * A real two-sided split, which is why this chart and not most of the other
 * attributes in the filter proposal. Both halves are explicitly detected in
 * recon text - 26% of the 151 artists with recon say on-location, 7% say
 * studio - so the ratio between them means something.
 *
 * Contrast with a ONE-SIDED detection like "shoots film", where only the yes
 * side is ever written down and silence is unknown rather than no. Publishing
 * one of those as a rate would assert something false about every undetected
 * vendor. Before adding a stat here, ask whether BOTH answers get recorded.
 *
 * `base` is the two-thirds of artists who say nothing either way, kept visible.
 * The filter tagging pipeline should raise it to ~90% and this can be redrawn
 * against the full type.
 */
export const BEAUTY_SETUP = {
  segments: [
    { label: "Comes to you", count: 39, pct: 78 },
    { label: "Studio only", count: 11, pct: 22 },
  ],
  base: "Of the 50 of 183 hair and makeup artists who state where they work. The rest have not said.",
} as const;

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export const FAQ_SECTION = {
  eyebrow: "Questions",
  heading: "Before you get started",
  /** The line under the accordion, before the mailto link. */
  footerPrompt: "Other questions or feedback?",
  footerLinkLabel: "Email Kiara, the founder",
} as const;

export interface FaqItem {
  question: string;
  /** PLAIN TEXT ONLY — also emitted as FAQPage structured data. See rule 3. */
  answer: string;
  /** Optional link rendered after the answer; omitted from structured data. */
  link?: { href: string; label: string };
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is Wedding Recon free?",
    answer:
      "Yes. Browsing, saving vendors, and posting your own recon are all free, there's no cost at all to use the site. This is simply a community-focused project.",
  },
  {
    question: "Do I need an account to use?",
    answer:
      "No. The map and every vendor page are public, and a link a friend sends you opens without signing up. An account is only needed to save vendors to your Planning Hub or post recon - and it is a magic link to your email, with no password to invent.",
  },
  {
    question: "Where do the prices come from?",
    answer:
      "From other couples. Each entry records what one couple was quoted, when they collected it, and how - online research, a call, or an in-person visit. Prices move with the date, the season, the guest count, and the package, so treat a recon entry as a starting range and confirm the details with the vendor directly.",
    link: { href: "/terms", label: "Read the full disclaimer" },
  },
  {
    question: "Which parts of Colorado are covered?",
    answer:
      "The Front Range is deepest - Denver, Boulder, Colorado Springs, Fort Collins and the surrounding towns - alongside the mountain venues couples travel to. Any vendor missing from the map can be added by anyone, so coverage follows wherever couples are actually searching.",
  },
  {
    question: "Can vendors pay to appear, or to change what is written about them?",
    answer:
      "No. There is no paid placement and there are no sponsored listings. Vendors appear because couples are researching them. If an entry is inaccurate or unfair, anyone can report it and it gets reviewed.",
  },
  {
    question: "What kinds of vendors are on here?",
    answer:
      "Venues, catering, photographers, florists, DJs, live music, bridal shops, hair and makeup, planners, and hotel room blocks - plus an open category for everything a wedding turns out to need.",
  },
  {
    question: "Is what I save private?",
    answer:
      "Your Planning Hub is yours alone - nobody else sees which vendors you have saved or what you are weighing up. Recon entries you post are public, shown under the anonymous username you pick when you sign up, never your email or your real name.",
  },
];

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                     */
/* -------------------------------------------------------------------------- */

export const CLOSING_CTA = {
  /** The sixth quote on file. Praise for the product rather than a problem, so
      it sits here rather than on a carousel card. Safe to delete. */
  quote: {
    text: "I needed a photographer. Wedding planning is so much work! So this is seriously so helpful",
    name: "Cassie",
    context: "2027 wedding, Larkspur",
  },
  heading: "Start with the map.",
  body: "See what vendors are near your target region and filter by your criteria. Read what other couples paid and how the vendor did. Save your favorites to narrow down your search.",
  cta: "Explore Colorado vendors",
} as const;

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

export const FOOTER = {
  blurb:
    "A community space for Colorado wedding vendor intel, built on quotes and real experiences from couples who went through it.",
  productHeading: "Product",
  aboutHeading: "About",
  exploreLabel: "Explore the map",
  addReconLabel: "Add recon",
  hubLabel: "Planning Hub",
  termsLabel: "Terms & disclaimer",
  contactLabel: "Contact",
  /** Appears after "© <year> Wedding Recon." at the very bottom. */
  disclaimer:
    "Recon entries are personal experiences shared by couples, not verified facts - always confirm pricing and details with the vendor.",
} as const;

export const CONTACT_EMAIL = "kiaramcnulty@gmail.com";
