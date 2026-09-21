// SPEC §5 (2026-09-20, #908), #923 — what the voice sample may say, and
// what the screen may mark, decided without a model and without a browser.
//
// Two rules are worth holding here because both are places the panel could
// quietly lie to a founder: what the model is shown (never a URL), and what
// the screen marks (never a phrase the paragraph does not contain).
import { describe, expect, it } from "vitest";
import {
  settleVoiceSample,
  voiceSampleInput,
  voiceSampleSchema,
  VOICE_SAMPLES_MAX,
} from "@/app/(account)/setup/_setup/voice-sample";

const PASSAGES = [
  { url: "https://you.example/pricing", passage: "Plans start at £29 a month." },
  { url: "https://you.example/about", passage: "We have fitted bikes in Bristol since 2009." },
];

describe("what the model is asked", () => {
  it("shows the passages and their indexes, and never a page's address", () => {
    const input = voiceSampleInput({ voice: "Plain, short.", businessName: "Bikes", passages: PASSAGES });
    expect(JSON.stringify(input)).not.toContain("you.example");
    expect(input.passages).toEqual([
      { index: 0, text: PASSAGES[0]?.passage },
      { index: 1, text: PASSAGES[1]?.passage },
    ]);
  });

  it("carries the voice on the left, and omits a business nobody named", () => {
    const named = voiceSampleInput({ voice: "Plain.", businessName: "Bikes", passages: PASSAGES });
    expect(named.business).toBe("Bikes");
    expect(named.voice).toBe("Plain.");
    const unnamed = voiceSampleInput({ voice: "Plain.", businessName: null, passages: PASSAGES });
    expect("business" in unnamed).toBe(false);
  });
});

describe("what the answer may hold", () => {
  it("is three members and no fourth — nowhere for a price or a promise", () => {
    expect(Object.keys(voiceSampleSchema.shape).sort()).toEqual([
      "grounded",
      "paragraph",
      "passageIndex",
    ]);
  });
});

describe("what the screen marks", () => {
  it("marks the grounded sentence and names the page it was read from", () => {
    const answer = settleVoiceSample(
      { paragraph: "A. We have fitted bikes in Bristol since 2009. B.", grounded: "We have fitted bikes in Bristol since 2009.", passageIndex: 1 },
      PASSAGES,
      2
    );
    expect(answer.grounded).toBe("We have fitted bikes in Bristol since 2009.");
    expect(answer.sourceUrl).toBe("https://you.example/about");
    expect(answer.remaining).toBe(2);
  });

  it("marks nothing where the model quoted a sentence it did not write", () => {
    // Marking the wrong phrase is worse than marking none: the paragraph is
    // still shown, and nothing in it is claimed to be the grounded fact.
    const answer = settleVoiceSample(
      { paragraph: "A paragraph.", grounded: "A sentence that is not in it.", passageIndex: 0 },
      PASSAGES,
      1
    );
    expect(answer.grounded).toBe("");
    expect(answer.paragraph).toBe("A paragraph.");
  });

  it("names no page where the model pointed at a passage that does not exist", () => {
    const answer = settleVoiceSample(
      { paragraph: "A paragraph.", grounded: "A paragraph.", passageIndex: 9 },
      PASSAGES,
      0
    );
    expect(answer.sourceUrl).toBeNull();
  });
});

describe("the bound", () => {
  it("is a few presses, and the first write is one of them", () => {
    expect(VOICE_SAMPLES_MAX).toBe(3);
  });
});
