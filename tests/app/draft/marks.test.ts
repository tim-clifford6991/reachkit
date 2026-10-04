// tests/app/draft/marks.test.ts — SPEC §7 (2026-09-20, #908), issue 932.
//
// "A sentence that breaks a hard rule or matches the never-claim list is
// marked where it stands as it is typed."
//
// The editor's lint source and the preview's mark are one function, and it
// is pure, so this file is where the *done-when* is decided: "typing a
// never-claim phrase underlines it within a second and holds the page;
// removing it releases it." Within a second is the editor's pause
// (`PREVIEW_DEBOUNCE_MS`, 100ms) and is asserted in `view.test.tsx` against
// a rendered screen; **which span, and whose words** is here, where there
// is no DOM to get in the way.
//
// What this file does *not* do is re-state §8. There is no row here saying
// "a testimonial is a break" — `tests/generate/rules` owns every rule's
// own behaviour, and a copy of it here would be a transcription. What is
// asserted is the three things `marks.ts` adds: that it runs the real
// rules, that it places a break where the words are, and that it declines
// to speak for the three it cannot run.
import { describe, expect, it } from "vitest";
import {
  BREAK_COPY_KEY,
  isPlaced,
  liveBreaks,
  type MarkInputs,
} from "@/app/(account)/app/draft/[draftId]/marks";
import { HARD_RULES } from "@/lib/generate/rules/types";

/** A page that breaks nothing: it opens with a plain answer of the right
 *  length, names no rival beside a figure, quotes nobody and claims
 *  nothing. */
const CLEAN = [
  "A five-person team runs out of limits long before it runs out of features, so the",
  "two or three ceilings its own way of working pushes against are what to compare first.",
  "",
  "## What to look at",
  "",
  "- Custom fields per object.",
  "- Seats included at the tier you would buy.",
].join("\n");

const INPUTS: MarkInputs = {
  title: "How to choose a CRM for a small team",
  businessName: null,
  domain: "example.com",
  doNotClaim: ["the best CRM on the market", "guaranteed results"],
  rivals: ["hubspot.com"],
  pageType: "answer",
  brief: {
    facts: ["A five-person team runs out of limits long before it runs out of features."],
    queries: ["best crm for small teams"],
  },
};

function rules(md: string, inputs: MarkInputs = INPUTS): string[] {
  return liveBreaks(md, inputs).map((found) => found.rule);
}

describe("the page as it stands, against the rules that can be decided here", () => {
  it("a page that breaks nothing reports nothing", () => {
    expect(liveBreaks(CLEAN, INPUTS)).toEqual([]);
  });

  it("every rule it reports has a sentence to report it with", () => {
    // The map is total over what `liveBreaks` can return, which is what
    // stops a rule arriving on screen as an underline with no reason.
    for (const rule of Object.keys(BREAK_COPY_KEY)) {
      expect(HARD_RULES).toContain(rule);
    }
  });

  it("the three it cannot decide are never among its answers", () => {
    // `grounding` needs the source page, `near_duplicate` the site's whole
    // content and `no_private_figure` the stored report. None of the three
    // is reachable from this screen, so none may be spoken for — the save
    // runs all three and holds the page on any of them.
    const unreachable = ["grounding", "near_duplicate", "no_private_figure"];
    for (const rule of unreachable) {
      expect(Object.keys(BREAK_COPY_KEY)).not.toContain(rule);
    }
  });
});

describe("the done-when — a never-claim phrase, underlined where it stands", () => {
  const md = `${CLEAN}\n\nWe are the best CRM on the market for a team of five.`;

  it("typing one reports the break, and names the customer's own entry back to them", () => {
    const found = liveBreaks(md, INPUTS).find((b) => b.rule === "do_not_claim");
    expect(found).toBeDefined();
    // Their words, in the case and spacing *they* recorded — never a
    // paraphrase and never anything a model wrote.
    expect(found?.entry).toBe("the best CRM on the market");
  });

  it("the span it reports is the sentence the phrase stands in", () => {
    const found = liveBreaks(md, INPUTS).find((b) => b.rule === "do_not_claim");
    expect(found && isPlaced(found)).toBe(true);
    expect(md.slice(found?.from ?? 0, found?.to ?? 0)).toBe(
      "We are the best CRM on the market for a team of five."
    );
  });

  it("removing it releases the page", () => {
    expect(rules(md)).toContain("do_not_claim");
    expect(rules(CLEAN)).not.toContain("do_not_claim");
  });

  it("it matches the way the check matches — case and spacing are not the customer's problem", () => {
    // `literalClaimMatch` is the very comparison `claimCheck` makes before
    // it spends anything on a model, so the editor and the verdict agree
    // about what counts as saying it.
    const shouted = `${CLEAN}\n\nWe are THE  Best   CRM on the Market, plainly.`;
    expect(rules(shouted)).toContain("do_not_claim");
  });
});

describe("where a break is placed", () => {
  it("a rule that names a figure underlines the sentence carrying it", () => {
    // §8's rival-source rule: a figure about a rival, in a sentence with no
    // address a reader could open.
    const md = `${CLEAN}\n\nhubspot.com caps custom properties at 10 per object.`;
    const found = liveBreaks(md, INPUTS).find((b) => b.rule === "rival_source");
    expect(found?.figure).toBe("10");
    expect(md.slice(found?.from ?? 0, found?.to ?? 0)).toBe(
      "hubspot.com caps custom properties at 10 per object."
    );
  });

  it("a block-scoped rule underlines the block, found by asking the rule itself", () => {
    const md = [
      CLEAN,
      "",
      "> A quotation long enough to read as a remark, with nobody to answer for it.",
    ].join("\n");
    const found = liveBreaks(md, INPUTS).find((b) => b.rule === "no_unsourced_testimonial");
    expect(found && isPlaced(found)).toBe(true);
    expect(md.slice(found?.from ?? 0, found?.to ?? 0)).toBe(
      "> A quotation long enough to read as a remark, with nobody to answer for it."
    );
  });

  it("the answer-first rule underlines the opening block, which is its own subject", () => {
    const md = "Short.\n\nAnd then a second paragraph that is long enough not to matter here at all.";
    const found = liveBreaks(md, INPUTS).find((b) => b.rule === "first_block_answers");
    expect(md.slice(found?.from ?? 0, found?.to ?? 0)).toBe("Short.");
  });

  it("a rule whose answer is about the page carries no span rather than a guessed one", () => {
    // `honest_row` reads the title, the headings and the comparison table
    // together: a comparison table with no row for the business names no
    // sentence, and inventing one would be the rule implemented a second
    // time.
    const md = `${CLEAN}\n\n| Tool | Seats |\n| --- | --- |\n| HubSpot | Unlimited |`;
    const found = liveBreaks(md, { ...INPUTS, pageType: "market_comparison" }).find(
      (b) => b.rule === "honest_row"
    );
    expect(found).toBeDefined();
    expect(found && isPlaced(found)).toBe(false);
  });
});

describe("what it declines to run", () => {
  it("the three rules that read the brief's passages do not run where none were recorded", () => {
    // Empty is "not recorded", never "no facts". Against an empty list
    // `traceable_numerals` reports every figure on the page, so a draft
    // written before `meta.factsUsed` existed would be underlined end to
    // end for saying what it was told to say.
    const md = `${CLEAN}\n\nThe median team of that size runs 40 custom fields.`;
    expect(rules(md)).toContain("traceable_numerals");
    expect(rules(md, { ...INPUTS, brief: { ...INPUTS.brief, facts: [] } })).not.toContain(
      "traceable_numerals"
    );
  });

  it("with no site facts at all it still reports the rules that need only the text", () => {
    // The honest failure of `ruleFactsOf`: a founder whose lists could not
    // be read still gets every rule the text alone decides, and the save
    // still runs the whole battery. Under-reporting is a founder told a
    // moment later; over-reporting would be this screen accusing them of a
    // break the battery does not hold.
    const bare: MarkInputs = {
      title: "",
      businessName: null,
      domain: "",
      doNotClaim: [],
      rivals: [],
      pageType: null,
      brief: { facts: [], queries: [] },
    };
    expect(rules("Short.", bare)).toContain("first_block_answers");
    expect(rules("Short.", bare)).not.toContain("do_not_claim");
  });
});
