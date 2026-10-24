// evaluateAcceptance — what a week can and cannot decide for a fix page.
// A page placed on a search or a question is labelled from its reading
// (`verdict.test.ts`); `fix-page.test.ts` holds the site-check form.
import { describe, expect, it } from "vitest";
import { evaluateAcceptance } from "../../../src/lib/opportunities/verdicts/evaluate";
import type { WeekMeasurements } from "../../../src/lib/opportunities/verdicts/types";
import type { SearchRows } from "../../../src/lib/measure/page-reading";
import { measured, type Measured } from "../../../src/lib/measure/measured";
import type { Barrier } from "../../../src/lib/opportunities/types";
import { AT, DOMAIN } from "../fixtures";

function week(over: Partial<WeekMeasurements> = {}): WeekMeasurements {
  return {
    week: "2026-08-31",
    measuredAt: AT,
    domain: DOMAIN,
    positions: new Map<string, Measured<SearchRows>>(),
    promptCitations: new Map<string, Measured<readonly string[]>>(),
    gatesCleared: new Map<Barrier, Measured<boolean>>(),
    siteIssues: null,
    ...over,
  };
}

describe("gate_cleared — whether the barrier is cleared", () => {
  it("a measured gate decides it", () => {
    expect(
      evaluateAcceptance({
        acceptance: { form: "gate_cleared", gate: "noindex" },
        week: week({ gatesCleared: new Map<Barrier, Measured<boolean>>([["noindex", measured(true, AT)]]) }),
      })
    ).toEqual({ decided: true, passes: true, measuredAt: AT });
  });

  it("a barrier absent from the week's gates is undecided rather than failing", () => {
    // A barrier belongs to a closed set and cannot leave a tracked set, so
    // an absent key here is a gate the week did not look at.
    expect(
      evaluateAcceptance({ acceptance: { form: "gate_cleared", gate: "js_only" }, week: week() })
    ).toEqual({ decided: false, because: "not_measured" });
  });
});
