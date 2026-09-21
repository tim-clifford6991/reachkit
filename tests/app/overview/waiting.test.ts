// tests/app/overview/waiting.test.ts — SPEC §4 (2026-09-20), the page the
// Overview leads with.
//
// What a customer can see, decided here rather than in a browser: which
// sentence the card states about their page, and which chips stand beside
// it. Four reasons, one per shape of evidence the pass stored, and the rule
// that decides between them is the one thing a reader of this screen depends
// on — a page written to beat a rival must not read as a page of their own
// that is not high enough, and a demand nobody measured must not be stated
// as a number.
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import { readWaitingPage, type WaitingPageFacts } from "@/app/(account)/app/_overview/waiting";

const AT = new Date(Date.UTC(2026, 8, 4, 6, 0, 0));

function facts(over: Partial<WaitingPageFacts> = {}): WaitingPageFacts {
  return {
    draftId: "draft-1",
    title: "How teams pick an onboarding tool",
    stage: "your_review",
    goesLiveAt: new Date(Date.UTC(2026, 8, 5, 6, 0, 0)),
    target: {
      search: "onboarding tool comparison",
      volume: measured(1900, AT),
      winnability: "winnable",
      answeredTodayBy: ["rival.example"],
    },
    update: false,
    lead: "Most teams compare on price first.",
    readerHost: "content.example.com",
    ...over,
  };
}

describe("the one-sentence reason names what the page is for", () => {
  it("a rival holds the answer today — the sentence names the rival and the demand", () => {
    const reason = readWaitingPage(facts()).reason;
    expect(reason.key).toBe("overview.waiting.why.answered-by");
    expect(reason).toMatchObject({ search: "onboarding tool comparison", rival: "rival.example" });
  });

  it("nobody else holds it — the page is the customer's own, not high enough yet", () => {
    const target = { ...facts().target!, answeredTodayBy: [] };
    expect(readWaitingPage(facts({ target })).reason.key).toBe(
      "overview.waiting.why.not-high-enough"
    );
  });

  it("a demand nobody measured is never stated as a number", () => {
    const target = { ...facts().target!, volume: unmeasured<number>("undeterminable", AT) };
    const reason = readWaitingPage(facts({ target })).reason;
    // The arm that names the search alone: no `volume` to interpolate, so
    // no dash can reach a sentence about a count (REQ-004).
    expect(reason.key).toBe("overview.waiting.why.search");
    expect(reason).not.toHaveProperty("volume");
  });

  it("a measured zero is still a measurement, and keeps the sentence with a number in it", () => {
    const target = { ...facts().target!, volume: measuredZero(0, AT) };
    expect(readWaitingPage(facts({ target })).reason.key).toBe("overview.waiting.why.answered-by");
  });

  it("a Fix page has no market target, and says what a Fix is", () => {
    expect(readWaitingPage(facts({ target: null })).reason.key).toBe("overview.waiting.why.fix");
  });
});

describe("the chips say what kind of page it is and what its chances are", () => {
  it("a new page carries its band beside it", () => {
    expect(readWaitingPage(facts()).badges).toEqual([
      "overview.waiting.badge.new",
      "band.winnability.winnable",
    ]);
  });

  it("an update says so instead", () => {
    expect(readWaitingPage(facts({ update: true })).badges[0]).toBe(
      "overview.waiting.badge.update"
    );
  });

  it("a Fix page draws no band — nothing measured one for it", () => {
    expect(readWaitingPage(facts({ target: null })).badges).toEqual([
      "overview.waiting.badge.new",
    ]);
  });
});

describe("both controls act on the page itself", () => {
  it("Read it opens the draft the card is about", () => {
    expect(readWaitingPage(facts()).href).toBe("/app/draft/draft-1");
  });

  it("a page with no window running states no time to state one from", () => {
    expect(readWaitingPage(facts({ goesLiveAt: null })).goesLiveAt).toBeNull();
  });
});
