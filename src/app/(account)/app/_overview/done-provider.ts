// SPEC §4 (2026-10-10, issue 1395) — the one read behind the process under
// Settings › Market.
//
// The reserved fixture account answers from the fixture below and reaches
// no database (DECISIONS 2026-09-06); every other account answers from its
// own rows (`done-store.ts`), imported at the call so this screen's module
// graph holds no database client. `React.cache` makes it one read a
// request.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { HARD_RULES } from "@/lib/generate/rules/types";
import type { DoneFacts } from "./done";

/** The fixture account's newest pass (`fixture.ts`: the Monday before Friday
 *  4 September 2026). */
const FIXTURE_PASS = Object.freeze({
  searches: 12,
  questions: 25,
  engines: Object.freeze(["ai_mode", "chatgpt"] as const),
  at: new Date(Date.UTC(2026, 7, 31, 6, 0, 0)),
});

export const FIXTURE_DONE_FACTS: DoneFacts = Object.freeze({
  // The list a page is checked against; its length is not restated here.
  checks: HARD_RULES.length,
  lastMeasured: FIXTURE_PASS,
  rivals: 3,
  ready: 30,
  pagesRead: 84,
  publishTime: "07:00",
  goLive: Object.freeze({ connected: true, publishing: true, stopped: false }),
  remeasureOn: new Date(Date.UTC(2026, 8, 7, 12, 0, 0)),
});

export const readDone = cache(async function readDone(): Promise<DoneFacts> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return FIXTURE_DONE_FACTS;
  const { readDoneFacts } = await import("./done-store");
  return readDoneFacts({ siteId: account.siteId, domain: account.domain, timeZone: account.timeZone });
});
