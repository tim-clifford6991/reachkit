// SPEC §4 (2026-09-20, #908) — the one read the Search tab makes.
//
// The typed seam behind which this screen's data sits, built exactly like
// `provider.ts` next door and for the same three reasons:
//
//   · **Which account.** The session's, through `_session/account.ts`. A
//     request with no session is refused before any read, and a session
//     whose account has not finished setup goes to `/setup`.
//   · **The fixture answers for the reserved fixture account and nothing
//     else.** `example.com` is IANA-reserved, so a customer can never hold
//     the name that reaches it.
//   · **No module fetches for itself.** The page calls this once; the
//     tiles and the table are pure functions of what it returns, so the
//     render performs no measurement, no vendor call and no model call.
//
// `search-store.ts` is imported **at the call**, never at the top: it
// resolves `@/lib/db`, which parses the deployment's own bindings at module
// load, and the reserved account's Search tab reaches no database at all.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assembleSearch, type SearchModel } from "./search-model";
import { FIXTURE_SEARCH_FACTS } from "./search-fixture";

/** The date an unmeasured reading on this screen carries. The fixture's own
 *  measurement date for the reserved account, so the sweeps are
 *  deterministic; the clock for everybody else. */
const FIXTURE_AT = FIXTURE_SEARCH_FACTS.measuredAt ?? new Date(0);

export const readSearch = cache(async function readSearch(): Promise<SearchModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assembleSearch(FIXTURE_SEARCH_FACTS, FIXTURE_AT);

  const { readSearchFacts } = await import("./search-store");
  const { now } = await import("@/lib/config/now");
  const at = now();
  return assembleSearch(
    await readSearchFacts({ siteId: account.siteId, timeZone: account.timeZone }, at),
    at
  );
});
