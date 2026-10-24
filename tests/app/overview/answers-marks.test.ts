// SPEC §6 (2026-09-20, #908), #918 — the one decision the AI answers tab's
// read makes over a stored cell.
//
// The owner's ruling splits a fact the product had as one: an answer that
// *links* to the site and an answer that *names* it somewhere else are two
// different things and are counted apart. Getting that split wrong is a
// number on a customer's screen that overstates or understates how often AI
// sends people their way, so it is decided by a pure function and held
// here rather than inferred from a render.
//
// `answers-store.ts` resolves `@/lib/db`, which parses the deployment's own
// bindings at module load. The env fixture is a side-effect import and must
// run before that one.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import type { AnswerCell } from "@/lib/scan/report";
import { markOf } from "@/app/(account)/app/_overview/answers-store";

const OWN = "reachkit.app";

const answered = (...citedDomains: string[]): AnswerCell => ({
  kind: "answered",
  citedDomains,
  namesCustomer: citedDomains.includes(OWN),
});

describe("what one engine said about the site, as one mark", () => {
  it("an answer citing the site's own domain links to it", () => {
    expect(markOf(answered("wikipedia.org", OWN), OWN)).toBe("links_to_you");
  });

  it("an answer carrying the brand somewhere else names it, and does not link", () => {
    // A marketplace listing, a profile page, a review: the answer reached
    // the brand through somebody else's page, which is a weaker fact than a
    // link and a real one. It is the score's own mention rate, drawn.
    expect(markOf(answered("reachkit-reviews.com"), OWN)).toBe("names_you");
  });

  it("a brand token matches a whole label and never a fragment of one", () => {
    // `classifyReferences`' rule, which this screen reuses rather than
    // restates: substring matching would make "reachkitchens.com" a mention
    // of "reachkit" and put a mark on a customer's screen for a bakery.
    expect(markOf(answered("reachkitchens.com"), OWN)).toBe("names_others");
  });

  it("an answer that reached neither names someone else", () => {
    expect(markOf(answered("wikipedia.org", "rival.example"), OWN)).toBe("names_others");
  });

  it("an answer that cites no address and does not name the site names no one", () => {
    expect(markOf(answered(), OWN)).toBe("names_no_one");
  });

  it("an answer that cites no address but names the site in its text names it", () => {
    expect(markOf({ kind: "answered", citedDomains: [], namesCustomer: false, named: true }, OWN)).toBe("names_you");
  });

  it("an answer that cites only another site still names someone else", () => {
    expect(markOf(answered("rival.com"), OWN)).toBe("names_others");
  });

  it("an engine that served no answer is not a place the site was ignored", () => {
    expect(markOf({ kind: "no_answer" }, OWN)).toBe("no_answer");
  });

  it("an engine nobody reached is not measured, whichever way the read failed", () => {
    expect(markOf({ kind: "unmeasured", reason: "not_attempted" }, OWN)).toBe("not_measured");
    expect(markOf({ kind: "unmeasured", reason: "undeterminable" }, OWN)).toBe("not_measured");
  });

  it("an answer that both links and names counts once, as the link", () => {
    // The two readings are disjoint in `classifyReferences` and stay
    // disjoint here: the split beneath the tile adds up to the rate, and it
    // could not if one answer were in both halves.
    expect(markOf(answered(OWN, "reachkit-reviews.com"), OWN)).toBe("links_to_you");
  });
});
