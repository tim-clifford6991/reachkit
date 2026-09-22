// SPEC §4 · §6 (2026-09-22, #1004) — the one read the two mentions cards
// make.
//
// Built exactly like `answers-provider.ts` next door and for the same three
// reasons:
//
//   · **Which account.** The session's, through `_session/account.ts`. A
//     request with no session is refused before any read.
//   · **The fixture answers for the reserved fixture account and nothing
//     else.** `example.com` is IANA-reserved, so a customer can never hold
//     the name that reaches it.
//   · **No module fetches for itself.** The page calls this once and the
//     cards are pure functions of what it returns, so the render performs
//     no measurement, no vendor call and no model call. Nothing on this
//     screen is bought.
//
// **The tracked set comes from the answers model, not from a second read.**
// *Also appearing for* is defined by exclusion — the questions that are
// **not** among the tracked ones — so it has to know what is tracked, and
// the tab has already read exactly that for the grid. `readAnswers` is
// `cache`d, so asking it here is the same request's answer rather than a
// second round trip; a second read of the twelve is how one screen comes to
// exclude a different twelve from the one it is drawing.
//
// `mentions-store.ts` is imported **at the call**, never at the top: it
// resolves `@/lib/db` and the weekly leaf, both of which parse the
// deployment's own bindings at module load, and the reserved account's AI
// answers tab reaches no database at all.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readAnswers } from "./answers-provider";
import { assembleMentions, type MentionsModel } from "./mentions-model";
import { FIXTURE_MENTIONS_FACTS } from "./mentions-fixture";

export const readMentions = cache(async function readMentions(): Promise<MentionsModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assembleMentions(FIXTURE_MENTIONS_FACTS);

  const answers = await readAnswers();
  // Both halves of the grid: the market's twelve and the published pages'
  // own questions (#919). A page question is a tracked question, so a
  // mention matching one is not something the site is *also* appearing for.
  // Each question contributes both the search it was phrased from and its
  // wording, because a vendor's record of what a buyer asked may match
  // either spelling.
  const tracked = [...answers.questions, ...answers.pageQuestions].flatMap((question) => [
    question.search,
    question.wording.text,
  ]);

  const [{ readMentionFacts }, { now }] = await Promise.all([
    import("./mentions-store"),
    import("@/lib/config/now"),
  ]);
  return assembleMentions(
    await readMentionFacts({ siteId: account.siteId, timeZone: account.timeZone }, now(), tracked)
  );
});
