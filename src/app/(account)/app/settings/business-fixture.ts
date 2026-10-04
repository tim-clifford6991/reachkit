// Issue #926 — the reserved fixture account's business profile.
//
// The same branch, and the same reason, `./fixture.ts` states for the rest
// of Settings (#228): `example.com` is IANA-reserved, so no customer can
// hold the name that reaches these facts, and the layout sweep, the review
// gallery and the cold-start sweep all render the screen through it. Without
// it every one of those would photograph the *unread* arm — a correct
// screen, and not the one a reviewer needs to look at.
//
// **Every value here is shaped exactly as a crawl writes it**, because that
// is the only thing a fixture may be: `products` and `claims` are the site's
// own words, the voice is the five-member summary the model returns, the
// inventory rows are pages with one purpose each, and the market reading is
// the four fields #926 names. Nothing is a sentence the product speaks — the
// screen's own words are registry keys, and none of them is here.
import type { SiteProfile } from "@/lib/site-profile/types";
import type { MarketReading } from "@/lib/site-profile/business/confirm";
import type { StoredKnowledge } from "@/lib/site-profile/knowledge/types";

/** The instant the fixture's site was last read. A fixed date, like every
 *  other date in the fixture set: a relative one would make the screen's
 *  "last read" line move under the sweep's own frozen clock. */
const READ_AT = new Date("2026-09-14T06:00:00.000Z");

export const FIXTURE_BUSINESS_PROFILE: SiteProfile = Object.freeze({
  domain: "example.com",
  siteName: "Harbour Bike Repair",
  products: Object.freeze([
    "Basic service",
    "Standard service",
    "Full service",
    "Puncture repair",
    "Bike fitting",
    "E-bike servicing",
    "Wheel truing",
  ]),
  claims: Object.freeze([
    "Full price quoted before work starts",
    "Same-day service when dropped off by 10am",
    "Every repair guaranteed for 90 days",
  ]),
  voice: Object.freeze({
    text: "Plain, unhurried and specific about prices. Talks to riders who use their bikes to get to work.",
    tone: "Friendly and direct",
    person: "We",
    vocabulary: Object.freeze(["tune-up", "drivetrain", "truing", "on the stand", "bottom bracket"]),
    claimsToKeep: Object.freeze(["Prices quoted before work starts", "90-day guarantee"]),
    claimsToAvoid: Object.freeze(["Cheapest in town", "Same-day on every repair"]),
  }),
  inventory: Object.freeze([
    { url: "https://example.com/pricing", title: "Prices", h1: "What a service costs", purpose: "pricing" as const },
    { url: "https://example.com/book", title: "Book a service", h1: "Book your bike in", purpose: "product" as const },
    { url: "https://example.com/about", title: "About us", h1: "The workshop", purpose: "about" as const },
    { url: "https://example.com/e-bikes", title: "E-bike servicing", h1: "E-bike servicing", purpose: "features" as const },
    { url: "https://example.com/blog/winter", title: "Winter drivetrain care", h1: "Winter drivetrain care", purpose: "blog" as const },
    { url: "https://example.com/contact", title: "Contact", h1: "Find us", purpose: "contact" as const },
  ]),
  pagesRead: 14,
  refreshedAt: READ_AT,
});

export const FIXTURE_MARKET_READING: MarketReading = Object.freeze({
  job: "Service and repair bikes for people who ride them every day",
  offeringType: "local service",
  audienceTerms: Object.freeze(["Daily commuters", "Families", "E-bike owners"]),
  vocabulary: Object.freeze(["bike service", "bike repair", "commuter"]),
});

/** The passages the grounding read would offer, in the order it offers
 *  them, with the page each was read from. Shaped as
 *  `src/lib/generate/pipeline/grounding.ts` returns them — one passage per
 *  page per round — so the screen's ordering and its per-passage page count
 *  are exercised rather than assumed. */
export const FIXTURE_QUOTABLE: readonly { passage: string; url: string }[] = Object.freeze([
  {
    passage: "A basic service is $85 and takes about two hours.",
    url: "https://example.com/pricing",
  },
  {
    passage: "We quote the full price before we pick up a tool.",
    url: "https://example.com/about",
  },
  {
    passage: "Drop your bike off before 10am and it goes out the same day.",
    url: "https://example.com/book",
  },
  // The same sentence on a second page — a fact the site repeats, which is
  // what the screen's page count is for.
  {
    passage: "We quote the full price before we pick up a tool.",
    url: "https://example.com/pricing",
  },
]);

/** The knowledge base the fixture's read stored (#1133): two pages, in the
 *  shape `site_profiles.knowledge` holds. */
export const FIXTURE_KNOWLEDGE: StoredKnowledge = Object.freeze({
  pages: [
    {
      url: "https://example.com/pricing",
      hash: "fixture-pricing",
      reading: {
        offerings: [
          {
            name: "Basic service",
            features: ["Gears and brakes adjusted", "Drivetrain cleaned"],
            prices: ["$85"],
            uses: ["A bike ridden to work every day"],
          },
          { name: "Full service", features: ["Stripped, cleaned and rebuilt"], prices: ["$190"], uses: [] },
        ],
        audience: ["Daily commuters"],
        problems: ["A bike that slips gears on the way to work"],
        differentiators: [{ rival: null, text: "We quote the full price before we pick up a tool." }],
        proof: [],
        questions: ["How long does a service take?"],
        integrations: [],
        places: [],
      },
    },
    {
      url: "https://example.com/about",
      hash: "fixture-about",
      reading: {
        offerings: [],
        audience: ["E-bike owners"],
        problems: [],
        differentiators: [],
        proof: ["Every repair guaranteed for 90 days"],
        questions: [],
        integrations: [],
        places: ["Harbour district"],
      },
    },
  ],
  readAt: READ_AT.toISOString(),
  demoPhrases: [],
});
