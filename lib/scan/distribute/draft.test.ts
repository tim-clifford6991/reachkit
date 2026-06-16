import { describe, it, expect } from "vitest";
import { buildDraftPrompt, parseDraft } from "./draft";

describe("buildDraftPrompt", () => {
  it("includes product, opportunity, and platform-native style", () => {
    const p = buildDraftPrompt({
      platform: "reddit",
      productName: "TrustMRR",
      productDescription: "verified MRR badges",
      angle: "r/SaaS thread asking how to prove revenue",
      url: "https://trustmrr.com",
    });
    expect(p).toContain("TrustMRR — verified MRR badges");
    expect(p).toContain("r/SaaS thread asking how to prove revenue");
    expect(p).toContain("genuine Reddit self-post");
    expect(p).toContain("NEVER asking for upvotes");
    expect(p).toContain('{ "title": "...", "text": "..." }'); // reddit needs a title
  });

  it("omits the title field for platforms that don't need one (X)", () => {
    const p = buildDraftPrompt({ platform: "x", productName: "X", angle: "launch" });
    expect(p).toContain('{ "text": "..." }');
    expect(p).not.toContain('"title"');
  });
});

describe("parseDraft", () => {
  it("parses title + text (fenced JSON tolerated)", () => {
    expect(parseDraft('```json\n{"title":"Show HN: X","text":"body"}\n```')).toEqual({
      title: "Show HN: X",
      text: "body",
    });
  });
  it("returns text-only when no title", () => {
    expect(parseDraft('{"text":"just a tweet"}')).toEqual({ text: "just a tweet" });
  });
  it("falls back to raw text on malformed JSON", () => {
    expect(parseDraft("not json here")).toEqual({ text: "not json here" });
  });
});
