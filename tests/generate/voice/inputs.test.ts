// tests/generate/voice/inputs.test.ts — BUILD §8 hard rule 7: "brand voice
// = one free-text field appended to the prompt. Nothing learned."
//
// "Nothing learned" is kept by a closed struct rather than by an audit:
// `DraftPromptInputs` has six members, and a derived profile, summary,
// embedding or history has no member to arrive through. This suite pins the
// key set both at compile time (a `Record<keyof …, true>` that fails to
// compile if a member is added or removed) and at runtime.
import "../env";
import { describe, expect, it } from "vitest";
import {
  buildPromptInputs,
  DRAFT_PROMPT_KEYS,
  type DraftPromptInputs,
} from "../../../src/lib/generate/voice/inputs";
import { GROUNDED, opportunity } from "../fixtures";

function inputs(voiceText: string | null): DraftPromptInputs {
  return buildPromptInputs({
    businessName: "Acme",
    domain: "example.com",
    category: "project management software",
    voiceText,
    opportunity: opportunity(),
    grounded: GROUNDED,
  });
}

describe("DraftPromptInputs is closed", () => {
  it("has exactly the six members, and no seventh a derived artifact could arrive through", () => {
    expect(Object.keys(DRAFT_PROMPT_KEYS).sort()).toEqual(
      ["businessName", "category", "domain", "grounded", "opportunity", "voiceText"].sort()
    );
  });

  it("a built struct carries exactly those keys — no profile, no summary, no embedding, no history", () => {
    expect(Object.keys(inputs("Plain and direct.")).sort()).toEqual(
      Object.keys(DRAFT_PROMPT_KEYS).sort()
    );
  });
});

describe("the voice text is carried, not learned", () => {
  it("is carried byte for byte, including line breaks and trailing whitespace", () => {
    const written = "Plain and direct.\n\nNo exclamation marks.  ";
    expect(inputs(written).voiceText).toBe(written);
  });

  it("a site that has written none is generated without one, and nothing is inferred in its place", () => {
    expect(inputs(null).voiceText).toBeNull();
  });

  it("changing the text carries only the new text: no earlier version is read or kept", () => {
    expect(inputs("First version.").voiceText).toBe("First version.");
    expect(inputs("Second version.").voiceText).toBe("Second version.");
  });

  it("the builder stores nothing — it imports no store and no database", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/generate/voice/inputs.ts"),
      "utf8"
    );
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("../store");
    expect(source).not.toContain("console.");
  });
});
