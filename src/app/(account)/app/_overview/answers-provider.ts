// SPEC §4 · §6 (2026-09-20, #908) — the one read the AI answers tab makes.
//
// The typed seam behind which this screen's data sits, built exactly like
// `search-provider.ts` next door and for the same three reasons:
//
//   · **Which account.** The session's, through `_session/account.ts`. A
//     request with no session is refused before any read, and a session
//     whose account has not finished setup goes to `/setup`.
//   · **The fixture answers for the reserved fixture account and nothing
//     else.** `example.com` is IANA-reserved, so a customer can never hold
//     the name that reaches it.
//   · **No module fetches for itself.** The page calls this once; the tiles
//     and the grid are pure functions of what it returns, so the render
//     performs no measurement, no vendor call and no model call.
//
// `answers-store.ts` is imported **at the call**, never at the top: it
// resolves `@/lib/db`, which parses the deployment's own bindings at module
// load, and the reserved account's AI answers tab reaches no database at
// all.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assembleAnswers, type AnswersModel } from "./answers-model";
import { FIXTURE_ANSWERS_FACTS } from "./answers-fixture";

export const readAnswers = cache(async function readAnswers(): Promise<AnswersModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assembleAnswers(FIXTURE_ANSWERS_FACTS);

  const { readAnswerFacts } = await import("./answers-store");
  const { now } = await import("@/lib/config/now");
  return assembleAnswers(
    await readAnswerFacts({ siteId: account.siteId, timeZone: account.timeZone, domain: account.domain }, now())
  );
});
