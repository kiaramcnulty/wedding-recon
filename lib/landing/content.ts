import {
  Banknote,
  Bookmark,
  Map,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import type { VendorType } from "@/lib/constants/categories";

/**
 * ============================================================================
 * EVERY WORD ON THE LANDING PAGE LIVES IN THIS FILE.
 * ============================================================================
 *
 * The components under `components/landing/` and `app/page.tsx` are layout
 * only — they contain no sentences of their own. To reword the page, edit the
 * strings below and nothing else.
 *
 * Editing rules, all of which the build or a search engine will enforce:
 *
 * 1. Keep the quotes and the trailing commas. Text goes between the quotes.
 * 2. Use a typographic apostrophe (it is / does not) or escape a straight one
 *    (\'). An unescaped ' inside a '...' string breaks the build.
 * 3. FAQ `answer` must stay PLAIN TEXT with no markup — the same string is
 *    emitted as FAQPage structured data for Google, and a mismatch between the
 *    visible answer and the structured one is a policy violation. Use the
 *    optional `link` field if an answer needs a link.
 * 4. Nothing here may name a real vendor or attach a price to one. EXAMPLE_RECON
 *    is deliberately anonymous and badged "Example" on the page.
 * 5. Length guides where they matter are noted inline (META especially).
 *
 * Run `npm run build` after editing to catch a stray quote or comma.
 */

/* -------------------------------------------------------------------------- */
/* Search engine + social preview                                             */
/* -------------------------------------------------------------------------- */

export const META = {
  /**
   * The blue headline in Google results and the browser tab.
   * Google truncates around 60 characters — front-load the important words.
   * Current length is 88, so search results cut it after "…prices and intel, fr".
   */
  title:
    "Wedding Recon — Colorado wedding vendor prices and intel, from real couples' experiences",
  /**
   * The grey paragraph under the headline in Google results, and the preview
   * text when the link is shared. Google shows roughly 155 characters.
   * Current length is 302, so search results cut it around "…vendor feedba".
   * The planning-hub and free-to-use points fall outside what is displayed.
   */
  description:
    "See what Colorado couples were actually quoted for 10+ wedding vendor types: venues, catering, photography, florists and music. Explore local vendor feedback and intel from couples who went through it. Then keep your own quotes and notes in one planning hub. Free, no account needed to explore vendors.",
  /** Shorter title used for link previews (iMessage, X, Facebook). */
  socialTitle: "Wedding Recon — real Colorado wedding vendor prices and intel",
} as const;

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export const HEADER = {
  howItWorks: "How it works",
  faq: "FAQ",
  cta: "Explore the site",
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
    "Wedding Recon is a community of couples sharing their firsthand quotes, intel and experiences with wedding vendors. So you can find great-fit, in-budget vendors for your perfect day.",
  primaryCta: "Explore Colorado vendors",
  secondaryCta: "See how it works",
  reassurance: "Free to use. No account needed to explore vendors.",
} as const;

/**
 * The sample recon entry floating over the hero illustration.
 *
 * Intentionally anonymous. Naming a real business next to an invented quote
 * would be a fabricated review of someone's livelihood, so this stays a county
 * rather than a venue, and the page badges it "Example".
 */
export const EXAMPLE_RECON = {
  /**
   * Restored after being dropped in an edit (it is referenced by
   * hero-visual.tsx, so removing it breaks the build). It is also the only
   * thing on the page marking this card as illustrative: the price, the
   * package tier and the catering note below are invented, and an unlabelled
   * invented quote reads as a real recon entry. If the badge should go, remove
   * the element from hero-visual.tsx deliberately rather than the string here.
   */
  badge: "Example",
  category: "Venue",
  place: "Boulder County",
  price: "$8,400",
  priceDetail: "site fee · Saturday in September · DIY package tier",
  notes:
    "Ceremony site, chairs and the bridal suite are included. The bar minimum is separate — about $3.5k for 120 guests. Outside catering is allowed.",
  reconType: "In person",
  collected: "Collected Jun 2026",
} as const;

/* -------------------------------------------------------------------------- */
/* Why this exists                                                            */
/* -------------------------------------------------------------------------- */

export const WHY_SECTION = {
  eyebrow: "Why this exists",
  heading: "Planning a wedding means paying - in time and money - for the same research as other couples, over and over.",
} as const;

export interface ValueProp {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** The three problems, drawn from the product spec. */
export const VALUE_PROPS: ValueProp[] = [
  {
    icon: Banknote,
    title: "Nobody publishes a price",
    body: "Most venues will not quote you until you have filled in an inquiry form and driven out for a tour. That is hours per vendor before you learn whether they were ever in your budget. Recon entries carry the number someone was actually given, and the fine print underneath it.",
  },
  {
    icon: MessagesSquare,
    title: "The best tip comes from someone who just did this",
    body: "Couples book their band, their photographer, their caterer on a friend's say-so — because a friend who planned a wedding here last summer knows things no listing does. Not everyone has that friend. This is that conversation, written down and kept.",
  },
  {
    icon: Bookmark,
    title: "Your own research deserves better than a group chat",
    body: "Quotes end up in your inbox, notes in your phone, venue photos in a camera roll you never scroll back through. Your Planning Hub keeps saved vendors and everything you have learned in one list, sorted by category.",
  },
];

/** The dictionary-style definition box at the end of the section. */
export const RECON_GLOSS = {
  word: "re·con",
  partOfSpeech: "noun",
  definition:
    "Everything you learn touring venues, sitting through tastings, and prying a number out of a florist. Usually seen by exactly one couple.",
} as const;

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

export const HOW_SECTION = {
  eyebrow: "How it works",
  heading: "Three things, on your phone, for free.",
  /** Prefix for the numbered label above each step ("Step 1", "Step 2"…). */
  stepLabel: "Step",
} as const;

export interface HowItWorksStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: Map,
    title: "Explore local vendors",
    body: "Pan around Colorado and see what's out there. Filter by vendor type and type-specific filters (example: wedding venues under $10k with a mountain backdrop).",
  },
  {
    icon: ScrollText,
    title: "Read the recon",
    body: "Every vendor page collects entries from couples: the price quoted, the details behind it, notes on how it actually went, and photos. Each one is tagged by how it was gathered — online research, a call, or an in-person visit — and dated, so you can tell fresh intel from a number that has since moved.",
  },
  {
    icon: NotebookPen,
    title: "Add your own",
    body: "Save vendors you are considering to your Planning Hub, then log your own recon as you tour, taste, and negotiate. It keeps your search straight while you are in it — and it is what the next couple will be reading.",
  },
];

/* -------------------------------------------------------------------------- */
/* Category grid                                                              */
/* -------------------------------------------------------------------------- */

export const CATEGORIES_SECTION = {
  eyebrow: "What you can look up",
  heading: "Every vendor a Colorado wedding needs.",
  intro:
    "Pick a category to open the map filtered to it. Colours and icons are the same ones you will see on the pins.",
} as const;

/**
 * Names for the category tiles. The grid renders CATEGORY_PLURAL from
 * `lib/constants/categories.ts` by default — the noun that counts vendors reads
 * better in a list, and searches better, than the UI label ("photographers"
 * over "Photos").
 *
 * Only add an entry here to override one. These two are overridden because the
 * plural loses its meaning with no map around it: "hotels" drops the room-block
 * distinction that defines the category, and "vendors" reads like a peer of the
 * specific categories beside it rather than the catch-all it is.
 */
export const CATEGORY_GRID_LABEL: Partial<Record<VendorType, string>> = {
  hotel: "Hotel blocks",
  other: "Everything else",
};

/* -------------------------------------------------------------------------- */
/* Colorado coverage                                                          */
/* -------------------------------------------------------------------------- */

export const COLORADO_SECTION = {
  eyebrow: "Where we cover",
  heading: "Colorado first, on purpose.",
  body: [
    "A vendor directory is only useful where it is dense. One state covered properly beats fifty covered thinly, so Wedding Recon starts on the Front Range — Denver, Boulder, Colorado Springs, Fort Collins and the towns between them — and reaches out to the mountain venues couples travel for.",
    "Coverage grows as couples add recon. If the vendor you are looking at is not on the map yet, you can add them in a few taps, quote and all.",
  ],
} as const;

/**
 * The chip row of Colorado towns. Front Range first, then the mountain towns
 * people travel to for a wedding.
 *
 * Presented on the page as where couples are searching, NOT as a coverage
 * promise — the directory grows one category and one run at a time, and naming
 * a town with three pins in it is the fastest way to lose someone on their
 * first search. Add or remove freely; the row wraps to fit.
 */
export const COVERAGE_AREAS = [
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
] as const;

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export const FAQ_SECTION = {
  eyebrow: "Questions",
  heading: "Before you start clicking around.",
  /** The line under the accordion, before the mailto link. */
  footerPrompt: "Something else on your mind?",
  footerLinkLabel: "Email the person who built this",
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
      "Yes. Browsing, saving vendors, and posting your own recon are all free. There are no ads, no listing fees charged to vendors, and no commission on anything you book.",
  },
  {
    question: "Do I need an account to look around?",
    answer:
      "No. The map and every vendor page are public, and a link a friend sends you opens without signing up. An account is only needed to save vendors to your Planning Hub or post recon — and it is a magic link to your email, with no password to invent.",
  },
  {
    question: "Where do the prices come from?",
    answer:
      "From other couples. Each entry records what one couple was quoted, when they collected it, and how — online research, a call, or an in-person visit. Prices move with the date, the season, the guest count, and the package, so treat a recon entry as a starting range and confirm the details with the vendor directly.",
    link: { href: "/terms", label: "Read the full disclaimer" },
  },
  {
    question: "Which parts of Colorado are covered?",
    answer:
      "The Front Range is deepest — Denver, Boulder, Colorado Springs, Fort Collins and the surrounding towns — alongside the mountain venues couples travel to. Any vendor missing from the map can be added by anyone, so coverage follows wherever couples are actually searching.",
  },
  {
    question: "Can vendors pay to appear, or to change what is written about them?",
    answer:
      "No. There is no paid placement and there are no sponsored listings. Vendors appear because couples are researching them. If an entry is inaccurate or unfair, anyone can report it and it gets reviewed.",
  },
  {
    question: "What kinds of vendors are on here?",
    answer:
      "Venues, catering, photographers, florists, DJs, live music, bridal shops, hair and makeup, planners, and hotel room blocks — plus an open category for everything a wedding turns out to need.",
  },
  {
    question: "Is what I save private?",
    answer:
      "Your Planning Hub is yours alone — nobody else sees which vendors you have saved or what you are weighing up. Recon entries you post are public, shown under the anonymous username you pick when you sign up, never your email or your real name.",
  },
];

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                     */
/* -------------------------------------------------------------------------- */

export const CLOSING_CTA = {
  heading: "Start with the map.",
  body: "See who is near your date's hometown, read what other couples paid, and keep the rest of your search in one place.",
  cta: "Explore Colorado vendors",
} as const;

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

export const FOOTER = {
  blurb:
    "A community directory of Colorado wedding vendors, built on the price quotes and notes couples share with each other.",
  productHeading: "Product",
  aboutHeading: "About",
  exploreLabel: "Explore the map",
  addReconLabel: "Add recon",
  hubLabel: "Planning Hub",
  termsLabel: "Terms & disclaimer",
  contactLabel: "Contact",
  /** Appears after "© <year> Wedding Recon." at the very bottom. */
  disclaimer:
    "Recon entries are personal experiences shared by couples, not verified facts — always confirm pricing and details with the vendor.",
} as const;

export const CONTACT_EMAIL = "kiaramcnulty@gmail.com";
