// Issue 1470 — a scan stored before the profile was asked for its lines,
// kind and reach is given them by the re-score, from what it stored, and
// what nothing stored decides stays unread.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { kindOfProfile, kindOfWords, linesOfCategory, retrofitReading } from "../../src/lib/business/retrofit";
import { profileOfReport, understandBusiness } from "../../src/lib/business/understanding";
import { DEFAULT_LOCALE } from "../../src/lib/locale/locales";
import { rescoreRow, type StoredScanRow } from "../../src/lib/scan/rescore-run";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

interface WalkSite {
  domain: string;
  stored: { scan: Omit<StoredScanRow, "domain" | "md5" | "siteId" | "isCurrent">; reads: [] } | null;
}

/** The free scans of 2026-10-15, stored before issue 1454 asked the profile
 *  for its lines, kind and reach. */
const WALK = (JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../docs/walk/free/2026-10-15.json"), "utf8")) as { sites: WalkSite[] }).sites;

function rescored(domain: string) {
  const site = WALK.find((s) => s.domain === domain && s.stored !== null)!;
  const stored = JSON.parse(JSON.stringify(site.stored!.scan)) as NonNullable<WalkSite["stored"]>["scan"];
  const scan: StoredScanRow = { ...stored, domain, md5: "", siteId: null, isCurrent: false };
  const row = rescoreRow(scan, site.stored!.reads ?? []);
  if (!("result" in row)) throw new Error(row.because);
  return { scan, row };
}

describe("a stored free scan gains its reading at 0¢", () => {
  it.each([
    ["laynescafe.co.uk", "hospitality", "local"],
    ["zunicafe.com", "hospitality", "local"],
    ["austinplumbery.com", "local-service", "local"],
    ["peanutplumbingtx.com", "local-service", "local"],
    ["alexander.co.uk", "professional-services", "local"],
    ["baeckerei-hinkel.de", "shop", undefined],
    ["roselinecoffee.com", "shop", undefined],
  ])("%s reads as %s, reach %s", (domain, kind, reach) => {
    const { reading } = rescored(domain).row.result;
    expect(reading.kind).toBe(kind);
    expect(reading.reach).toBe(reach);
    expect(reading.offerings).toHaveLength(1);
  });

  it("is written into the stored profile, the report shows it, and a second re-score adds nothing", () => {
    const { scan, row } = rescored("austinplumbery.com");
    // The row as the database would hand it back after the write.
    const report = JSON.parse(JSON.stringify(scan.report)) as Record<string, unknown>;
    for (const change of row.result.changes) {
      let at = report as Record<string | number, unknown>;
      for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
      at[change.path[change.path.length - 1]!] = JSON.parse(JSON.stringify(change.value));
    }
    expect(row.result.changes.map((c) => c.path.join("."))).toEqual(
      expect.arrayContaining(["market.value.profile.offerings", "market.value.profile.kind", "market.value.profile.reach"])
    );
    const read = understandBusiness({ domain: "austinplumbery.com", profile: profileOfReport(report), locale: DEFAULT_LOCALE });
    expect(read.kind).toBe("local-service");
    expect(read.where.reach).toBe("local");

    const again = rescoreRow({ ...scan, report }, []);
    if (!("result" in again)) throw new Error(again.because);
    expect(again.result.reading).toEqual({});
  });
});

describe("what the stored words decide", () => {
  it.each([
    ["accounting software", "software"],
    ["software consultancy", "professional-services"],
    ["software for restaurants", "software"],
    ["plumbers in Austin", "local-service"],
    ["coffee shop", "hospitality"],
    ["e-commerce platform", "software"],
    ["Handwerksbäckerei mit Einzelhandel", "shop"],
    ["temporary tattoos", null],
    ["website builder", null],
  ])("%s → %s", (words, kind) => {
    expect(kindOfWords(words)).toBe(kind);
  });

  it("splits a category that lists its lines, and only one", () => {
    expect(linesOfCategory("payroll and HR software", "en").map((o) => o.category)).toEqual(["payroll software", "HR software"]);
    expect(linesOfCategory("project management and team collaboration", "en").map((o) => o.category)).toEqual([
      "project management",
      "team collaboration",
    ]);
    for (const one of ["residential and commercial plumbing", "accountants and tax advisors", "software for plumbers and electricians", "bed and breakfast"]) {
      expect(linesOfCategory(one, "en").map((o) => o.category)).toEqual([one]);
    }
    expect(linesOfCategory("Bäckerei, Brot, Backwaren", "de")).toHaveLength(1);
    const three = linesOfCategory("email, SMS and push software", "en");
    expect(three.reduce((sum, o) => sum + o.weight, 0)).toBeCloseTo(1, 3);
  });

  it("a paying site's market decides its kind and reach", () => {
    const base = { measuredInTown: false, schemaTypes: [], serps: [] };
    const profile = { category: "AI content marketing software", offeringType: "SaaS" };
    expect(retrofitReading({ ...base, profile, market: { kind: "software", serves: null } })).toMatchObject({ kind: "software", reach: "international" });
    expect(
      retrofitReading({ ...base, profile: { category: "accountants", offeringType: "firm" }, market: { kind: "professional-services", serves: { name: "Manchester" } } })
    ).toMatchObject({ kind: "professional-services", reach: "local" });
  });

  it("leaves unread what nothing stored decides, and keeps what the profile already read", () => {
    const base = { measuredInTown: false, schemaTypes: [], serps: [] };
    expect(retrofitReading({ ...base, profile: { category: "<UNKNOWN>" } })).toEqual({});
    expect(retrofitReading({ ...base, profile: { category: "temporary tattoos", offeringType: "products", town: "" } })).toEqual({
      offerings: [{ name: "temporary tattoos", category: "temporary tattoos", weight: 1 }],
    });
    expect(
      retrofitReading({ ...base, profile: { category: "business software", offerings: [], kind: "software", reach: "international" } })
    ).toEqual({});
  });
});

// Issue 1474 — a word that is a trade or a product ("builder") does not
// decide the kind alone, and an explicit signal weighs two readings.
describe("the category and the offering type are read together", () => {
  it.each([
    ["plumbing services", "residential plumbing repair", false, "local-service"],
    ["restaurant", "sit-down dining", false, "hospitality"],
    ["coffee shop", "independent café and bakery", false, "hospitality"],
    ["home builder", "custom homes", true, "local-service"],
    ["home builder", "custom homes", false, null],
    ["website builder", "SaaS platform", false, "software"],
    ["online form builder", "form builder with paid upgrades", false, null],
    ["accountants", "bookkeeping app", false, null],
  ] as const)("%s, %s, a town %s → %s", (category, offeringType, town, kind) => {
    expect(kindOfProfile(category, offeringType, town)).toBe(kind);
  });

  it("a stored home builder with a town is a local trade; a website builder sold as SaaS is software", () => {
    const base = { measuredInTown: false, schemaTypes: [], serps: [] };
    expect(retrofitReading({ ...base, profile: { category: "home builder", offeringType: "new build homes", town: "Leeds" } })).toMatchObject({
      kind: "local-service",
      reach: "local",
    });
    expect(retrofitReading({ ...base, profile: { category: "website builder", offeringType: "SaaS platform" } })).toMatchObject({
      kind: "software",
      reach: "international",
    });
  });
});
