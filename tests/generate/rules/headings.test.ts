// tests/generate/rules/headings.test.ts — SPEC §7 (owner, D61; issue 1295):
// a Q&A whose headings are one question asked again is stopped.
import { describe, expect, it } from "vitest";
import { checkDistinctHeadings } from "../../../src/lib/generate/rules/headings";

const page = (...headings: string[]) => headings.map((heading) => `## ${heading}\n\nAn answer.\n`).join("\n");

describe("distinct_headings", () => {
  it("stops a page where two H2s open alike or share most of their words, and names both", () => {
    // reachkit.app, 7 October: one template, a different ending.
    const opening = page(
      "What does a visibility tracker measure?",
      "Which tools help me understand where AI and search send buyers on a small budget?",
      "Which tools help me understand where AI and search send buyers without hiring an agency?"
    );
    expect(checkDistinctHeadings({ markdown: opening, apply: true })?.detail).toMatchObject({
      headings: [
        "Which tools help me understand where AI and search send buyers on a small budget?",
        "Which tools help me understand where AI and search send buyers without hiring an agency?",
      ],
    });
    const words = page(
      "Which generative engine optimization tools work on a small budget?",
      "Which generative engine optimization tools suit a team of one?"
    );
    expect(checkDistinctHeadings({ markdown: words, apply: true })?.rule).toBe("distinct_headings");
  });

  it("passes questions that share only their topic, reads H2s alone, and asks nothing of another page type", () => {
    const distinct = page(
      "What is generative engine optimization?",
      "How does generative engine optimization work?",
      "How much do AI visibility tools cost?",
      "Can I track ChatGPT referrals in Google Analytics?"
    );
    expect(checkDistinctHeadings({ markdown: distinct, apply: true })).toBeNull();
    const sub = "## What does it cost?\n\n### What does it cost for a team?\n\nAn answer.\n";
    expect(checkDistinctHeadings({ markdown: sub, apply: true })).toBeNull();
    expect(checkDistinctHeadings({ markdown: page("What does Alpha cost?", "What does Beta cost?"), apply: false })).toBeNull();
  });
});
