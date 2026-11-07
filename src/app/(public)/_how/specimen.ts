// The two example businesses How it works draws: a local plumber and a
// software firm, so every visual holds for either kind of customer. Values
// only: what ReachKit itself says is in the copy registry (`how.*`). Every
// domain ends in `.example`, so no stranger's site is ever drawn.
import type { CopyKey } from "@/lib/presentation/copy";
import type { BusinessKind } from "@/lib/market/kinds";

export type ExampleKind = "plumber" | "software";

/** Why a question is kept or skipped, in ReachKit's words. */
export type Reason = "rival" | "fits" | "gap" | "update" | "off";

export const REASON_COPY: Readonly<Record<Reason, CopyKey>> = {
  rival: "how.reason.rival",
  fits: "how.reason.fits",
  gap: "how.reason.gap",
  update: "how.reason.update",
  off: "how.reason.off",
};

export interface PlannedDay {
  readonly kind: "new" | "update" | "skip";
  readonly title: string;
  readonly reason: string;
  readonly state: "live" | "waiting" | "planned";
}

export interface Example {
  readonly business: string;
  readonly site: string;
  readonly blog: string;
  /** Who searches, as the visuals' headings say it. */
  readonly buyers: string;
  /** Where the example page's business works, as its eyebrow says it. */
  readonly place: string;
  readonly pagesRead: number;
  readonly read: {
    /** How it sells, named apart from what it sells. */
    readonly kind: BusinessKind;
    readonly sell: readonly [string, string];
    readonly buyers: readonly [string, string];
    readonly where: readonly [string, string];
    readonly language: string;
  };
  readonly search: string;
  readonly results: readonly { readonly name: string; readonly url: string; readonly title: string }[];
  readonly question: string;
  readonly answer: string;
  readonly mentioned: readonly string[];
  readonly tally: { readonly n: number; readonly total: number };
  /** The competitors watched every Monday, as their chips read. */
  readonly watched: readonly string[];
  readonly questions: readonly { readonly search: string; readonly volume: number; readonly reason: Reason }[];
  /** Monday to Sunday. */
  readonly plan: readonly PlannedDay[];
  readonly pagePath: string;
  readonly page: {
    readonly title: string;
    /** Paragraphs of the page; a fact carries the path it came from, a plain sentence `null`. */
    readonly paragraphs: readonly (readonly { readonly text: string; readonly source: string | null }[])[];
    readonly never: string;
  };
  readonly mail: {
    readonly live: number;
    readonly planned: number;
    /** Why each of the week's first two pages was planned, as the email says it. */
    readonly why: readonly [string, string];
  };
  /** The page Your part shows going live by itself. */
  readonly partPage: string;
  readonly report: {
    readonly score: number;
    readonly mentioned: number;
    readonly asked: number;
    readonly missing: number;
    /** Who buyers pick instead, the leader first. */
    readonly rivals: readonly string[];
    /** The first page the report proposes, free. */
    readonly firstPage: string;
  };
}

const HARBOR: Example = {
  business: "Harbor Plumbing",
  site: "harborplumbing.example",
  blog: "help.harborplumbing.example",
  buyers: "Austin buyers",
  place: "Austin",
  pagesRead: 38,
  read: {
    kind: "local-service",
    sell: ["Plumbing repair, water heaters and drain cleaning for homes", "/services"],
    buyers: ["Homeowners", "/about"],
    where: ["In and around Austin, Texas", "/service-area"],
    language: "English, United States",
  },
  search: "emergency plumber austin",
  results: [
    { name: "A national plumbing chain", url: "a national chain’s site › austin", title: "24/7 Emergency Plumbers in Austin, TX" },
    { name: "Austin Pipeworks", url: "austinpipeworks.example", title: "Emergency Plumbing Service, Same Day" },
    { name: "Capitol Rooter", url: "capitolrooter.example", title: "Austin Emergency Rooter and Plumbing" },
  ],
  question: "Who’s a good emergency plumber in Austin?",
  answer:
    "For a burst pipe or no hot water, many Austin homeowners call Austin Pipeworks or Capitol Rooter. Both offer call-outs around the clock.",
  mentioned: ["austinpipeworks.example", "capitolrooter.example"],
  tally: { n: 1, total: 12 },
  watched: ["a national plumbing chain", "austinpipeworks.example", "capitolrooter.example"],
  questions: [
    { search: "water heater repair austin", volume: 1300, reason: "rival" },
    { search: "drain cleaning austin", volume: 880, reason: "fits" },
    { search: "slab leak repair cost austin", volume: 480, reason: "gap" },
    { search: "tankless water heater installation austin", volume: 390, reason: "update" },
    { search: "plumbing jokes", volume: 2400, reason: "off" },
  ],
  plan: [
    { kind: "new", title: "Emergency plumber in Austin: what to do in the first hour", reason: "AI answers link to a competitor for this.", state: "live" },
    { kind: "update", title: "Toilet repair in Austin: running, leaking or clogged", reason: "Stopped gaining at place 18 for 3 weeks.", state: "waiting" },
    { kind: "new", title: "How much does slab leak repair cost in Austin?", reason: "Buyers ask this before they call.", state: "planned" },
    { kind: "update", title: "Drain cleaning in Austin: prices and what’s included", reason: "A competitor answers this today.", state: "planned" },
    { kind: "new", title: "Why a water heater pops, and when to call", reason: "Asked to AI every week.", state: "planned" },
    { kind: "update", title: "Water heater repair in Austin", reason: "Your page is far down; update it.", state: "planned" },
    { kind: "skip", title: "", reason: "", state: "planned" },
  ],
  pagePath: "/slab-leak-repair-cost",
  page: {
    title: "How much does slab leak repair cost in Austin?",
    paragraphs: [
      [
        { text: "Harbor Plumbing finds a slab leak with listening equipment before opening any floor.", source: "/slab-leaks" },
        { text: "The price depends on where the leak is and how it is reached.", source: null },
        { text: "Every job starts with a written quote, before any work begins.", source: "/about" },
      ],
      [{ text: "Most slab leak repairs are finished in one day.", source: "/services" }],
    ],
    never: "“Austin’s cheapest plumber”",
  },
  mail: {
    live: 12,
    planned: 7,
    why: [
      "your core service; AI answers link to a competitor for it",
      "stopped gaining at place 18 for 3 weeks; this update adds what the pages above it cover",
    ],
  },
  partPage: "Tankless water heater installation in Austin",
  report: {
    score: 27,
    mentioned: 1,
    asked: 12,
    missing: 14,
    rivals: ["austinpipeworks.example", "capitolrooter.example", "a national plumbing chain"],
    firstPage: "Slab leak repair cost in Austin",
  },
};

const TIDYSLOT: Example = {
  business: "Tidyslot",
  site: "tidyslot.example",
  blog: "blog.tidyslot.example",
  buyers: "team leads",
  place: "online",
  pagesRead: 54,
  read: {
    kind: "software",
    sell: ["Booking software for small teams", "/product"],
    buyers: ["Team leads at small firms", "/customers"],
    where: ["Online, US and UK", "/pricing"],
    language: "English, United States",
  },
  search: "how to stop double bookings",
  results: [
    { name: "Bookwell", url: "bookwell.example", title: "Stop Double Bookings for Good" },
    { name: "Slotly", url: "slotly.example", title: "Double Booking: Causes and Fixes" },
    { name: "A software review site", url: "reviews.example", title: "Best Booking Apps for Teams" },
  ],
  question: "What’s the best booking app for a small team?",
  answer: "Many small teams use Bookwell or Slotly. Both sync with Outlook and Google and send reminders.",
  mentioned: ["bookwell.example", "slotly.example"],
  tally: { n: 0, total: 12 },
  watched: ["bookwell.example", "slotly.example", "a software review site"],
  questions: [
    { search: "calendar booking for teams", volume: 1900, reason: "rival" },
    { search: "how to stop double bookings", volume: 720, reason: "gap" },
    { search: "booking link for outlook", volume: 590, reason: "fits" },
    { search: "round robin booking", volume: 320, reason: "update" },
    { search: "booking jokes", volume: 1100, reason: "off" },
  ],
  plan: [
    { kind: "new", title: "How to stop double bookings across Outlook and Google", reason: "AI answers link to a competitor for this.", state: "live" },
    { kind: "update", title: "Round-robin booking, explained", reason: "Stopped gaining at place 18 for 3 weeks.", state: "waiting" },
    { kind: "new", title: "How to cut no-shows with reminders", reason: "Buyers ask this before they choose.", state: "planned" },
    { kind: "update", title: "Booking software pricing for small teams", reason: "A competitor answers this today.", state: "planned" },
    { kind: "new", title: "Shared team availability in one link", reason: "Asked to AI every week.", state: "planned" },
    { kind: "update", title: "Booking links for teams", reason: "Your page is far down; update it.", state: "planned" },
    { kind: "skip", title: "", reason: "", state: "planned" },
  ],
  pagePath: "/stop-double-bookings",
  page: {
    title: "How to stop double bookings across Outlook and Google",
    paragraphs: [
      [
        { text: "Tidyslot checks every connected diary before it offers a time.", source: "/product" },
        { text: "How fast it syncs depends on the diaries you connect.", source: null },
        { text: "A booking made in one diary blocks the same slot in the others.", source: "/product/sync" },
      ],
      [{ text: "Setup takes one sign-in per diary.", source: "/help/connect" }],
    ],
    never: "“The only tool that never double-books”",
  },
  mail: {
    live: 12,
    planned: 7,
    why: [
      "your core feature; AI answers link to a competitor for it",
      "stopped gaining at place 18 for 3 weeks; this update adds what the pages above it cover",
    ],
  },
  partPage: "Booking links for teams: what to look for",
  report: {
    score: 31,
    mentioned: 0,
    asked: 12,
    missing: 11,
    rivals: ["bookwell.example", "slotly.example", "a software review site"],
    firstPage: "How to stop double bookings across Outlook and Google",
  },
};

export const EXAMPLES: Readonly<Record<ExampleKind, Example>> = { plumber: HARBOR, software: TIDYSLOT };

/** The hour a page goes live, as the landing's week shows it. */
export const LIVE_AT = "4:00 PM";

/** A fixed Monday, so the drawn week's dates never move. */
const WEEK_MONDAY = Date.UTC(2026, 9, 19);

/** Monday to Sunday of the drawn week, as "Mon 19". */
export function weekDays(): readonly string[] {
  return Array.from({ length: 7 }, (_, day) => {
    const date = new Date(WEEK_MONDAY + day * 86_400_000);
    const name = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return `${name} ${date.getUTCDate()}`;
  });
}

/** One day of the drawn week with its month, as "Tue 20 Oct". */
export function weekDate(day: number): string {
  const month = new Date(WEEK_MONDAY).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekDays()[day]} ${month}`;
}

/** The drawn week's span and the Monday's date, with the month: "Mon 19 – Sun 25 Oct". */
export function weekSpan(): { readonly range: string; readonly monday: string } {
  const monday = weekDate(0);
  return { range: `${weekDays()[0]} – ${weekDate(6)}`, monday };
}

/** The published benchmark the value comparison quotes, shown with its
 *  source: Ahrefs, "SEO Pricing", 439 providers polled, updated 2024-08-15. */
export const AGENCY_BENCHMARK = Object.freeze({
  fee: "$501–$1,000",
  /** The same fee on the cost chart's scale, in dollars a month. */
  low: 501,
  high: 1000,
  providers: 439,
  year: 2024,
  url: "https://ahrefs.com/blog/seo-pricing/",
});
