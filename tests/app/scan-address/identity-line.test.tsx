// The free report's identity lines, from stored panel reports rendered as the
// report screen renders them, at 0¢: the structured-data row says who the
// site's labels say runs it, once measured, and "We read you as" leads with
// the kind of business before its industry (board PubReport v36).

// The "still reading" line's leaf asks the router to refresh.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/presentation/copy";
import type { StoredReport } from "@/lib/scan/report";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import { parse } from "node-html-parser";
import { BUSINESS_KIND_NAMES, type BusinessKind } from "@/lib/market/kinds";
import { categoryOf } from "@/lib/scan/sections";
import { panelReport, renderReport } from "./panel-report";

/** The structured-data row's markup, up to the next row. */
function structuredRow(report: StoredReport): string {
  const markup = renderReport(report);
  const start = markup.indexOf('data-check="structured_data"');
  expect(start).toBeGreaterThan(-1);
  return markup.slice(start, markup.indexOf("</li>", start));
}

function withIdentity(report: StoredReport, identity: SiteIssuesSection["identity"]): StoredReport {
  return { ...report, siteIssues: { ...report.siteIssues!, identity } };
}

const FOUND = copy("check.identity.found", { type: "\u0000" }).split("\u0000")[0]!;

describe("who runs the site, under the page labels row", () => {
  it("a plumber's new scan names the plumber", () => {
    const report = withIdentity(panelReport("local"), { kind: "local_business", type: "Plumber", page: "https://austinplumbery.com/" });
    expect(structuredRow(report)).toContain(copy("check.identity.found", { type: "a plumber" }));
  });

  it("a site whose labels name no one says so", () => {
    const row = structuredRow(withIdentity(panelReport("saas"), null));
    expect(row).toContain(copy("check.identity.none"));
    expect(row).not.toContain(FOUND);
  });

  it("a stored report retrofits from its home page's labels", () => {
    expect(structuredRow(panelReport("local"))).toContain(copy("check.identity.found", { type: "a local business" }));
  });

  it("a stored report whose home page names no one shows no line", () => {
    const row = structuredRow(panelReport("saas"));
    expect(row).not.toContain(FOUND);
    expect(row).not.toContain(copy("check.identity.none"));
  });
});

/** The first "We read you as" badge: what the business is. */
function readAsWhat(report: StoredReport): string {
  return parse(renderReport(report)).querySelector('#read-as li')!.text.trim();
}

function asKind(report: StoredReport, kind: BusinessKind): StoredReport {
  if (report.market.kind === "unmeasured") throw new Error("the panel report's market was measured");
  return { ...report, market: { ...report.market, value: { ...report.market.value, profile: { ...report.market.value.profile, kind } } } } as StoredReport;
}

describe("We read you as: the kind of business, then its industry", () => {
  for (const which of ["local", "saas"] as const) {
    it(`each of the six kinds leads the ${which} report's line, before what it sells`, () => {
      const report = panelReport(which);
      const industry = categoryOf(report.market)!;
      for (const kind of BUSINESS_KIND_NAMES) {
        expect(readAsWhat(asKind(report, kind))).toBe(`${copy(`report.read.as.kind.${kind}`)} · ${industry}`);
      }
    });
  }
});
