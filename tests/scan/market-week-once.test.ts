// The weekly market step claims its week before any spend: a second run of the same pass buys nothing, an owner's re-run takes the week over.
import "../opportunities/env";
import { expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
db.uniqueIndexes.push({ table: "market_changes", columns: ["site_id", "week_start"] });
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
const { claimMarketWeek } = await import("@/lib/scan/weekly/store");

it("claims a week once per pass, and again for a re-run's own pass", async () => {
  const week = { siteId: "site-1", weekStart: "2026-11-23" };
  expect([await claimMarketWeek({ ...week, scanId: "monday" }), await claimMarketWeek({ ...week, scanId: "monday" })]).toEqual([true, false]);
  expect([await claimMarketWeek({ ...week, scanId: "rerun" }), await claimMarketWeek({ ...week, scanId: "rerun" })]).toEqual([true, false]);
});
