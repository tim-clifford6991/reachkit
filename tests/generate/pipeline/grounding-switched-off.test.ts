// tests/generate/pipeline/grounding-switched-off.test.ts — issue #927
//
// **A fact the customer switched off is never quoted.**
//
// #926 gave them the switch on Settings › Your business; this is the half
// that makes it mean something. Three pieces, and this file holds the two
// that can be asserted purely:
//
//   1. `allowedFacts` subtracts a refused passage — a pure filter, so no
//      database, no clock and no mock at all;
//   2. `confirmedForWriting` returns the refusals beside the profile, which
//      is what makes the draft path one read rather than two.
//
// The third is that the writer actually subtracts them, which is asserted
// end to end in `./generate.test.ts` — the suite that already stands up the
// pipeline — and structurally by `tests/build/grounding-callers.test.ts`,
// which holds every quoting path to this filter.
//
// **Why the filter takes the list rather than reading it.** The first draft
// of this read the customer's decisions inside the grounding module, and it
// was wrong twice: it put a database behind every reader of that module —
// including the Settings screen, the opportunities store, and a suite about
// passage *ordering* that has no business standing one up — and it read the
// same row twice on the draft path, since the caller already reads it for
// the profile. Fifty-two tests said so.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { allowedFacts } from "../../../src/lib/generate/pipeline/grounding";

const MEASURED_AT = new Date("2026-09-14T06:00:00.000Z");
const BASIC = "A basic service is $85 and takes about two hours.";
const QUOTE = "We quote the full price before we pick up a tool.";

/** Two passages of the customer's own page, as the grounding read answers
 *  them. */
const FACTS = [
  {
    fact: { url: "https://harbourbikes.example/pricing", readAt: MEASURED_AT, passage: BASIC },
    sourceText: `${BASIC} ${QUOTE}`,
  },
  {
    fact: { url: "https://harbourbikes.example/pricing", readAt: MEASURED_AT, passage: QUOTE },
    sourceText: `${BASIC} ${QUOTE}`,
  },
];

const passages = (facts: readonly { fact: { passage: string } }[]): string[] =>
  facts.map((sourced) => sourced.fact.passage);

const { readingsMock } = vi.hoisted(() => ({ readingsMock: vi.fn() }));
vi.mock("@/lib/site-profile/business/confirmed", () => ({
  readConfirmedBusiness: readingsMock,
}));

const NO_EDITS = {
  removed: {},
  added: {},
  job: null,
  seen: {},
  factsOff: [] as readonly string[],
};

describe("#927 — `allowedFacts` subtracts what the customer refused", () => {
  it("offers both while they have refused neither", () => {
    expect(passages(allowedFacts(FACTS, []))).toEqual([BASIC, QUOTE]);
  });

  it("drops a refused passage and keeps the rest, in the order the read gave them", () => {
    // The order is grounding's own — the order a brief meets them — and
    // subtracting one must not reshuffle the others.
    expect(passages(allowedFacts(FACTS, [BASIC]))).toEqual([QUOTE]);
    expect(passages(allowedFacts(FACTS, [QUOTE]))).toEqual([BASIC]);
  });

  it("refusing every passage leaves none — the state §8 already has a path for", () => {
    // A site that has refused all of them is the same state as a site with
    // nothing readable: the pipeline reports no fact and no page ships,
    // which is hard rule 1 holding rather than a new failure mode.
    expect(allowedFacts(FACTS, [BASIC, QUOTE])).toEqual([]);
  });

  it("a refusal that matches nothing changes nothing", () => {
    // A passage they refused on a page the crawl has since re-measured
    // differently is simply not in the list any more.
    expect(passages(allowedFacts(FACTS, ["a sentence no page carries"]))).toEqual([BASIC, QUOTE]);
  });

  it("it copies rather than filtering in place, so the caller's list is untouched", () => {
    const before = [...FACTS];
    allowedFacts(FACTS, [BASIC]);
    expect(FACTS).toEqual(before);
  });
});

describe("#927 — the refusals come back with the profile, so the draft path reads once", () => {
  beforeEach(() => {
    readingsMock.mockReset();
    readingsMock.mockResolvedValue({
      profile: null,
      market: null,
      edits: NO_EDITS,
      editsRead: true,
    });
  });

  it("carries the refused passages, from the one read both screens use", async () => {
    readingsMock.mockResolvedValue({
      profile: null,
      market: null,
      edits: { ...NO_EDITS, factsOff: [BASIC] },
      editsRead: true,
    });
    const { confirmedForWriting } = await import("../../../src/lib/generate/voice/confirmed");
    const confirmed = await confirmedForWriting({
      siteId: "site-1",
      domain: "harbourbikes.example",
    });
    expect(confirmed.factsOff).toEqual([BASIC]);
    // One read for both halves — `readConfirmedBusiness` is the one path.
    expect(readingsMock).toHaveBeenCalledTimes(1);
  });

  it("a decisions read that failed refuses nothing and carries no profile", async () => {
    // The honest arm, and the reason `editsRead` exists. `edits` falls back
    // to "no decisions", which for a screen is right and for the writer is
    // the one thing that must not happen: rather than write from the
    // uncorrected reading — which may hold an item they removed — the
    // profile is dropped and the page is written as it was before #927.
    readingsMock.mockResolvedValue({
      profile: null,
      market: {
        job: "Service bikes",
        offeringType: "local service",
        audienceTerms: ["Commuters"],
        vocabulary: [],
      },
      edits: NO_EDITS,
      editsRead: false,
    });
    const { confirmedForWriting } = await import("../../../src/lib/generate/voice/confirmed");
    const confirmed = await confirmedForWriting({
      siteId: "site-1",
      domain: "harbourbikes.example",
    });
    // Not "the market reading's job": nothing at all.
    expect(confirmed).toEqual({ profile: null, factsOff: [] });
  });
});
