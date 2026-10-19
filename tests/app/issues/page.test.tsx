// tests/app/issues/page.test.tsx — issue 1550: a needs-you technical issue
// opens the account's own view, which names the pages and says what to do,
// and is never the public report with its checkout.
import "../../generate/env";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { copy } from "@/lib/presentation/copy";
import { readAlerts, waitingIssues } from "@/app/(account)/app/_overview/alerts";
import { FIXTURE_MEASURED_AT, FIXTURE_SITE_ISSUES } from "@/app/(account)/app/issues/fixture";
import IssuesPage from "@/app/(account)/app/issues/page";
import { resetAccount, signedInAs } from "../account-door";

afterEach(resetAccount);

async function rendered(): Promise<string> {
  signedInAs();
  return renderToStaticMarkup(await IssuesPage());
}

describe("Technical issues, where a needs-you item lands", () => {
  it("each alert opens a check this view draws, with its fix line and its pages", async () => {
    const markup = await rendered();
    const { alerts } = readAlerts(waitingIssues(FIXTURE_SITE_ISSUES, { measuredAt: FIXTURE_MEASURED_AT }), FIXTURE_MEASURED_AT);
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      const [path, check] = alert.href.split("#");
      expect(path).toBe("/app/issues");
      expect(markup).toContain(`id="${check}"`);
    }
    const slow = FIXTURE_SITE_ISSUES.issues.find((i) => i.check === "slow_pages");
    if (slow === undefined || !slow.ran || slow.pages === null) throw new Error("fixture has no slow pages");
    for (const page of slow.pages) expect(markup).toContain(page);
    expect(markup).toContain(copy("check.slow-pages.fix"));
    expect(markup).toContain(copy("overview.issues.seconds", { seconds: "4.2" }));
  });

  it("is not the public report: no report link and no checkout", async () => {
    const markup = await rendered();
    expect(markup).not.toContain("/scan/");
    expect(markup).not.toMatch(/checkout|pricing/i);
  });

  it("draws no check the customer has nothing to act on", async () => {
    const markup = await rendered();
    // ReachKit's own work, and broken links counted with no address kept.
    expect(markup).not.toContain('data-check="page_titles"');
    expect(markup).not.toContain('data-check="structured_data"');
    expect(markup).not.toContain('data-check="broken_links"');
  });
});
