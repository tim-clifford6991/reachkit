// BUILD §4.7 — the one read Settings makes.
//
// The typed seam WO-179 calls `readSettings`. The screen calls it and
// nothing else; what it reads behind the type is this issue's fixture
// (`fixture.ts`) for everything §4.7 states about the site, and — since
// issue #34 — the **real** billing facts, through
// `src/lib/account/billing`'s `billingSummary`.
//
// `React.cache` is what makes it one read per request even though the
// screen and any panel that later asks for itself would each ask: the page
// asks once and passes the model down today, and a later caller gets the
// same object rather than a second query. It is the same shape
// `_shell/provider.ts` uses, deliberately — two reads with two idioms is
// how a screen and its frame end up disagreeing about the site they are
// describing.
//
// **The billing read fails towards the fixture's shape, never towards a
// wrong number.** There is no number in it to be wrong: what `billingSummary`
// supplies is the plan state, the paid-through date and the portal address
// (REQ-097 c5 keeps every billing value off this surface, and `billing.ts`
// records the ruling). Where the read cannot be made — no session yet, no
// account, a store that is down — the card falls back to the fixture's
// facts rather than throwing the screen away, and the customer sees the one
// control REQ-097 criterion 1 puts in every billing value's place. Nothing
// stated is stale, because nothing stated came from a vendor.
//
// **`portalLink` is not called here.** A portal session is short-lived, and
// one minted on every render of Settings would be a vendor round trip per
// page view and an address that had expired by the time anybody pressed it.
// The card's controls take the customer to it through the action seam
// (`actions.ts`), which mints one at the press. `surfaceHref` on the model
// is the fallback destination for a render with no action available.
//
// **The destinations half is wired too** (#48). It goes through the
// publishing registry's `listDestinations`, which is what re-checks a
// destination whose state has gone stale before the list renders. The one
// thing still missing is *which site*: `currentUserId()` below has a
// stand-in and there is no site id to stand in for, so `currentSiteId()`
// answers `null` and the fixture's own destination is what the card draws.
// A fabricated id would be worse than none — it would send a real query to
// a row that does not exist and draw an empty list for every customer.
// The import is at the call for the same reason the billing one is.
//
// WO-179 step 2: no measurement, no vendor call and no model call happens
// here or downstream of here for the site's own facts. `listDestinations`
// reaches Postgres and resolves DNS for a hosted destination, and neither
// is a measurement, a vendor call or a model call.
import { cache } from "react";
import type { DestinationView } from "@/lib/publish/types";
import { assembleSettings, type BillingFacts, type SettingsModel } from "./model";
import { FIXTURE_SETTINGS_FACTS } from "./fixture";
import { FIXTURE_USER_ID } from "../../setup/_setup/fixture";

/** The signed-in account. `src/middleware.ts` has already refused this
 *  request unless it carried a session cookie, so a caller reaching here is
 *  signed in; **which** account it is, is #35's `currentSession()`, which
 *  does not exist yet. Until it does this returns the fixture account — the
 *  same stand-in, named the same way, that `src/app/api/setup/route.ts`
 *  uses, so there is one guess in the codebase and not two. */
function currentUserId(): string {
  return FIXTURE_USER_ID;
}

/** REQ-097 c1's one destination, as the model's fallback. The action seam
 *  mints a live portal session at the press; this is what the card points
 *  at in a render where no action has been taken, and it is a ReachKit
 *  address rather than a vendor one so that a stale session URL is never
 *  baked into a page. */
const BILLING_SURFACE = "/app/settings";

/**
 * How long the one read on this screen may take before the card falls back.
 *
 * Chosen here rather than pinned in `constants.ts` on the same grounds
 * `src/middleware.ts` states for its own: it is a property of this one
 * request-path read and lives in exactly one file. It exists because this
 * screen renders per request (#133 made every `(account)` route dynamic),
 * so a database that is slow or unreachable has to cost the card its
 * facts, not the customer their screen — and the `catch` below does not
 * cover that on its own, because a request that never settles never
 * rejects. The layout conformance sweep renders this screen against a
 * database that is not there, which is exactly that case.
 */
const BILLING_READ_DEADLINE_MS = 800;

function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error("billing read timed out")), BILLING_READ_DEADLINE_MS)
    ),
  ]);
}

export async function readBillingFacts(userId: string): Promise<BillingFacts> {
  try {
    // Imported at the call and not at the top of the file. `@/lib/account/
    // billing` reaches `@/lib/db`, which parses the environment the moment
    // it is imported — so a static import here would put a database client
    // in this screen's module graph and take the whole screen down anywhere
    // that graph is loaded without one: the layout conformance build, the
    // presentation sweeps, and `next build`'s own page-data collection.
    // Every other panel on this screen renders from facts; this is the one
    // that reads, and it reads at render time.
    const { billingSummary } = await import("@/lib/account/billing");
    const summary = await withDeadline(billingSummary(userId));
    if (summary.ok) {
      return {
        state: summary.summary.state,
        paidThrough: summary.summary.paidThrough,
        surfaceHref: BILLING_SURFACE,
      };
    }
    return FIXTURE_SETTINGS_FACTS.billing;
  } catch {
    // No environment, a store that could not be constructed at all, or a
    // read that did not answer inside the deadline. The card falls back to
    // the fixture's facts rather than throwing the screen away — and
    // nothing it then states is stale, because nothing it states came from
    // a vendor (REQ-097 c5).
    return FIXTURE_SETTINGS_FACTS.billing;
  }
}

/**
 * The site this request is about, or `null` where the session cannot say.
 *
 * `null` today, and honestly so: the session resolves an account (see
 * `currentUserId()` above) and nothing yet resolves the site under it. A
 * fabricated id would be worse than none — it would send a real query to a
 * row that does not exist and draw an empty destinations list for every
 * customer.
 */
export function currentSiteId(): string | null {
  return null;
}

/**
 * The site's destinations, read through the registry.
 *
 * The registry is the one place a destination's state, its written line
 * and its action are decided, and it re-checks a state older than the
 * freshness window before returning it — which is how §9's "never more
 * than 24 hours old whether or not a publish was attempted" is kept on the
 * screen the customer is looking at.
 */
export async function readDestinations(
  siteId: string | null
): Promise<readonly DestinationView[]> {
  if (siteId === null) return FIXTURE_SETTINGS_FACTS.destinations;
  // Imported where it is used, not at the top: the registry reaches
  // Postgres, and the fixture path — every render there is until #35 —
  // must not drag a database client into a screen that never asks it
  // anything.
  const { listDestinations } = await import("@/lib/publish/destinations");
  return listDestinations(siteId);
}

export const readSettings = cache(async function readSettings(): Promise<SettingsModel> {
  const billing = await readBillingFacts(currentUserId());
  const destinations = await readDestinations(currentSiteId());
  return assembleSettings({ ...FIXTURE_SETTINGS_FACTS, billing, destinations });
});
