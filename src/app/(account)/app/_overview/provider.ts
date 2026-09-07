// BUILD §4.5 — the one read Overview makes.
//
// The typed seam behind which this screen's data sits. The page calls it
// once and nothing else; what it reads behind the type is now the
// signed-in account's own rows (`store.ts`) and this issue's fixture
// (`fixture.ts`) for the reserved fixture account and nothing else — one
// request-cached read, no second caller, no second shape.
//
// **Which account.** The session's, through `_session/account.ts` (issue
// #169). A request with no session is refused before any read — back to
// `/signin`, saying nothing about whether an account or a payment exists —
// and a session whose account has not finished setup goes to `/setup`.
//
// **The fixture answers for the reserved fixture account and nothing
// else** (DECISIONS 2026-09-06: "`*.example.com` fixtures answer only for
// reserved names"). `example.com` is IANA-reserved, so a customer can
// never hold the name that reaches it.
//
// **No module fetches for itself.** Every module on this screen is a pure
// function of the model this returns, so the render performs no
// measurement, no vendor call and no model call — a property
// `tests/app/overview/page.test.tsx` asserts rather than assumes, and one
// that a module reaching for its own data would quietly break.
//
// `React.cache` is what makes it one read per request even if a second
// caller ever asks.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assembleOverview, type OverviewModel } from "./model";
import { FIXTURE_OVERVIEW_FACTS } from "./fixture";

export const readOverview = cache(async function readOverview(): Promise<OverviewModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assembleOverview(FIXTURE_OVERVIEW_FACTS);

  // Imported at the call: `store.ts` resolves `@/lib/db`, which parses the
  // deployment's own bindings at module load, and the reserved account's
  // Overview reaches no database at all.
  const { readOverviewFacts } = await import("./store");
  return assembleOverview(
    await readOverviewFacts({ siteId: account.siteId, timeZone: account.timeZone })
  );
});
