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
 * All landing-page copy, in one file.
 *
 * The page components are layout only — every user-visible sentence lives here
 * so wording can be revised without reading JSX. Two consumers depend on the
 * shape: FAQ_ITEMS renders the accordion *and* the FAQPage JSON-LD (which is
 * why `answer` stays a plain string — structured data can't carry markup), and
 * COVERAGE_AREAS is both the chip row and the page's Colorado body text.
 */

/** The region the product is positioned around. Soft-launch market: Denver, CO. */
export const MARKET = "Colorado";

export const HERO = {
  eyebrow: "Colorado wedding vendors",
  heading: "Real prices from real Colorado weddings.",
  subheading:
    "Wedding Recon is where engaged couples pool the quotes, notes, and photos they collect while vendor shopping — so you can find out what a venue costs before you drive out for the tour.",
  primaryCta: "Explore Colorado vendors",
  secondaryCta: "See how it works",
  reassurance: "Free to use. No account needed to browse.",
} as const;

/**
 * The dictionary gloss under the "why" section. Lifted from how the product
 * actually talks about itself — the word "recon" is doing real work and is
 * worth defining once, plainly.
 */
export const RECON_GLOSS = {
  word: "re·con",
  partOfSpeech: "noun",
  definition:
    "Everything you learn touring venues, sitting through tastings, and prying a number out of a florist. Usually seen by exactly one couple.",
} as const;

export interface ValueProp {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** Why the product exists — the three problems, straight from the spec. */
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

export interface HowItWorksStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: Map,
    title: "Explore the map",
    body: "Pan around Colorado and see who is out there. Pins are colour-coded by category, so a cluster of venues near your date's hometown reads at a glance. Tap a pin for a peek, tap the card to open the vendor.",
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

/**
 * Colorado towns couples search in. Front Range first (where the directory is
 * deepest), then the mountain towns people travel to for a wedding.
 *
 * Framed on the page as where couples are looking, NOT as a coverage promise —
 * the directory grows by category and by run, and overclaiming a town we have
 * three pins in is the fastest way to lose someone on their first search.
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

export const COLORADO_SECTION = {
  heading: "Colorado first, on purpose.",
  body: [
    "A vendor directory is only useful where it is dense. One state covered properly beats fifty covered thinly, so Wedding Recon starts on the Front Range — Denver, Boulder, Colorado Springs, Fort Collins and the towns between them — and reaches out to the mountain venues couples travel for.",
    "Coverage grows as couples add recon. If the vendor you are looking at is not on the map yet, you can add them in a few taps, quote and all.",
  ],
} as const;

/**
 * Names for the category grid. It renders CATEGORY_PLURAL by default — the noun
 * that counts vendors reads better in a list, and searches better, than the UI
 * label ("photographers" over "Photos"). These two are overridden because the
 * plural loses its meaning with no map around it: "hotels" drops the room-block
 * distinction that defines the category, and "vendors" reads like a peer of the
 * specific categories beside it rather than the catch-all it is.
 */
export const CATEGORY_GRID_LABEL: Partial<Record<VendorType, string>> = {
  hotel: "Hotel blocks",
  other: "Everything else",
};

export interface FaqItem {
  question: string;
  /** Plain text — this string is also emitted as FAQPage structured data. */
  answer: string;
  /** Optional trailing link, rendered after the answer and omitted from JSON-LD. */
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

export const CLOSING_CTA = {
  heading: "Start with the map.",
  body: "See who is near your date's hometown, read what other couples paid, and keep the rest of your search in one place.",
  cta: "Explore Colorado vendors",
} as const;

export const CONTACT_EMAIL = "kiaramcnulty@gmail.com";
