// SPEC §4 *Overview's four tiles* — the signed-in account's tiles and the list models their details
// render, read once a request and built by one function (`buildTiles`).
import { cache } from "react";
import { BLOG_READS_RETENTION_W } from "@/lib/config/constants";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readAnswers } from "./answers-provider";
import { readBlogReads } from "./blog-reads-provider";
import { readPublished } from "./content-provider";
import { readRivals } from "./rivals-provider";
import { aiQuestionsOf, type AiQuestions } from "./ai-pages";
import { googleSearchOf, type GoogleSearch } from "./google-pages";
import { buildTiles, type TilesView } from "./tiles-build";
import { fixturePasses, tilePageOf } from "./tiles-fixture";

/** `null` where the rows could not be read: the row is not drawn, never zeros. */
export const readTiles = cache(async function readTiles(coming: number, goLive: boolean): Promise<(TilesView & { questions: AiQuestions | null; search: GoogleSearch }) | null> {
  const account = await requireSetUpAccount();
  // Every day kept, never the blog card's week; a failed read is the error screen, never "no line" or 0.
  const reads = await readBlogReads(BLOG_READS_RETENTION_W * 7);
  let aiOpened: TilesView["aiOpened"] = null;
  if (reads.show) {
    if (reads.fetches.kind === "unmeasured" || reads.referrals.kind === "unmeasured") throw new Error("tiles: could not read the AI reads");
    aiOpened = { fetches: reads.fetches.value, visits: reads.referrals.value };
  }
  try {
    const [published, rivals, answers] = await Promise.all([readPublished(), readRivals().catch(() => null), readAnswers().catch(() => null)]);
    if (published.pages === null) return null;
    const week = weekStartFor({ at: published.now, zone: account.timeZone });
    // Imported at the call: the store resolves `@/lib/db`, which the reserved account never reaches.
    const stored = isReservedFixtureAccount(account)
      ? { passes: fixturePasses(published.pages, week, answers?.pageQuestions ?? []), pages: published.pages.map(tilePageOf), gsc: null }
      : await import("@/lib/measure/results-store").then((m) => m.readTileRows({ siteId: account.siteId, domain: account.domain, week }));
    const firstPage = rivals?.firstPage;
    const view = buildTiles({
      published,
      passes: stored.passes,
      rows: stored.pages,
      rivals: firstPage === undefined ? null : { you: firstPage.you.count, of: firstPage.of, rivals: firstPage.rivals, measuredAt: rivals?.measuredAt ?? null },
      pageQuestions: answers?.pageQuestions ?? [],
      domain: account.domain,
      gsc: stored.gsc,
      week,
      coming,
      goLive,
    });
    return view === null ? null : { ...view, aiOpened, questions: aiQuestionsOf(view.ai, stored.passes, account.domain), search: googleSearchOf(view.google, stored.pages, stored.passes, account.domain) };
  } catch {
    return null;
  }
});
