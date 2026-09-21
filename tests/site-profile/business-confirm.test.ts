// Issue #926 — the done-when, asserted.
//
// "**Done when.** An item removed on Sunday is still gone after Monday's
// pass."
//
// That is a claim about two readings and a decision, and
// `@/lib/site-profile/business/confirm` is where the three meet. It is pure,
// so Monday's pass is a *second call with a different derived reading* —
// which is exactly what a refresh is, and what this file simulates without a
// database, a clock or a crawl.
//
// **Why that is the honest test and not a shortcut.** The alternative is to
// run the refresh and look in the table, which would assert that one code
// path remembered to check. What matters is stronger: there is no write the
// refresh could make that would bring the item back, because the derived row
// is overwritten whole and the decision is applied over whatever it now
// says. This file asserts that property.
import { describe, expect, it } from "vitest";
import {
  confirmedProfile,
  editsForLists,
  profileIsEmpty,
  quotableFacts,
  seenNow,
  type MarketReading,
} from "@/lib/site-profile/business/confirm";
import { NO_EDITS, type BusinessEdits } from "@/lib/site-profile/business/types";
import type { SiteProfile } from "@/lib/site-profile/types";

/** A derived reading, as a crawl writes one. Only the members the confirmed
 *  profile reads are filled; the rest are the shape's own empties. */
function profile(over: Partial<SiteProfile> = {}): SiteProfile {
  return {
    domain: "shop.example",
    siteName: "Shop",
    products: ["Basic service", "Full service"],
    claims: ["Price quoted first"],
    voice: {
      text: "Plain and specific.",
      tone: "Friendly",
      person: "We",
      vocabulary: ["tune-up"],
      claimsToKeep: ["90-day guarantee"],
      claimsToAvoid: ["Cheapest in town"],
    },
    inventory: [
      { url: "https://shop.example/pricing", title: "Prices", h1: "Prices", purpose: "pricing" },
      { url: "https://shop.example/about", title: "About", h1: "About", purpose: "about" },
      { url: "https://shop.example/p2", title: "P2", h1: "P2", purpose: "pricing" },
    ],
    pagesRead: 3,
    refreshedAt: new Date("2026-09-20T06:00:00.000Z"),
    ...over,
  };
}

const market: MarketReading = {
  job: "Service bikes",
  offeringType: "local service",
  audienceTerms: ["Commuters"],
  vocabulary: ["bike service"],
};

function edits(over: Partial<BusinessEdits> = {}): BusinessEdits {
  return { ...NO_EDITS, ...over };
}

const texts = (items: readonly { text: string }[]): string[] => items.map((item) => item.text);

describe("#926 done-when — an item removed on Sunday is still gone after Monday's pass", () => {
  it("a removed item is absent, and stays absent when the refresh reads it off the site again", () => {
    const sunday = edits({ removed: { products: ["Full service"] } });

    const before = confirmedProfile({ profile: profile(), market, edits: sunday });
    expect(texts(before.lists.products)).toEqual(["Basic service"]);

    // Monday. The pass reads the site again and writes the derived row whole
    // — the same two products, in the same order, plus one it has just
    // found. The decision is untouched, because nothing about a refresh
    // writes to it.
    const monday = confirmedProfile({
      profile: profile({ products: ["Basic service", "Full service", "Wheel truing"] }),
      market,
      edits: sunday,
    });
    expect(texts(monday.lists.products)).toEqual(["Basic service", "Wheel truing"]);
    expect(texts(monday.lists.products)).not.toContain("Full service");
  });

  it("an added item stays through a refresh that never reads it", () => {
    const stored = edits({ added: { products: ["Bike fitting"] } });
    const monday = confirmedProfile({
      profile: profile({ products: ["Basic service"] }),
      market,
      edits: stored,
    });
    expect(texts(monday.lists.products)).toEqual(["Basic service", "Bike fitting"]);
    expect(monday.lists.products.at(-1)?.source).toBe("yours");
  });

  it("an added item the site later states itself is one item, marked as the site's", () => {
    // The customer typed it before the crawl found it. Two rows for one fact
    // would give them two remove controls for one thing.
    const stored = edits({ added: { products: ["Wheel truing"] } });
    const after = confirmedProfile({
      profile: profile({ products: ["Basic service", "wheel truing"] }),
      market,
      edits: stored,
    });
    expect(texts(after.lists.products)).toEqual(["Basic service", "wheel truing"]);
    expect(after.lists.products).toHaveLength(2);
  });

  it("removing an item they added takes it out rather than recording a decision about the site", () => {
    // The panel's remove control does both halves; this asserts the half
    // `confirm.ts` is responsible for — that an added item removed by text
    // does not survive as an addition.
    const stored = edits({
      added: { products: ["Bike fitting"] },
      removed: { products: ["Bike fitting"] },
    });
    const after = confirmedProfile({ profile: profile(), market, edits: stored });
    expect(texts(after.lists.products)).not.toContain("Bike fitting");
  });
});

describe("#926 — the refresh may only add new findings as suggestions", () => {
  it("an item the customer has been shown is not new; one the pass has just found is", () => {
    const seen = seenNow({ profile: profile(), market });
    const stored = edits({ seen, removed: { products: [] } });

    const monday = confirmedProfile({
      profile: profile({ products: ["Basic service", "Full service", "Wheel truing"] }),
      market,
      edits: stored,
    });
    const marks = new Map(monday.lists.products.map((item) => [item.text, item.isNew]));
    expect(marks.get("Basic service")).toBe(false);
    expect(marks.get("Full service")).toBe(false);
    expect(marks.get("Wheel truing")).toBe(true);
  });

  it("a customer who has never been shown anything is greeted with no suggestions at all", () => {
    // Everything would technically be unseen. A screen of "new" badges on a
    // first read is noise, not information.
    const first = confirmedProfile({ profile: profile(), market, edits: NO_EDITS });
    expect(first.lists.products.every((item) => !item.isNew)).toBe(true);
  });

  it("`seenNow` records the derived reading, including what they removed", () => {
    // A removed item is still an item they have seen. Leaving it out would
    // make it new again the next time the crawl read it, which would mark a
    // decision they already made as a fresh finding.
    const seen = seenNow({ profile: profile(), market });
    expect(seen.products).toEqual(["Basic service", "Full service"]);
    expect(seen.audienceTerms).toEqual(["Commuters"]);
  });
});

describe("#926 — what you do is the customer's where they have reworded it", () => {
  it("their wording wins over the market reading, and says it is theirs", () => {
    const after = confirmedProfile({
      profile: profile(),
      market,
      edits: edits({ job: "Fix bikes for people who ride to work" }),
    });
    expect(after.job).toEqual({
      text: "Fix bikes for people who ride to work",
      source: "yours",
    });
  });

  it("clearing it returns the derived reading — which is the only way back", () => {
    const after = confirmedProfile({ profile: profile(), market, edits: edits({ job: null }) });
    expect(after.job).toEqual({ text: "Service bikes", source: "site" });
  });

  it("a site whose market has never been measured has no sentence at all, not an empty one", () => {
    const after = confirmedProfile({ profile: profile(), market: null, edits: NO_EDITS });
    expect(after.job).toBeNull();
    expect(after.offeringType).toBeNull();
    // #926: never a placeholder for a field the crawl does not have.
    expect(after.lists.audienceTerms).toEqual([]);
  });
});

describe("#926 — only fields the crawl stores, and nothing invented to fill one", () => {
  it("the words list is one list, the voice's and the market's deduplicated", () => {
    const after = confirmedProfile({
      profile: profile({
        voice: { ...profile().voice!, vocabulary: ["tune-up", "Bike service"] },
      }),
      market,
      edits: NO_EDITS,
    });
    // "Bike service" and the market's "bike service" are one word.
    expect(texts(after.lists.vocabulary)).toEqual(["tune-up", "Bike service"]);
  });

  it("a blank the crawl happened to store is not an item with a remove control", () => {
    const after = confirmedProfile({
      profile: profile({ products: ["Basic service", "   ", ""] }),
      market,
      edits: NO_EDITS,
    });
    expect(texts(after.lists.products)).toEqual(["Basic service"]);
  });

  it("the purposes are the crawl's own counts, and a purpose with no pages has no entry", () => {
    const after = confirmedProfile({ profile: profile(), market, edits: NO_EDITS });
    expect(after.purposes).toEqual([
      { purpose: "pricing", count: 2 },
      { purpose: "about", count: 1 },
    ]);
  });

  it("a site nobody has read is empty, and says so as one thing rather than nine", () => {
    const nothing = confirmedProfile({ profile: null, market: null, edits: NO_EDITS });
    expect(profileIsEmpty(nothing)).toBe(true);
    expect(nothing.pagesRead).toBeNull();
    expect(nothing.readAt).toBeNull();
  });

  it("a site that has been read is not empty", () => {
    expect(profileIsEmpty(confirmedProfile({ profile: profile(), market, edits: NO_EDITS }))).toBe(
      false
    );
  });
});

describe("#926 — facts we can quote", () => {
  const facts = [
    { passage: "A basic service is $85.", url: "https://shop.example/pricing" },
    { passage: "We quote first.", url: "https://shop.example/about" },
    { passage: "We quote first.", url: "https://shop.example/pricing" },
  ];

  it("counts how many of the site's pages carry each passage, and lists it once", () => {
    const quotable = quotableFacts({ facts, edits: NO_EDITS });
    expect(quotable).toHaveLength(2);
    expect(quotable[0]).toMatchObject({ passage: "A basic service is $85.", pages: 1, on: true });
    expect(quotable[1]).toMatchObject({ passage: "We quote first.", pages: 2, on: true });
  });

  it("keeps grounding's own order, which is the order a brief meets them", () => {
    const quotable = quotableFacts({ facts, edits: NO_EDITS });
    expect(quotable.map((fact) => fact.passage)).toEqual([
      "A basic service is $85.",
      "We quote first.",
    ]);
  });

  it("a switched-off fact is still listed, and says it is off", () => {
    // Listed, because the customer has to be able to switch it back on; off,
    // because a fact that vanished would look like a fact we lost.
    const quotable = quotableFacts({
      facts,
      edits: edits({ factsOff: ["We quote first."] }),
    });
    expect(quotable.find((fact) => fact.passage === "We quote first.")?.on).toBe(false);
    expect(quotable.find((fact) => fact.passage === "A basic service is $85.")?.on).toBe(true);
  });

  it("no measured page yielding a passage is an empty list, never a fabricated fact", () => {
    expect(quotableFacts({ facts: [], edits: NO_EDITS })).toEqual([]);
  });
});

describe("#970 — setup's step two hands over whole lists, and they store as decisions", () => {
  // Setup's step two lets a founder take items out and add their own, then
  // hands back what each list ended up holding. Settings records one press
  // at a time. Both end in the same row, which is the point of #970 — so
  // what is asserted here is the round trip: the lists a founder leaves are
  // the lists the other screen reads back.
  const both = (stored: BusinessEdits, chosen: Record<string, readonly string[]>) =>
    confirmedProfile({
      profile: profile(),
      market,
      edits: editsForLists({ stored, profile: profile(), market, chosen }),
    });

  it("the lists a founder leaves are the lists the other screen reads back", () => {
    const seen = both(NO_EDITS, {
      products: ["Full service", "Wheel truing"],
      claims: [],
    });
    expect(texts(seen.lists.products)).toEqual(["Full service", "Wheel truing"]);
    expect(texts(seen.lists.claims)).toEqual([]);
  });

  it("what they took out is a removal, so Monday's pass cannot put it back", () => {
    const stored = editsForLists({
      stored: NO_EDITS,
      profile: profile(),
      market,
      chosen: { products: ["Full service"] },
    });
    expect(stored.removed.products).toEqual(["Basic service"]);

    // Monday: the crawl reads the same two products off the site again.
    const monday = confirmedProfile({ profile: profile(), market, edits: stored });
    expect(texts(monday.lists.products)).toEqual(["Full service"]);
  });

  it("what they typed is theirs, and is marked as theirs", () => {
    const stored = editsForLists({
      stored: NO_EDITS,
      profile: profile(),
      market,
      chosen: { products: ["Basic service", "Full service", "Wheel truing"] },
    });
    expect(stored.added.products).toEqual(["Wheel truing"]);
    const shown = confirmedProfile({ profile: profile(), market, edits: stored });
    expect(shown.lists.products.at(-1)).toEqual({
      text: "Wheel truing",
      source: "yours",
      isNew: false,
    });
  });

  it("a list the step never showed is untouched, and so are the other decisions", () => {
    const stored = editsForLists({
      stored: edits({
        job: "Fix bikes properly",
        factsOff: ["We open at seven"],
        removed: { audienceTerms: ["Commuters"] },
        added: { claimsToAvoid: ["Cheapest in town"] },
      }),
      profile: profile(),
      market,
      chosen: { products: ["Full service"] },
    });
    expect(stored.job).toBe("Fix bikes properly");
    expect(stored.factsOff).toEqual(["We open at seven"]);
    expect(stored.removed.audienceTerms).toEqual(["Commuters"]);
    expect(stored.added.claimsToAvoid).toEqual(["Cheapest in town"]);
  });

  it("a standing removal of something the site no longer says is kept", () => {
    // They removed it last month; this month's crawl does not read it at
    // all, so it is not on the screen to be handed back. It must still be
    // removed, because next month's crawl may read it again.
    const stored = editsForLists({
      stored: edits({ removed: { products: ["Gone from the site"] } }),
      profile: profile(),
      market,
      chosen: { products: ["Basic service", "Full service"] },
    });
    expect(stored.removed.products).toEqual(["Gone from the site"]);
  });

  it("an item they put back is no longer removed", () => {
    const stored = editsForLists({
      stored: edits({ removed: { products: ["Basic service"] } }),
      profile: profile(),
      market,
      // The crawl still reads it, and this time they kept it.
      chosen: { products: ["Basic service", "Full service"] },
    });
    expect(stored.removed.products).toEqual([]);
    expect(texts(confirmedProfile({ profile: profile(), market, edits: stored }).lists.products)).toEqual([
      "Basic service",
      "Full service",
    ]);
  });
});
