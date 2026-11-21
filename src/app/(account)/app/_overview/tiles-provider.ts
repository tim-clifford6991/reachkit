// SPEC §4 *Overview's four tiles* — the signed-in account's tiles, read once a request.
import { cache } from "react";
import { now } from "@/lib/config/now";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readRivals } from "./rivals-provider";
import { tilesOf, type TilesModel } from "./tiles";

/** The reserved fixture account's: one tile in each state the row draws. */
const FIXTURE_TILES: TilesModel = {
  tiles: [
    { key: "pages", n: 9, of: { kind: "count", m: 10 }, change: { kind: "up", n: 2 }, series: [3, 4, 5, 6, 7, 9] },
    { key: "google", n: 4, of: { kind: "count", m: 9 }, change: { kind: "same" }, series: [1, 2, null, 3, 4, 4] },
    { key: "ai", n: 2, of: { kind: "count", m: 7 }, change: { kind: "unread" }, series: [0, 1, 1, 2, 2, null] },
    { key: "rivals", n: 3, of: { kind: "count", m: 12 }, change: { kind: "down", n: 1 }, series: null },
  ],
  bars: { you: 3, of: 12, rivals: [{ name: "bigcompetitor.com", value: 7 }, { name: "secondplace.io", value: 5 }] },
};

/** `null` where the rows could not be read: the row is not drawn, never zeros. */
export const readTiles = cache(async function readTiles(coming: number, goLive: boolean): Promise<TilesModel | null> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return FIXTURE_TILES;
  try {
    const at = now();
    const week = weekStartFor({ at, zone: account.timeZone });
    // Imported at the call: the store resolves `@/lib/db`, which the reserved account never reaches.
    const { readTileRows } = await import("./tiles-store");
    const [rows, rivals] = await Promise.all([
      readTileRows({ siteId: account.siteId, domain: account.domain, week }),
      readRivals().catch(() => null),
    ]);
    const firstPage = rivals?.firstPage;
    return tilesOf({
      ...rows,
      rivals:
        firstPage === undefined
          ? null
          : { you: firstPage.you.count, of: firstPage.of, rivals: firstPage.rivals, measuredAt: rivals?.measuredAt ?? null },
      now: at,
      week,
      coming,
      goLive,
    });
  } catch {
    return null;
  }
});
