// BUILD §4.3 — everything the setup screen reads, before it is a model.
//
// One shape, so a fixture and a future query answer the same question —
// the idiom `src/app/(account)/app/_shell/model.ts` already establishes for
// the app shell. `assembleSetup` is pure: facts in, model out. The reading
// of those facts is `provider.ts`'s, and today it reads `fixture.ts`.
import {
  initialSetupState,
  onSuggestionsSettled,
  type ReportFacts,
  type SetupState,
} from "@/lib/market/setup/state";
import { setupCards, type SetupCards } from "@/lib/publish/setup/cards";
import { BATTERY } from "@/lib/config/constants";

export interface SetupFacts {
  /** REQ-021 c6 versus c7. A completed report for the address the account
   *  will use — whether or not it was the report the purchase came from —
   *  or `null` for a purchase with no report behind it, in which case the
   *  address field is empty and nothing is pre-filled from the payment. */
  measured: { domain: string; report: ReportFacts } | null;
  /** REQ-026 c7's suggested rivals for the known market, or `null` where
   *  no market is known yet and none has been sought. An empty array is
   *  "sought and none came back" — a different state, with its own line
   *  (REQ-026 c10). */
  suggestedRivals: readonly string[] | null;
  /** §9's edge hostname, from `HOSTED_EDGE_CNAME_TARGET`. Read by the
   *  provider, never by the cards. */
  cnameTarget: string;
}

export interface SetupScreenModel {
  state: SetupState;
  cards: SetupCards;
  /** REQ-026 c9: the limit is stated on screen, so the screen is given it
   *  rather than spelling the number itself. */
  competitorsMax: number;
}

export function assembleSetup(facts: SetupFacts): SetupScreenModel {
  const opened = initialSetupState(facts.measured);
  const state =
    facts.suggestedRivals === null ? opened : onSuggestionsSettled(opened, facts.suggestedRivals);

  return {
    state,
    cards: setupCards({ siteDomain: state.siteDomain, cnameTarget: facts.cnameTarget }),
    competitorsMax: BATTERY.COMPETITORS_MAX,
  };
}
