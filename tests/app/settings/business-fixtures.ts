// Two customers for Settings › Your business, a local plumber and a SaaS, shaped
// as a crawl stores them and run through the provider's own pure functions.
import { confirmedProfile, quotableFacts, type MarketReading } from "@/lib/site-profile/business/confirm";
import { NO_EDITS, type BusinessProfile, type QuotableFact } from "@/lib/site-profile/business/types";
import { knowledgeBase } from "@/lib/site-profile/knowledge/merge";
import type { KnowledgeBase, StoredKnowledge } from "@/lib/site-profile/knowledge/types";
import type { SiteProfile } from "@/lib/site-profile/types";
import type { LivePage } from "@/app/(account)/app/settings/on-a-page";

export interface Customer {
  name: string;
  profile: BusinessProfile;
  facts: QuotableFact[];
  knowledge: KnowledgeBase;
  livePages: LivePage[];
  /** One stored promise and one stored word, as the screen should draw them. */
  promise: string;
  word: string;
  product: string;
}

const READ_AT = new Date("2026-10-12T06:00:00.000Z");

function reading(r: Partial<StoredKnowledge["pages"][number]["reading"]>): StoredKnowledge["pages"][number]["reading"] {
  return { offerings: [], audience: [], problems: [], differentiators: [], proof: [], questions: [], integrations: [], places: [], ...r };
}

function customer(a: {
  site: SiteProfile;
  market: MarketReading;
  quotable: { passage: string; url: string }[];
  knowledge: StoredKnowledge;
  livePages: LivePage[];
  promise: string;
  word: string;
  product: string;
}): Customer {
  return {
    name: a.site.siteName!,
    profile: confirmedProfile({ profile: a.site, market: a.market, edits: NO_EDITS }),
    facts: quotableFacts({ facts: a.quotable, edits: NO_EDITS }),
    knowledge: knowledgeBase({ stored: a.knowledge, answers: {} }),
    livePages: a.livePages,
    promise: a.promise,
    word: a.word,
    product: a.product,
  };
}

export const PLUMBER = customer({
  site: {
    domain: "harborplumbing.example",
    siteName: "Harbor Plumbing",
    products: ["Emergency plumbing", "Drain cleaning", "Water heaters", "Repiping"],
    claims: ["Licensed in Texas", "Upfront prices before work starts"],
    voice: {
      text: "Plain and practical.",
      tone: "Plain, calm and practical",
      person: "We",
      vocabulary: ["tankless", "slab leak", "shut-off valve"],
      claimsToKeep: [],
      claimsToAvoid: [],
    },
    inventory: [{ url: "https://harborplumbing.example/about", title: "About", h1: "About us", purpose: "about" }],
    pagesRead: 34,
    refreshedAt: READ_AT,
  },
  market: {
    job: "Plumbing repair, drain cleaning and water heater work for homes in Austin.",
    offeringType: "Local service business",
    audienceTerms: ["Homeowners in Austin", "Landlords"],
    vocabulary: [],
  },
  quotable: [
    { passage: "We give you the price before we start.", url: "https://harborplumbing.example/" },
    { passage: "We give you the price before we start.", url: "https://harborplumbing.example/pricing" },
    { passage: "We give you the price before we start.", url: "https://harborplumbing.example/about" },
    { passage: "Licensed master plumber, Texas license on file.", url: "https://harborplumbing.example/about" },
  ],
  knowledge: {
    pages: [
      {
        url: "https://harborplumbing.example/",
        hash: "home",
        reading: reading({
          problems: ["Burst pipes, blocked drains, no hot water, slab leaks"],
          differentiators: [{ rival: null, text: "Prices given before work starts" }],
          questions: ["How fast can you come?"],
          places: ["Austin, Round Rock, Pflugerville"],
        }),
      },
    ],
    readAt: READ_AT.toISOString(),
    demoPhrases: [],
  },
  livePages: [
    {
      url: "https://harborplumbing.example/blog/tankless-water-heater-installation",
      title: "Tankless water heater installation in Austin",
      markdown:
        "# Tankless water heater installation in Austin\n\nMost tankless swaps take one day. Upfront prices before work starts, always.\n",
      publishedAt: new Date("2026-10-20T21:00:00.000Z"),
    },
  ],
  promise: "Upfront prices before work starts",
  word: "tankless",
  product: "Repiping",
});

export const SAAS = customer({
  site: {
    domain: "ledgerly.example",
    siteName: "Ledgerly",
    products: ["Recurring invoices", "Expense tracking"],
    claims: ["Set up in ten minutes"],
    voice: {
      text: "Direct, for owners who hate admin.",
      tone: "Direct and friendly",
      person: "We",
      vocabulary: ["reconcile", "payment reminder"],
      claimsToKeep: [],
      claimsToAvoid: [],
    },
    inventory: [{ url: "https://ledgerly.example/pricing", title: "Pricing", h1: "Pricing", purpose: "pricing" }],
    pagesRead: 61,
    refreshedAt: new Date("2026-09-30T08:00:00.000Z"),
  },
  market: {
    job: "Invoicing software for small agencies.",
    offeringType: "SaaS",
    audienceTerms: ["Agency owners"],
    vocabulary: [],
  },
  quotable: [{ passage: "Invoices go out on the first of the month.", url: "https://ledgerly.example/features" }],
  knowledge: {
    pages: [
      {
        url: "https://ledgerly.example/features",
        hash: "features",
        reading: reading({
          problems: ["Chasing late payments by hand"],
          differentiators: [{ rival: "Xero", text: "Reminders written in your own words" }],
          questions: ["Does it work with Stripe?"],
          integrations: ["Stripe"],
        }),
      },
    ],
    readAt: "2026-09-30T08:00:00.000Z",
    demoPhrases: [],
  },
  livePages: [
    {
      url: "https://blog.ledgerly.example/late-invoices",
      title: "How to stop chasing late invoices",
      markdown: "Late invoices cost agencies a week a year. A payment reminder that goes out on day one halves that.\n",
      publishedAt: new Date("2026-10-01T12:00:00.000Z"),
    },
  ],
  promise: "Set up in ten minutes",
  word: "payment reminder",
  product: "Expense tracking",
});

export const CUSTOMERS = [PLUMBER, SAAS] as const;
