import { describe, it, expect } from "vitest";
import { normalizePainQueries, parsePainQueries, buildPainQueryPrompt } from "./queries";

describe("normalizePainQueries", () => {
  it("drops brand mentions, too-short, and duplicates; caps", () => {
    const out = normalizePainQueries(
      [
        "no one is downloading my app",
        "NO ONE is downloading my app", // dup (case)
        "use ReachKit to grow", // brand mention → dropped
        "hi", // too short
        "go", // single word + short
        "how do I get my first users",
        "struggling to get traffic to my site",
      ],
      "ReachKit",
      3,
    );
    expect(out).toEqual([
      "no one is downloading my app",
      "how do I get my first users",
      "struggling to get traffic to my site",
    ]);
  });

  it("strips quotes from queries", () => {
    expect(normalizePainQueries(['"cant get any signups"'], "X", 5)).toEqual([
      "cant get any signups",
    ]);
  });
});

describe("parsePainQueries", () => {
  it("parses a JSON queries array, tolerant of fences", () => {
    expect(parsePainQueries('```json\n{"queries":["a b c","d e f"]}\n```')).toEqual([
      "a b c",
      "d e f",
    ]);
  });
  it("returns [] on malformed JSON or wrong shape", () => {
    expect(parsePainQueries("not json")).toEqual([]);
    expect(parsePainQueries('{"queries": 42}')).toEqual([]);
  });
});

describe("buildPainQueryPrompt", () => {
  it("includes the brand and instructs to never mention it", () => {
    const p = buildPainQueryPrompt(
      { brand: "Acme", problem: "x", audience: "y", valueProp: "z" },
      8,
    );
    expect(p).toContain("Acme");
    expect(p).toContain("NEVER include the brand");
    expect(p).toContain("search queries");
  });
});
