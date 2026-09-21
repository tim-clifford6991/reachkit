// SPEC §4 (2026-09-20, #908) — the one read the Rivals tab makes of its
// own.
//
// The typed seam behind which this screen's counting cards and its table
// sit, built exactly like `search-provider.ts` and `answers-provider.ts`
// and for the same three reasons: the session decides which account, the
// fixture answers for the reserved fixture account and nothing else, and no
// module fetches for itself.
//
// **It is not the only read the route makes, and that is deliberate.** *How
// far ahead they are* is `readOverview().rivals` — the module the Overview
// tab's own tile is drawn from. One derivation of the gap means the tile
// and this card cannot come to disagree about which rival is nearest or by
// how much; a second would be a second answer to the same question, which
// is the thing this directory keeps refusing to have.
//
// `rivals-store.ts` is imported **at the call**, never at the top: it
// resolves `@/lib/db`, which parses the deployment's own bindings at module
// load, and the reserved account's Rivals tab reaches no database at all.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assembleRivals, type RivalsModel } from "./rivals-model";
import { FIXTURE_RIVALS_FACTS } from "./rivals-fixture";

export const readRivals = cache(async function readRivals(): Promise<RivalsModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assembleRivals(FIXTURE_RIVALS_FACTS);

  const { readRivalFacts } = await import("./rivals-store");
  const { now } = await import("@/lib/config/now");
  const at = now();
  return assembleRivals(
    await readRivalFacts(
      { siteId: account.siteId, timeZone: account.timeZone, domain: account.domain },
      at
    )
  );
});
