// A report's market stands or not from the report alone, and the missing
// pages read that one answer.
import { describe, expect, it } from "vitest";
import { unmeasured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { marketStands } from "@/lib/scan/sections";
import { missingPagesOf } from "@/app/(public)/scan/[domain]/_problems/model";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";

const AT = new Date("2026-11-03T00:00:00.000Z");
const withdrawn = (because: string): StoredReport => ({ ...FIXTURE_REPORT, market: unmeasured("undeterminable", AT, because) });

describe("marketStands", () => {
  it("is false for a market withdrawn behind bot protection, and nothing is missing", () => {
    expect(marketStands(withdrawn("bot_protection"))).toBe(false);
    expect(missingPagesOf(withdrawn("bot_protection"))).toBeNull();
  });

  it("is false for a market withdrawn off a home page with no words", () => {
    expect(marketStands(withdrawn("home_wordless"))).toBe(false);
    expect(missingPagesOf(withdrawn("home_wordless"))).toBeNull();
  });

  it("is true for a market read from the search listing", () => {
    const report: StoredReport = { ...FIXTURE_REPORT, marketFrom: "search" };
    expect(marketStands(report)).toBe(true);
    expect(missingPagesOf(report)?.length).toBeGreaterThan(0);
  });

  it("is true for a market read from the home page", () => {
    expect(marketStands(FIXTURE_REPORT)).toBe(true);
    expect(missingPagesOf(FIXTURE_REPORT)?.length).toBeGreaterThan(0);
  });
});
