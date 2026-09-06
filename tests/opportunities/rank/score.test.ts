// BUILD §7 — `demand x intent x (1-effort) x fit`, one list.
import "../env";
import { describe, expect, it } from "vitest";
import {
  DEMAND_LOG_DIVISOR,
  EFFORT_BY_TYPE,
  FIT_WEIGHT,
  SELECTION,
} from "../../../src/lib/config/constants";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import {
  demandTerm,
  effortTerm,
  fitTerm,
  intentTerm,
  rankScore,
} from "../../../src/lib/opportunities/rank/score";
import { OPPORTUNITY_TYPES } from "../../../src/lib/opportunities/types";
import { PROFILE, AT } from "../fixtures";

describe("the formula is the four terms, multiplied", () => {
  it("rankScore is exactly demand x intent x (1-effort) x fit", () => {
    const volume = measured(1900, AT);
    const query = "best user onboarding software";
    const score = rankScore({ volume, query, type: "keyword_page", fit: "winnable", profile: PROFILE });
    expect(score).toBeCloseTo(
      demandTerm(volume) *
        intentTerm(query, PROFILE) *
        (1 - EFFORT_BY_TYPE.keyword_page) *
        fitTerm("winnable"),
      12
    );
  });
});

describe("demand is log-scaled and saturates", () => {
  it("volume enters through log10 and reaches 1.0 at the saturation point", () => {
    expect(demandTerm(measured(0, AT))).toBe(0);
    expect(demandTerm(measured(10 ** DEMAND_LOG_DIVISOR - 1, AT))).toBeCloseTo(1, 3);
    // Saturates rather than clips: ten times the saturation volume is
    // still 1, never more.
    expect(demandTerm(measured(10 ** (DEMAND_LOG_DIVISOR + 1), AT))).toBe(1);
  });

  it("an unmeasured volume contributes no demand, never a default", () => {
    expect(demandTerm(unmeasured("undeterminable", AT))).toBe(0);
    expect(demandTerm(null)).toBe(0);
    expect(demandTerm(measuredZero(0, AT))).toBe(0);
  });

  it("a bigger volume never scores lower", () => {
    let previous = -1;
    for (const volume of [0, 10, 50, 500, 5000, 50_000]) {
      const term = demandTerm(measured(volume, AT));
      expect(term).toBeGreaterThanOrEqual(previous);
      previous = term;
    }
  });
});

describe("intent is §6.7's own classifier, not a second one", () => {
  it("a decision search scores the top weight and an unrecognised one the floor", () => {
    const max = Math.max(...Object.values(SELECTION.intentWeights));
    expect(intentTerm("best user onboarding software", PROFILE)).toBeCloseTo(
      SELECTION.intentWeights.decision / max,
      12
    );
    expect(intentTerm("onboarding thoughts", PROFILE)).toBeCloseTo(
      SELECTION.intentWeights.informational / max,
      12
    );
  });

  it("a search naming the customer's own brand drops to zero", () => {
    // The own-brand drop set is the profile's; this is why `rankScore`
    // takes a profile and has no one-argument form.
    expect(intentTerm("example pricing", PROFILE)).toBe(0);
  });
});

describe('§7, and REQ-047: "A Not-yet target is never queued for a page"', () => {
  it("the not-yet weight is zero, so the formula cannot surface one", () => {
    expect(fitTerm("not-yet")).toBe(0);
    expect(FIT_WEIGHT["not-yet"]).toBe(0);
    expect(
      rankScore({
        volume: measured(90_000, AT),
        query: "best user onboarding software",
        type: "answerable_page",
        fit: "not-yet",
        profile: PROFILE,
      })
    ).toBe(0);
  });

  it("winnable outranks reach, all else equal", () => {
    const common = {
      volume: measured(1900, AT),
      query: "best user onboarding software",
      type: "keyword_page" as const,
      profile: PROFILE,
    };
    expect(rankScore({ ...common, fit: "winnable" })).toBeGreaterThan(
      rankScore({ ...common, fit: "reach" })
    );
  });
});

describe('§7: `unblock` is "instruction only, never generated"', () => {
  it("it has no effort weight and no score", () => {
    expect(effortTerm("unblock")).toBeNull();
    expect(
      rankScore({
        volume: measured(90_000, AT),
        query: "anything",
        type: "unblock",
        fit: "winnable",
        profile: PROFILE,
      })
    ).toBe(0);
  });

  it("every other type has one, so the effort term is total over the seven", () => {
    for (const type of OPPORTUNITY_TYPES) {
      if (type === "unblock") continue;
      const effort = effortTerm(type);
      expect(effort).not.toBeNull();
      expect(effort).toBeGreaterThanOrEqual(0);
      expect(effort).toBeLessThanOrEqual(1);
    }
  });

  it("less effort scores higher, all else equal — improving beats writing", () => {
    const common = {
      volume: measured(1900, AT),
      query: "best user onboarding software",
      fit: "winnable" as const,
      profile: PROFILE,
    };
    expect(rankScore({ ...common, type: "answerable_page" })).toBeGreaterThan(
      rankScore({ ...common, type: "format_page" })
    );
  });
});
