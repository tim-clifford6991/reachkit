// SPEC §4 *Overview's four tiles* — the signed-in account's tiles and the list models their details
// render, read once a request and built by one function (`buildTiles`).
import { cache } from "react";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readAnswers } from "./answers-provider";
import { readPublished } from "./content-provider";
import { readRivals } from "./rivals-provider";
import { buildTiles, type TilesView } from "./tiles-build";
import { fixturePasses, tilePageOf } from "./tiles-fixture";

/** `null` where the rows could not be read: the row is not drawn, never zeros. */
export const readTiles = cache(async function readTiles(coming: number, goLive: boolean): Promise<TilesView | null> {
  const account = await requireSetUpAccount();
  try {
    const [published, rivals, answers] = await Promise.all([readPublished(), readRivals().catch(() => null), readAnswers().catch(() => null)]);
    if (published.pages === null) return null;
    const week = weekStartFor({ at: published.now, zone: account.timeZone });
    // Imported at the call: the store resolves `@/lib/db`, which the reserved account never reaches.
    const stored = isReservedFixtureAccount(account)
      ? { passes: fixturePasses(published.pages, week), pages: published.pages.map(tilePageOf) }
      : await import("./tiles-store").then((m) => m.readTileRows({ siteId: account.siteId, domain: account.domain, week }));
    const firstPage = rivals?.firstPage;
    return buildTiles({
      published,
      passes: stored.passes,
      rows: stored.pages,
      rivals: firstPage === undefined ? null : { you: firstPage.you.count, of: firstPage.of, rivals: firstPage.rivals, measuredAt: rivals?.measuredAt ?? null },
      pageQuestions: answers?.pageQuestions ?? [],
      domain: account.domain,
      week,
      coming,
      goLive,
    });
  } catch {
    return null;
  }
});
