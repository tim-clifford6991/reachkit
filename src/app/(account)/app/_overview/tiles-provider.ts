// SPEC §4 *Overview's four tiles* — the signed-in account's tiles and the list models their details
// render, read once a request and built by one function (`buildTiles`).
import { cache } from "react";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readAnswers } from "./answers-provider";
import { readPublished } from "./content-provider";
import { aiQuestionsOf, type AiQuestions } from "./ai-pages";
import { googleSearchOf, type GoogleSearch } from "./google-pages";
import { buildTiles, type TilesView } from "./tiles-build";
import { FIXTURE_VISITS, fixturePasses, tilePageOf } from "./tiles-fixture";

/** `null` where the rows could not be read: the row is not drawn, never zeros. */
/** `coming` and `goLive` may be promises, so a screen starts the rows' reads before the values they build with land. */
export const readTiles = cache(async function readTiles(coming: number | Promise<number>, goLive: boolean | Promise<boolean>): Promise<(TilesView & { questions: AiQuestions | null; search: GoogleSearch }) | null> {
  const account = await requireSetUpAccount();
  try {
    const [published, answers] = await Promise.all([readPublished(), readAnswers().catch(() => null)]);
    if (published.pages === null) return null;
    const week = weekStartFor({ at: published.now, zone: account.timeZone });
    const firstLive = published.pages.reduce<Date | null>((first, page) => (first === null || page.publishedAt < first ? page.publishedAt : first), null);
    const fixture = isReservedFixtureAccount(account);
    // Imported at the call: the stores resolve `@/lib/db`, which the reserved account never reaches.
    const [stored, visits] = await Promise.all([
      fixture
        ? { passes: fixturePasses(published.pages, week, answers?.pageQuestions ?? []), pages: published.pages.map(tilePageOf), gsc: null, hosted: true }
        : import("@/lib/measure/results-store").then((m) => m.readTileRows({ siteId: account.siteId, domain: account.domain, week })),
      fixture ? FIXTURE_VISITS : import("@/lib/publish/reads/visits").then((m) => m.readVisits({ siteId: account.siteId, now: published.now, firstLive })),
    ]);
    // The AI tile's read line stands on these rows: unreadable on a hosted site is the error screen, never no line or 0.
    if (stored.hosted && visits === null) return null;
    const view = buildTiles({
      published,
      passes: stored.passes,
      rows: stored.pages,
      visits: stored.hosted ? visits : "wordpress",
      pageQuestions: answers?.pageQuestions ?? [],
      domain: account.domain,
      gsc: stored.gsc,
      week,
      coming: await coming,
      goLive: await goLive,
    });
    return view === null ? null : { ...view, questions: aiQuestionsOf(view.ai, stored.passes, account.domain), search: googleSearchOf(view.google, stored.pages, stored.passes, account.domain) };
  } catch {
    return null;
  }
});
