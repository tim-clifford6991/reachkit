/**
 * Guard — the competitor picker REUSES the deep scan's already-fetched sizing
 * (report_payload.market.cohort) instead of re-fetching, and never fabricates a
 * tier for a rival the scan didn't profile.
 *
 * Intake: docs/superpowers/intakes/2026-07-27-competitor-picker-sizing-reuse.md
 * Mutation-proof: point the parser at `report_payload.somethingElse` and every
 * tier assertion fails (the reuse is what supplies the etv).
 */
import { describe, it, expect } from "vitest";
import { cohortSizingFromPayload } from "./route";
import { computeSizeTier } from "@/lib/scan/referral/discover-competitors";

// A trimmed, REAL-shaped payload (from prod scan c66d07c6, trustmrr.com):
// subject etv 6751; acquire 91k, flippa 111k, empireflippers 40k, digitalexits 57.
const trustmrrPayload = {
  market: {
    cohort: {
      self: { seo: { etv: 6751.5 } },
      competitors: [
        { domain: "acquire.com", seo: { etv: 91035.7 } },
        { domain: "flippa.com", seo: { etv: 111278.5 } },
        { domain: "empireflippers.com", seo: { etv: 40584.8 } },
        { domain: "digitalexits.com", seo: { etv: 56.7 } },
      ],
    },
  },
};

describe("cohortSizingFromPayload — reuse the deep scan's sizing", () => {
  it("parses subject + per-rival ETV the scan already fetched", () => {
    const s = cohortSizingFromPayload(trustmrrPayload);
    expect(s).not.toBeNull();
    expect(Math.round(s!.subjectEtv)).toBe(6752);
    expect(s!.etvByDomain.get("acquire.com")).toBeCloseTo(91035.7);
    expect(s!.etvByDomain.get("flippa.com")).toBeCloseTo(111278.5);
  });

  it("produces the honest size tiers the picker renders (real trustmrr spread)", () => {
    const s = cohortSizingFromPayload(trustmrrPayload)!;
    const tier = (d: string) => computeSizeTier(s.etvByDomain.get(d)!, s.subjectEtv);
    // subject 6751 (≥ baseline) → tier by ratio
    expect(tier("acquire.com")).toBe("much_bigger"); // 13.5×
    expect(tier("flippa.com")).toBe("much_bigger"); // 16.5×
    expect(tier("empireflippers.com")).toBe("bigger"); // 6×
    expect(tier("digitalexits.com")).toBe("similar"); // 0.008×
  });

  it("NEVER fabricates: a rival the scan didn't profile has no ETV entry", () => {
    const s = cohortSizingFromPayload(trustmrrPayload)!;
    expect(s.etvByDomain.has("microacquire.com")).toBe(false);
  });

  it("returns null when there's no market cohort (free/not-yet-deepened scan)", () => {
    expect(cohortSizingFromPayload(null)).toBeNull();
    expect(cohortSizingFromPayload({})).toBeNull();
    expect(cohortSizingFromPayload({ market: {} })).toBeNull();
  });

  it("excludes rivals with null/zero ETV (no fabricated tier)", () => {
    const s = cohortSizingFromPayload({
      market: { cohort: { self: { seo: { etv: 5000 } }, competitors: [
        { domain: "hasdata.com", seo: { etv: 20000 } },
        { domain: "nodata.com", seo: { etv: 0 } },
        { domain: "nullseo.com" },
      ] } },
    });
    expect(s).not.toBeNull();
    expect(s!.etvByDomain.has("hasdata.com")).toBe(true);
    expect(s!.etvByDomain.has("nodata.com")).toBe(false);
    expect(s!.etvByDomain.has("nullseo.com")).toBe(false);
  });
});
