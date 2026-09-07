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
import { assembleSettings, type AccountFacts, type BillingFacts, type SettingsModel } from "./model";
import { FIXTURE_SETTINGS_FACTS } from "./fixture";
import { FIXTURE_USER_ID } from "../../setup/_setup/fixture";

// How long any one of this screen's reads may take before it renders anyway.
//
// Chosen here rather than pinned in `constants.ts` for the reason
// `src/middleware.ts`'s `REMOVAL_READ_DEADLINE_MS` states of its own: it is
// a property of this screen's own request-path reads, not a product bound
// anything else reads, and a number in two files is wrong. Generous against
// an indexed lookup by primary key; short against a person waiting for a
// screen. The same 800 ms, for the same trade, that file puts in front of
// every report render.
//
// **A `catch` alone does not cover this.** A request that never settles
// never rejects, so a database that is unreachable rather than merely broken
// would hang Settings instead of degrading it.
//
// **It applies to all three reads because #134 is what put them on the
// request path**, and they are made concurrently so the bound is paid once
// rather than three times. Reading the session calls `cookies()`, which makes this
// route dynamic — until then Next prerendered `/app/settings` at build time
// and its billing and destinations reads happened once, there. Now they
// happen per request, so all three are bounded rather than only the two this
// issue added. The layout conformance sweep is where that showed up:
// `/app/settings` rendered in about a second against a dead port before this
// change and timed out at every width after it.
const READ_DEADLINE_MS = 800;

/** Rejects when `work` has not settled inside the deadline, so the caller's
 *  own `catch` covers a hang the same way it covers a failure. The timer is
 *  cleared once the race is over: a screen that read in 40 ms must not leave
 *  three timers behind on every render it serves. */
async function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("a settings read timed out")), READ_DEADLINE_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * The signed-in account (#134).
 *
 * `src/middleware.ts` has already refused this request unless it carried a
 * session cookie, so a caller reaching here is signed in; **which** account
 * it is, is identity's `currentSession()`. It answers `null` for an absent,
 * malformed, forged, expired, ended or tombstoned cookie, and this returns
 * the fixture account there rather than throwing the screen away — the same
 * fail-towards-the-fixture shape the billing read has had since #34, and
 * what keeps a preview with no session, the layout build and the
 * presentation sweeps rendering a whole screen.
 *
 * Nothing on that path writes: every control takes the *session's* own id at
 * the press (`account-actions.ts`, `billing-actions.ts`) and refuses where
 * there is none, so a fixture id here can render a card and can never act
 * for somebody else's account.
 *
 * The import is at the call, not at the top, for the reason
 * `readBillingFacts` states below.
 */
async function currentUserId(): Promise<string> {
  try {
    const { currentSession } = await import("@/lib/account/identity");
    const session = await withDeadline(currentSession());
    return session?.userId ?? FIXTURE_USER_ID;
  } catch {
    return FIXTURE_USER_ID;
  }
}

/** REQ-097 c1's one destination, as the model's fallback. The action seam
 *  mints a live portal session at the press; this is what the card points
 *  at in a render where no action has been taken, and it is a ReachKit
 *  address rather than a vendor one so that a stale session URL is never
 *  baked into a page. */
const BILLING_SURFACE = "/app/settings";

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
    // No environment, or a store that could not be constructed at all.
    // The card falls back to the fixture's facts rather than throwing the
    // screen away — and nothing it then states is stale, because nothing it
    // states came from a vendor (REQ-097 c5).
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
  try {
    return await withDeadline(listDestinations(siteId));
  } catch {
    // Bounded like the other two, and falling back the same way: the card
    // draws the fixture's own destination rather than an empty list, which
    // is what it already did for every render with no site id.
    return FIXTURE_SETTINGS_FACTS.destinations;
  }
}

/**
 * REQ-077 criteria 1 and 4, as the card reads them (#134).
 *
 * The name, the address, the change awaiting confirmation and the two note
 * lines all come from one call to `accountCard()`. This screen computes
 * none of them — in particular it does **not** decide whether a pending
 * change has lapsed. That window is `accountCard()`'s, computed from
 * `pending_email_sent_at` and never stored, and a second copy of the
 * arithmetic here is how a screen ends up offering to cancel a change that
 * is already over.
 *
 * Falls back to the fixture's account for a read that cannot be made, the
 * same as the billing half — and the fixture holds no pending change, so
 * the fallback can never invent one.
 */
export async function readAccountFacts(userId: string): Promise<AccountFacts> {
  try {
    const { accountCard } = await import("@/lib/account/identity");
    const card = await withDeadline(accountCard(userId));
    if (card === null) return FIXTURE_ACCOUNT;
    return {
      name: card.name,
      email: card.email,
      pendingEmail: card.pending,
      noteKeys: card.noteKeys,
    };
  } catch {
    return FIXTURE_ACCOUNT;
  }
}

/** The fixture's own account slice, named once so both fallbacks above
 *  return the same three fields and no fourth is forgotten. */
const FIXTURE_ACCOUNT: AccountFacts = {
  name: FIXTURE_SETTINGS_FACTS.name,
  email: FIXTURE_SETTINGS_FACTS.email,
  pendingEmail: FIXTURE_SETTINGS_FACTS.pendingEmail,
  noteKeys: FIXTURE_SETTINGS_FACTS.noteKeys,
};

export const readSettings = cache(async function readSettings(): Promise<SettingsModel> {
  // The session first, because two of the three reads are *about* an
  // account and cannot be made without knowing which. The three that follow
  // are independent of each other and are made together: sequentially they
  // would be three round trips on every render of this screen, and — since
  // each is bounded — three deadlines deep on a database that is
  // unreachable, where concurrently they are one.
  const userId = await currentUserId();
  const [billing, destinations, account] = await Promise.all([
    readBillingFacts(userId),
    readDestinations(currentSiteId()),
    readAccountFacts(userId),
  ]);
  return assembleSettings({ ...FIXTURE_SETTINGS_FACTS, ...account, billing, destinations });
});
