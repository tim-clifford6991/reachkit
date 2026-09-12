// tests/market/questions/rederive.test.ts — §5, §12 ruling 4
//
// A founder corrects the category their scan measured. The twelve that
// follow are re-selected over the market that scan already bought, worded
// by the mechanical template — so the correction costs nothing.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BATTERY } from "../../../src/lib/config/constants.ts";
import type { Profile } from "../../../src/lib/market/questions/profile.ts";
import type { SuggestionRow } from "../../../src/lib/market/questions/market-set.ts";
import { rederiveQuestions } from "../../../src/lib/market/questions/rederive.ts";
import { runtimeImportClosure } from "./import-graph.ts";

const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/market-set.json"), "utf8")
) as { profile: Profile; market: SuggestionRow[] };

const MEASURED = FIXTURE.profile.category;
/** A correction, not a synonym: the founder says the scan read the wrong
 *  market. Nothing else about their site changed. */
const CORRECTED = "employee scheduling";

function twelve(category: string): readonly { wording: string; search: string }[] {
  return rederiveQuestions({ profile: FIXTURE.profile, market: FIXTURE.market, category });
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("a corrected category re-derives the twelve from the market already measured", () => {
  it("the searches chosen change with the category, and each is one the stored market holds", () => {
    const asMeasured = twelve(MEASURED);
    const asCorrected = twelve(CORRECTED);
    expect(asMeasured.map((q) => q.search)).not.toEqual(asCorrected.map((q) => q.search));

    const held = new Set(FIXTURE.market.map((row) => row.keyword));
    for (const question of [...asMeasured, ...asCorrected]) {
      expect(held.has(question.search), question.search).toBe(true);
    }
  });

  it("never more than the twelve, and every one is worded as a question", () => {
    for (const category of [MEASURED, CORRECTED, "a market nothing here is about"]) {
      const questions = twelve(category);
      expect(questions.length).toBeLessThanOrEqual(BATTERY.QUESTIONS);
      for (const question of questions) expect(question.wording.endsWith("?")).toBe(true);
    }
  });

  it("the same category twice derives the identical twelve — no second measurement is taken", () => {
    expect(twelve(CORRECTED)).toEqual(twelve(CORRECTED));
  });
});

describe("it buys nothing fresh", () => {
  it("nothing it can reach at runtime spends money, calls a model or opens a socket", () => {
    // Asserted over the resolved import closure rather than over one call:
    // a module that cannot reach a vendor, the cost seam or the model seam
    // cannot spend on any input at all.
    const closure = runtimeImportClosure(
      path.resolve(__dirname, "../../../src/lib/market/questions/rederive.ts")
    );
    expect(closure.length).toBeGreaterThan(1);
    for (const file of closure) {
      expect(file, file).not.toMatch(/^lib[\/\\](vendors|llm|costs|db|egress)[\/\\]/);
    }
  });
});
