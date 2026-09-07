// BUILD §4.7 · §9 — the WordPress destination answering the deleted-account
// mail's place port (issue #160).
//
// `src/lib/account/lifecycle/left-in-wordpress.ts` (#52) declares a
// `StampCapability` seam and answers `null` while nothing is registered —
// the honest answer, because REQ-079 criterion 6's sentences must carry
// their counts whether or not there is anywhere to look, and a guessed
// place sends a departing customer to a filter that returns nothing. #54
// landed the destination and did not wire it, because the fact the port
// needs did not exist. #160 stores that fact; this file is the missing
// call.
//
// **Why the wire lives on this side of the seam.** The same reason
// `src/lib/account/billing/access-gate.ts` lives in billing (ADR-050): the
// side that *knows the answer* registers it. The alternative — lifecycle
// reaching into `@/lib/publish/destinations` — would put a database client
// and the whole publishing graph behind a module every account surface
// imports, which is precisely what the port exists to avoid.
//
// **The seam is imported by file, never through `@/lib/account/lifecycle`.**
// `left-in-wordpress.ts` imports one type and nothing else; the barrel
// beside it re-exports the lifecycle store, the deletion run and the
// erasure tickets. Importing the barrel from inside publishing would build
// a cycle out of a registration.
//
// **`true` is a place and nothing else is.** `stamp_capable` is
// three-valued, and the two non-answers — a destination no probe has
// reached, and a probe that could not be read — are not "there is a list".
// Reading either as a place is the failure REQ-079 c6 names.
//
// **The base URL is read through `withConfig` and is not stored twice.**
// The customer's own site address lives in the sealed credential, which
// `withConfig` opens for the duration of one call and returns nothing of
// (the callback below returns a string, and the config is out of scope the
// moment it ends). A destination that has been disconnected holds no
// credential, so it has no address to give and the answer is `null`:
// `deleteAccount` asks this before it changes anything about the account,
// so the credential is still there at the moment the mail is composed.
import { WORDPRESS } from "@/lib/config/constants";
import {
  setStampCapability,
  type WordPressListPlace,
} from "@/lib/account/lifecycle/left-in-wordpress";
import { withConfig } from "../config";
import { readDestination } from "../store";

/**
 * The one place in this customer's own WordPress that brings ReachKit's
 * posts up together, or `null` where there is none.
 *
 * `null` for every case that is not a recorded `true` at a live WordPress
 * destination whose credential is still there. It is deliberately one
 * return value for several different reasons: the caller renders a sentence
 * with a count and no place, and there is no sentence that says *why* a
 * place is missing — a departing customer is owed the count, not a note
 * about our probe.
 */
export async function stampPlace(destinationId: string): Promise<WordPressListPlace | null> {
  const row = await readDestination(destinationId);
  // `true` and nothing else, read from the row the probe wrote. The kind
  // needs no test of its own: only an adapter that declares a stamp probe
  // can put a non-null value here, and the hosted adapter declares none.
  if (row === null || row.stamp_capable !== true) return null;

  try {
    const siteBaseUrl = await withConfig<{ baseUrl?: unknown }, string | null>(
      destinationId,
      async (cfg) => (typeof cfg.baseUrl === "string" && cfg.baseUrl !== "" ? cfg.baseUrl : null)
    );
    if (siteBaseUrl === null) return null;
    return { siteBaseUrl, stampSlug: WORDPRESS.stampSlug };
  } catch {
    // No credential, or one that would not open. Neither is an error to
    // report here: the mail still names the outcome and its count.
    return null;
  }
}

/**
 * Registers the port, once, from the application's boot path.
 *
 * A plain assignment: there is nothing to reach and nothing that can fail,
 * which is why it neither returns a result nor probes itself the way
 * `installActiveAccessGate` does — that one is asserted at boot because a
 * missing registration there stops a Monday tick for every customer, where
 * a missing registration here costs one sentence in one mail its link.
 */
export function installStampCapability(): void {
  setStampCapability({ place: stampPlace });
}
