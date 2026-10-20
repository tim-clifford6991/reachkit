// The Monday owner digest names each source the vendor billed over 1.1 times
// its estimate (owner ruling W1, 2026-10-20). Fixture ledger rows go through
// the real `costWeek` and the real mail seam; the only double is the mail
// vendor's transport, so what is asserted is the text the owner reads.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { costWeek } = await import("../../../src/lib/scan/weekly/cost-week");
const { reportIncident } = await import("../../../src/lib/mail/ops");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");
type CostFetchRow = import("../../../src/lib/scan/weekly/cost-week").CostFetchRow;

const WEEK = "2026-10-12";
const SCANS = [{ domain: "harborplumbing.example", tier: "weekly", smoke: false, cost_cents: "31.5" }];

let texts: string[] = [];

beforeEach(() => {
  texts = [];
  __setVendorTransportForTesting(async (payload) => {
    texts.push(String((JSON.parse(payload) as { text: unknown }).text));
    return { status: 200, headers: {}, body: JSON.stringify({ id: "vendor-1" }) };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

function week(billed: readonly CostFetchRow[]) {
  const costs = costWeek({ weekStart: WEEK, scans: SCANS, drafts: [], domains: new Map(), totalCents: 120, billed });
  if (costs === null) throw new Error("the fixture week holds a scan");
  return costs;
}

/** The digest the owner reads for that week. */
async function digest(billed: readonly CostFetchRow[]): Promise<string> {
  await reportIncident({ occasion: "market-too-small-week", weekStart: WEEK, scanIds: [], costs: week(billed) });
  expect(texts).toHaveLength(1);
  return texts[0]!;
}

const row = (source: string, cost: string | null, billed: string | null): CostFetchRow => ({ source, cost_cents: cost, billed_cents: billed });

describe("the Monday digest flags a source billed over 1.1× its estimate", () => {
  it("names a source at 1.2×, with both totals and the ratio, and not one at 1.05× or exactly 1.10×", async () => {
    const billed = [
      row("dataforseo_labs/google/keyword_suggestions", "30.0000", "36.0000"),
      row("dataforseo_labs/google/keyword_suggestions", "22.3000", "26.7600"),
      row("serp/google/organic", "20.0000", "21.0000"),
      row("dataforseo_labs/google/ranked_keywords", "10.0000", "11.0000"),
      row("dataforseo_labs/google/ranked_keywords", "0.0300", "0.0330"),
    ];
    expect(week(billed).drift?.sources).toEqual([{ source: "dataforseo_labs/google/keyword_suggestions", billedCents: 62.76, estimatedCents: 52.3 }]);

    const text = await digest(billed);
    expect(text).toContain("billed more than 1.1 times");
    expect(text).toContain("dataforseo_labs/google/keyword_suggestions");
    expect(text).toContain("62.8¢");
    expect(text).toContain("52.3¢");
    expect(text).toContain("1.20×");
    expect(text).not.toContain("serp/google/organic");
    expect(text).not.toContain("ranked_keywords");
  });

  it("only the rows the vendor priced are summed: an unpriced row of the same source does not dilute it", () => {
    const drift = week([row("serp/google/organic", "10.0000", "12.0000"), row("serp/google/organic", "50.0000", null)]).drift;
    expect(drift?.sources).toEqual([{ source: "serp/google/organic", billedCents: 12, estimatedCents: 10 }]);
  });

  it("a source with no billed rows is never named, and no billed figure reads 0¢", async () => {
    const billed = [row("anthropic/claude", "40.0000", null), row("anthropic/claude", "12.5000", null)];
    expect(week(billed).drift).toBeNull();

    const text = await digest(billed);
    expect(text).not.toContain("anthropic/claude");
    expect(text).not.toContain("billed more than");
    expect(text).not.toMatch(/Billed\s*0(\.0)?¢/);
  });

  it("with every source at or under 1.1×, the digest has no drift section", async () => {
    const text = await digest([row("serp/google/organic", "20.0000", "22.0000"), row("dataforseo_labs/google/keyword_overview", "5.0000", "4.0000")]);
    expect(text).toContain("What last week cost");
    expect(text).not.toContain("billed more than");
    expect(text).not.toContain("Billed / estimated");
  });
});
