// SPEC §7 *The content standard*: a rival's own pages are read only where the page is about it. In production a how-to
// was written from two rivals' pricing pages alone (tests/fixtures/walk/pipeline-v2/how_to.pack.json).
import { describe, expect, it } from "vitest";
import { rivalsInScope } from "../../../src/lib/generate/pipeline/source-tier";

const rivals = ["aeoengine.ai", "meltwater.com"];
const rivalNames = [{ domain: "aeoengine.ai", name: "AEO Engine" }, { domain: "meltwater.com", name: "Meltwater" }];

describe("rival pages are read only where a rival is the subject", () => {
  it("reads none on a how-to, and the named ones on a comparison", () => {
    expect(rivalsInScope(rivals, { searches: ["how to get your business named in ai answers"], rivalNames })).toEqual([]);
    expect(rivalsInScope(rivals, { searches: ["aeo engine vs meltwater"], rivalNames })).toEqual(rivals);
    expect(rivalsInScope(rivals, { searches: ["meltwater pricing"], rivalNames })).toEqual(["meltwater.com"]);
  });
});
