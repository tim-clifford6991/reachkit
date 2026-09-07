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
// **The destinations half is wired too** (#48), and since #42 so is *which
// site*: both halves of the account come from `_session/account.ts`, the
// one seam every `(account)` surface resolves through (#169). Until then
// this file carried a fixture user id and answered `null` for the site, so
// the destinations card drew the fixture's own destination for every
// customer. The import is at the call for the same reason the billing one
// is.
//
// WO-179 step 2: no measurement, no vendor call and no model call happens
// here or downstream of here for the site's own facts. `listDestinations`
// reaches Postgres and resolves DNS for a hosted destination, and neither
// is a measurement, a vendor call or a model call.
import { cache } from "react";
import type { DestinationView } from "@/lib/publish/types";
import { assembleSettings, type AccountFacts, type BillingFacts, type SettingsModel } from "./model";
import { FIXTURE_SETTINGS_FACTS } from "./fixture";

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
async function currentAccount(): Promise<{ userId: string; siteId: string } | null> {
  try {
    const { appAccount } = await import("../_session/account");
    const result = await withDeadline(appAccount());
    return result.ok ? { userId: result.account.userId, siteId: result.account.siteId } : null;
  } catch {
    // A read that could not be made is not an account. The screen falls to
    // the fixture's facts rather than throwing itself away — the same
    // fail-towards-the-fixture shape the billing read has had since #34,
    // and what keeps a preview with no session, the layout build and the
    // presentation sweeps rendering a whole screen.
    return null;
  }
}

/** REQ-097 c1's one destination, as the model's fallback. The action seam
 *  mints a live portal session at the press; this is what the card points
 *  at in a render where no action has been taken, and it is a ReachKit
 *  address rather than a vendor one so that a stale session URL is never
 *  baked into a page. */
const BILLING_SURFACE = "/app/settings";

/**
 * How long any one read on this screen may take before its card falls back.
 *
 * Chosen here rather than pinned in `constants.ts` on the same grounds
 * `src/middleware.ts` states for its own: it is a property of this screen's
 * request-path reads and lives in exactly one file. It exists because this
 * screen renders per request (#133 made every `(account)` route dynamic),
 * so a database that is slow or unreachable has to cost the card its
 * facts, not the customer their screen — and the `catch` below does not
 * cover that on its own, because a request that never settles never
 * rejects. The layout conformance sweep renders this screen against a
 * database that is not there, which is exactly that case.
 *
 * **All three of this screen's reads are behind it** (#134 added the
 * account one and put the session read in front of them), and the three are
 * made concurrently in `readSettings` — so the bound is paid once rather
 * than three times, and the healthy path is one round trip shorter than
 * doing them in turn. The name kept its `BILLING_` prefix until this issue;
 * it guards more than billing now, and says so.
 */
const READ_DEADLINE_MS = 800;

function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error("a settings read timed out")), READ_DEADLINE_MS)
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
 * The site this request is about, or `null` where no session names one.
 *
 * `null` is the fixture path — a preview with no session, the layout build,
 * the presentation sweeps — and never a fabricated id: a made-up id would
 * send a real query to a row that does not exist and draw an empty
 * destinations list for every customer.
 */
export function currentSiteId(account: { siteId: string } | null): string | null {
  return account?.siteId ?? null;
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

/** The id the fixture path reads billing and account facts for. It names no
 *  real account: every write takes the *session's* own id at the press and
 *  refuses where there is none, so this can draw a card and can never act
 *  for somebody else's. */
export const FIXTURE_SETTINGS_ACCOUNT_ID = "settings-fixture-account";

/**
 * REQ-071's three answers, as the screen states them: the domain, the
 * market category and the rival set the site is measured against **from
 * now on** — the declared answers, not the measured ones.
 *
 * That is the right half of ADR-030's pair for this screen: Settings is
 * where a customer reads and corrects what they will be measured as. What
 * they were measured as is on every number elsewhere, carrying its own
 * date.
 *
 * A read that cannot be made falls to the fixture's answers, like every
 * other read here — the screen renders whole, and a control that writes
 * takes the session's own id at the press.
 */
async function readDeclaredAnswers(
  account: { siteId: string } | null
): Promise<{ domain: string; category: string; competitors: readonly string[] } | Record<string, never>> {
  if (account === null) return {};
  try {
    const { declaredAnswers } = await import("@/lib/market/changes");
    const answers = await withDeadline(declaredAnswers(account.siteId));
    return {
      domain: answers.domain,
      // A site with no category named yet reads the fixture's, which is
      // what the market card's `empty` arm is drawn from; an empty string
      // would be a category.
      category: answers.category ?? FIXTURE_SETTINGS_FACTS.category,
      competitors: answers.rivals,
    };
  } catch {
    return {};
  }
}

export const readSettings = cache(async function readSettings(): Promise<SettingsModel> {
  // The session first, because two of the three reads are *about* an
  // account and cannot be made without knowing which. The three that follow
  // are independent of each other and are made together: sequentially they
  // would be three round trips on every render of this screen, and — since
  // each is bounded — three deadlines deep on a database that is
  // unreachable, where concurrently they are one.
  const signedIn = await currentAccount();
  const userId = signedIn?.userId ?? FIXTURE_SETTINGS_ACCOUNT_ID;
  const [billing, destinations, account, answers] = await Promise.all([
    readBillingFacts(userId),
    readDestinations(currentSiteId(signedIn)),
    readAccountFacts(userId),
    readDeclaredAnswers(signedIn),
  ]);
  return assembleSettings({
    ...FIXTURE_SETTINGS_FACTS,
    ...answers,
    ...account,
    billing,
    destinations,
  });
});
