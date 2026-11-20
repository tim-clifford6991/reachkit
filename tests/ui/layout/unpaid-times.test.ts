// SPEC §3: while the paid check holds a site's pages, no screen states when one goes live.
// Paid shows the time on Overview, Calendar and the page in review; a failed payment and a lapsed term show none.
import { describe, expect, it } from "vitest";
import { getBaseURL, getUnpaidAccountCookie, withPage } from "./browser";
import { checkContainment, checkNoHorizontalScroll } from "./checks";
import { axeOffenders, NO_OVERFLOW_SCROLL_CONTAINERS, settleForMeasurement } from "./no-overflow";
import { sql } from "./seed";
import { UNPAID_ACCOUNT, UNPAID_DRAFT_ID } from "./seed-unpaid";

/** Each screen's publish time, by the element that carries it. */
const TIME_ON: Readonly<Record<string, string>> = {
  "/app": '[data-testid="overview-waiting"] time',
  "/app/calendar": '[data-testid="plan-week-time"]',
  [`/app/draft/${UNPAID_DRAFT_ID}`]: '[data-testid="draft-goes-live"]',
};

async function timesShown(): Promise<Record<string, number>> {
  const shown: Record<string, number> = {};
  await withPage(
    1280,
    async (page) => {
      for (const [path, selector] of Object.entries(TIME_ON)) {
        await page.goto(`${getBaseURL()}${path}`, { timeout: 15_000 });
        shown[path] = await page.locator(selector).count();
      }
    },
    { extraHTTPHeaders: { Cookie: getUnpaidAccountCookie() } }
  );
  return shown;
}

const NONE = Object.fromEntries(Object.keys(TIME_ON).map((path) => [path, 0]));

describe("a site that is not paid for states no publish time", () => {
  it("paid shows one on each screen; past_due and a lapsed term show none", async () => {
    expect(Object.entries(await timesShown()).filter(([, count]) => count === 0)).toEqual([]);
    sql(`update users set plan_status = 'past_due' where id = '${UNPAID_ACCOUNT.userId}';`);
    expect(await timesShown()).toEqual(NONE);
    sql(`update users set plan_status = 'active', paid_through = '2026-01-01T00:00:00.000Z' where id = '${UNPAID_ACCOUNT.userId}';`);
    expect(await timesShown()).toEqual(NONE);
  }, 180_000);

  it("access ended at once draws Settings' Ended arm with no Resume, no overflow and no serious axe finding", async () => {
    sql(`update users set plan_status = 'canceled', paid_through = '2026-01-01', cancelled_at = '2026-01-01' where id = '${UNPAID_ACCOUNT.userId}';`);
    for (const width of [390, 768, 1023, 1280]) for (const theme of ["light", "dark"] as const) {
      const seen = await withPage(width, async (page) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(`${getBaseURL()}/app/settings/account`, { timeout: 15_000 });
        await settleForMeasurement(page);
        const offenders = [...(await page.evaluate(checkNoHorizontalScroll)), ...(await page.evaluate(checkContainment, { scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS })), ...(await axeOffenders(page))];
        return { ended: await page.locator('[data-testid="billing-ended"]').count(), resume: await page.locator('[data-testid="action-resume"]').count(), offenders };
      }, { extraHTTPHeaders: { Cookie: getUnpaidAccountCookie() } });
      expect(seen, `${width}px ${theme}`).toEqual({ ended: 1, resume: 0, offenders: [] });
    }
  }, 600_000);
});
