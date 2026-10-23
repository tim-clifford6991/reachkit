// The free report's structured-data row says who the site's labels say runs
// it, once measured; a reading that was not measured shows no line. Stored
// panel reports, rendered as the report screen renders them, at 0¢.

// The "still reading" line's leaf asks the router to refresh.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/presentation/copy";
import type { StoredReport } from "@/lib/scan/report";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
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
