// tests/generate/length.test.ts — SPEC §7 (*Length and the writer*), owner
// ruling B7: a new page's length follows the questions it answers, within
// its type's maximum, and no floor stops a short, complete page.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bodyWords, lengthRangeFor } from "../../src/lib/generate/length";
import { TEMPLATES } from "../../src/lib/generate/templates";
import { VOICE } from "../../src/lib/config/constants";

// Buyer questions in the shape the customer panel asked them (a local
// plumber and a B2B scheduling SaaS; `docs/walk/panel/`).
const PANEL = {
  local: [
    "Which plumber in Austin can help the same day in an emergency?",
    "Which plumber in Austin will give a fixed price before starting?",
    "Which plumber in Austin can I book in the evening or at the weekend?",
    "Which plumber in Austin can I trust to be properly qualified and insured?",
    "Which plumber in Austin should I call for a small job on a tight budget?",
    "Which plumber in Austin will guarantee the work?",
    "How much does drain cleaning cost in Austin?",
    "What does an annual plumbing maintenance plan cover?",
    "How fast can a plumber reach me in Austin?",
  ],
  saas: [
    "Which online scheduling tools work on a small budget?",
    "Which appointment scheduling tools suit a team of one?",
    "Which appointment booking tools can I set up in a single day?",
    "Which online scheduling tools need no engineering team?",
    "Which appointment scheduling tools have a free trial?",
    "How does Calendly compare with Acuity Scheduling for online scheduling?",
    "What are the best alternatives to Calendly for teams and businesses?",
    "Is SavvyCal a good alternative to Calendly for online scheduling?",
    "What is the fastest way to get results from online scheduling?",
  ],
} as const;

const NEW_TYPES = ["qa", "how_to", "documentation", "listicle", "insights", "research"] as const;

describe("a new page's length follows the questions it answers", () => {
  for (const [site, questions] of Object.entries(PANEL)) {
    it(`${site}: a page answering 3 questions aims shorter than one answering 9, which aims at its type's maximum`, () => {
      for (const type of ["qa", "listicle", "insights"] as const) {
        const template = TEMPLATES[type];
        const few = lengthRangeFor(template, { questions: questions.slice(0, 3).length })!;
        const many = lengthRangeFor(template, { questions: questions.length })!;
        expect(few.target).toBeLessThan(many.target);
        expect(many.target).toBe(many.ceiling);
      }
    });
  }

  it("is never above the type's existing maximum, however many questions, and the maximum is unchanged", () => {
    for (const type of NEW_TYPES) {
      const template = TEMPLATES[type];
      const maximum = "ceiling" in template.length ? template.length.ceiling : 0;
      for (let questions = 0; questions <= 20; questions++) {
        const range = lengthRangeFor(template, { questions })!;
        expect(range.ceiling).toBe(maximum);
        expect(range.target).toBeLessThanOrEqual(maximum);
        expect(range.target).toBeGreaterThan(0);
      }
    }
  });

  it("has no fixed minimum: a short page is held to its maximum alone", () => {
    for (const type of NEW_TYPES) expect(lengthRangeFor(TEMPLATES[type], { questions: 3 })!.floor).toBe(0);
  });

  it("a short answer's voice caps it lower, and it still follows the questions", () => {
    const cap = VOICE.short.words.ceiling;
    const few = lengthRangeFor(TEMPLATES.qa, { questions: 5, cap })!;
    const many = lengthRangeFor(TEMPLATES.qa, { questions: 8, cap })!;
    expect(many).toEqual({ floor: 0, target: cap, ceiling: cap });
    expect(few.target).toBeLessThan(many.target);
  });

  it("an update keeps its range around the live page, and has none without one", () => {
    expect(lengthRangeFor(TEMPLATES.update, { liveWords: 1000, questions: 9 })).toEqual({ floor: 800, target: 1000, ceiling: 1200 });
    expect(lengthRangeFor(TEMPLATES.update, { questions: 9 })).toBeNull();
  });
});

// Stored production rows (`drafts.body_md`, read by SELECT on 2026-10-18),
// re-checked at 0¢ with no model call. A row stores no type, so each is
// named by the type its address was written as.
const STORED = JSON.parse(readFileSync(path.join(__dirname, "live-structure-pages-1507.json"), "utf8")) as { pages: { liveUrl: string; markdown: string }[] };
const STORED_TYPE = (url: string) => (/\/how-to-/.test(url) ? "how_to" : "listicle");

describe("stored drafts re-checked against the new range", () => {
  it("none fails on its length alone, and none is over its type's maximum", () => {
    expect(STORED.pages.length).toBeGreaterThan(0);
    for (const page of STORED.pages) {
      const range = lengthRangeFor(TEMPLATES[STORED_TYPE(page.liveUrl)])!;
      const words = bodyWords(page.markdown);
      expect({ url: page.liveUrl, fails: words < range.floor || words > range.ceiling }).toEqual({ url: page.liveUrl, fails: false });
    }
  });
});
