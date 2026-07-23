/**
 * Phase B (2026-07-22) — the LLM relevance judge.
 *
 * Unit tests for the PURE parts (prompt + parser). `judgeRelevance` itself makes
 * a live LLM call + cache I/O and is covered by live verification + the degrade
 * path; the deterministic logic — how a raw LLM response becomes a verdict map,
 * and how a partial/garbage response degrades — is what's tested here.
 */
import { describe, it, expect } from "vitest";
import { buildRelevancePrompt, parseRelevanceVerdicts } from "./relevance-judge";
import type { RelevanceSubject } from "./relevance-judge";

const subject: RelevanceSubject = {
  host: "usefathom.com",
  name: "Fathom Analytics",
  categoryLabel: "Web Analytics",
  nicheLabel: "privacy-first web analytics",
  rankedTerms: ["fathom analytics", "privacy analytics", "google analytics alternative"],
};

describe("buildRelevancePrompt", () => {
  it("includes the subject's business context and the real ranked terms", () => {
    const p = buildRelevancePrompt(subject, ["web analytics", "mobile app analytics"]);
    expect(p).toContain("Web Analytics");
    expect(p).toContain("privacy-first web analytics");
    expect(p).toContain("Genuinely ranks in search for: fathom analytics");
    // candidates are index-numbered for the index-aligned parse
    expect(p).toContain("0. web analytics");
    expect(p).toContain("1. mobile app analytics");
  });
  it("omits the ranked-terms line when the subject has none", () => {
    const p = buildRelevancePrompt({ ...subject, rankedTerms: [] }, ["web analytics"]);
    expect(p).not.toContain("Genuinely ranks in search for");
  });
});

describe("parseRelevanceVerdicts", () => {
  const candidates = ["web analytics", "data analytics tools", "mobile app analytics"];

  it("aligns index-keyed verdicts back onto the (lowercased) candidate keywords", () => {
    const raw = `{"verdicts":[{"i":0,"v":"category"},{"i":1,"v":"irrelevant"},{"i":2,"v":"irrelevant"}]}`;
    const m = parseRelevanceVerdicts(raw, candidates);
    expect(m.get("web analytics")).toBe("category");
    expect(m.get("data analytics tools")).toBe("irrelevant");
    expect(m.get("mobile app analytics")).toBe("irrelevant");
  });

  it("tolerates JSON with prose/fences around it and normalizes verdict casing", () => {
    const raw = "Here you go:\n```json\n{\"verdicts\":[{\"i\":0,\"v\":\"CATEGORY\"}]}\n```";
    const m = parseRelevanceVerdicts(raw, candidates);
    expect(m.get("web analytics")).toBe("category");
  });

  it("DEGRADES: a garbage response yields an empty map (→ caller falls back to token-overlap)", () => {
    expect(parseRelevanceVerdicts("not json at all", candidates).size).toBe(0);
    expect(parseRelevanceVerdicts("", candidates).size).toBe(0);
  });

  it("omits invalid verdict labels and out-of-range indexes (no key ⇒ unjudged ⇒ token fallback)", () => {
    const raw = `{"verdicts":[{"i":0,"v":"maybe"},{"i":9,"v":"category"},{"i":2,"v":"niche"}]}`;
    const m = parseRelevanceVerdicts(raw, candidates);
    expect(m.has("web analytics")).toBe(false); // "maybe" is not a valid verdict → dropped
    expect(m.has("data analytics tools")).toBe(false); // index 9 out of range → dropped
    expect(m.get("mobile app analytics")).toBe("niche");
  });
});
