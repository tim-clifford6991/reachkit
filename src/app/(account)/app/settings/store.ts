// BUILD §4.7 — every settings fact, read for the account that owns it.
//
// Until #228 `readSettings` spread `FIXTURE_SETTINGS_FACTS` and overrode
// four groups, so ten facts reached a real signed-in customer from the
// fixture: the mode their pages publish under, the veto window, the publish
// time, the zone, whether publishing is on at all, their voice, their
// do-not-claim list, their notification switches, their page count and
// REQ-071's pending market change. Every one is now read.
//
// **The fixture is behind `isReservedFixtureAccount` and nowhere else**
// (DECISIONS 2026-09-06, and #192's rule): `example.com` is IANA-reserved,
// so no customer can hold the name that reaches it.
//
// **Two facts degrade; the other eight do not, and that asymmetry is the
// point.** A fixture value is a *claim* — a mode the customer never chose,
// a date nobody measured — and a customer acting on one is worse off than a
// customer told the product could not read it. Billing and destinations
// have a stated degraded arm because REQ-097 c5 and c6 design one for them.
// The rest have none: there is no honest way to draw a veto window or a
// do-not-claim list that was not read, and a default in its place is the
// same defect as the fixture with a different provenance. Those reads
// propagate, and the route's own error boundary is what the customer meets
// — a screen that failed, rather than a screen quietly stating settings
// they never chose.
//
// **Every read is bounded and made concurrently** (DECISIONS 2026-09-07,
// #186): this screen is dynamic, so an unsettled read would hang it, and
// ten sequential reads would be ten round trips deep on a database that is
// slow.
import type { DestinationView } from "@/lib/publish/types";
import type { AppAccount } from "../_session/account";
import type { AccountFacts, BillingFacts, SettingsFacts } from "./model";

/** How long any one read may take before it is abandoned — for the two
 *  facts that degrade, into their stated arm; for the rest, into the
 *  screen's own failure. `src/middleware.ts` bounds its one request-path
 *  read the same way and for the same reason. */
const READ_DEADLINE_MS = 800;

function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error("settings read timed out")), READ_DEADLINE_MS)
    ),
  ]);
}

/**
 * One bounded read: the module is resolved first, and only the call it
 * makes is raced.
 *
 * The order matters. Resolving a module is not reading a fact — it is
 * compilation and disk — and a cold process that spent the read's whole
 * budget getting to the function would report a database that answered
 * promptly as one that could not be reached. The deadline exists to bound
 * *the database*, so it starts where the database call does.
 */
async function bounded<M, T>(load: () => Promise<M>, call: (loaded: M) => Promise<T>): Promise<T> {
  const loaded = await load();
  return withDeadline(call(loaded));
}

/** A read that could not be made. `null` is not used for these: `null` is a
 *  value several of these facts legitimately have, and the two must not be
 *  confused. */
export type Read<T> = { ok: true; value: T } | { ok: false };

async function read<M, T>(
  load: () => Promise<M>,
  call: (loaded: M) => Promise<T>
): Promise<Read<T>> {
  try {
    return { ok: true, value: await bounded(load, call) };
  } catch {
    return { ok: false };
  }
}

/** REQ-097 c1's one destination. A ReachKit address rather than a vendor
 *  one, so a stale portal session is never baked into a page. */
const BILLING_SURFACE = "/app/settings";

/**
 * The billing facts, or the arm that says they could not be read.
 *
 * REQ-097 c5 keeps every billing *value* off this surface — what the card
 * states is the plan state, the date access runs to, and one control — so
 * a failed read costs the customer two statements and no number. REQ-097
 * c6's three sentences are what the degraded arm renders, and they already
 * exist as keys (#136).
 */
async function readBilling(userId: string): Promise<BillingFacts> {
  const summary = await read(
    () => import("@/lib/account/billing"),
    ({ billingSummary }) => billingSummary(userId)
  );
  if (!summary.ok || !summary.value.ok) return { readable: false, surfaceHref: BILLING_SURFACE };
  return {
    readable: true,
    state: summary.value.summary.state,
    paidThrough: summary.value.summary.paidThrough,
    surfaceHref: BILLING_SURFACE,
  };
}

export interface DestinationsFacts {
  list: readonly DestinationView[];
  /** False where the registry could not be read. An empty list and an
   *  unreadable one are different facts: "you have no destination" is a
   *  state the customer can act on, and "we could not read it" is not. */
  readable: boolean;
}

async function readDestinations(siteId: string): Promise<DestinationsFacts> {
  const list = await read(
    () => import("@/lib/publish/destinations"),
    ({ listDestinations }) => listDestinations(siteId)
  );
  return list.ok ? { list: list.value, readable: true } : { list: [], readable: false };
}

/**
 * §4.7's account card: the name, the address, a change awaiting
 * confirmation, and the note keys.
 *
 * A read that fails leaves the card unrenderable — there is no honest arm
 * for "we do not know your address" — so it propagates and the screen's own
 * failure states it. Until #228 it fell back to the fixture's founder, which
 * showed a real customer somebody else's address.
 *
 * Exported because it is the account half of this screen's read and is
 * asserted as one (`tests/app/settings/account-read.test.ts`); the other
 * nine reach modules with suites of their own.
 */
export async function readAccountFacts(userId: string): Promise<AccountFacts> {
  const card = await bounded(
    () => import("@/lib/account/identity"),
    ({ accountCard }) => accountCard(userId)
  );
  if (card === null) {
    // No row for the signed-in account. There is no arm of this card that
    // states an address the product does not hold, so the screen fails
    // rather than drawing one.
    throw new Error(`settings: no account row for ${userId}`);
  }
  return {
    name: card.name,
    email: card.email,
    pendingEmail: card.pending,
    noteKeys: card.noteKeys,
  };
}

/**
 * Everything §4.7 states about one real account.
 *
 * Ten reads, run together. Each is the module that owns the fact —
 * `readPublishingSettings` for the four §9 settings, `isPublishingOn` for
 * the switch, the generation store for the voice and the claim list, the
 * notifications module for the three toggles — so no fact on this screen is
 * read by a query of its own that could disagree with the one the engine
 * uses.
 */
export async function readLiveSettingsFacts(
  /** A *set-up* account: REQ-073 c1's zone is stated, because every time on
   *  this screen is expressed in it and no read path falls back to the
   *  server's. `requireSetUpAccount()` is what narrows it. */
  account: AppAccount & { timeZone: string }
): Promise<SettingsFacts> {
  const { siteId, userId } = account;

  const [
    answers,
    measured,
    publishing,
    publishingOn,
    site,
    notify,
    pages,
    billing,
    destinations,
    card,
  ] =
    await Promise.all([
      bounded(() => import("@/lib/market/changes"), (m) => m.declaredAnswers(siteId)),
      bounded(() => import("@/lib/market/changes"), (m) => m.measuredAnswers(siteId)),
      bounded(() => import("@/lib/publish/settings"), (m) => m.readPublishingSettings(siteId)),
      bounded(() => import("@/lib/publish/switch"), (m) => m.isPublishingOn(siteId)),
      bounded(() => import("@/lib/generate/store"), (m) => m.generateStore().siteFacts(siteId)),
      bounded(() => import("@/lib/mail/notifications"), (m) => m.readNotifyPrefs(userId)),
      bounded(() => import("./pages"), (m) => m.livePageCount(siteId)),
      readBilling(userId),
      readDestinations(siteId),
      readAccountFacts(userId),
    ]);

  // REQ-071's pending change is a *computation*, never a record (ADR-030):
  // the difference between what the customer has declared and what the
  // current scan measured. `pendingChanges` is the one place that
  // difference is drawn, and this screen reads its first entry — §4.7 gives
  // the market card one written line, and two dated sentences on it would
  // be the same fact pretending to be two.
  const { pendingChanges } = await import("@/lib/market/changes");
  // Only the two kinds this card writes a line for. `pendingChanges` also
  // reports a rivals change, and #204 gave the market card two copy keys
  // (`CHANGE_COPY_KEY`) — a third kind here would be a line with no
  // sentence, which is a key this issue may not invent.
  const [change] = pendingChanges({
    declared: answers,
    measured,
    now: new Date(),
    timezone: account.timeZone,
  }).filter((entry): entry is typeof entry & { kind: "domain" | "category" } =>
    entry.kind === "domain" || entry.kind === "category"
  );

  return {
    // The three answers the site is measured as (#42). The domain and the
    // zone come from the session's own row rather than a second read of it.
    domain: account.domain,

    pendingChange: change === undefined ? null : { kind: change.kind, effectiveOn: change.effectiveOn },
    // Not a read, and not the fixture's `null` either: `editing` is the
    // kind the customer is part-way through typing, which exists in their
    // browser and nowhere a server could look. The server render states no
    // unsaved change (#204's `saved: false` line belongs to the client), so
    // this is the only value it can honestly carry.
    editing: null,

    // A site whose market has not been named yet reads as the empty
    // category. The read this replaced answered `FIXTURE_SETTINGS_FACTS
    // .category` here, on the reasoning that "an empty string would be a
    // category" — but the fixture's value is a category, and a real one:
    // it told a customer who had named no market that theirs was user
    // onboarding software. A blank beside the label is the fact; the card
    // states it and offers the control that names one.
    category: answers.category ?? "",
    competitors: answers.rivals,

    // §9's four publishing settings, and the switch.
    mode: publishing.mode,
    vetoHours: publishing.vetoHours,
    publishTime: publishing.publishTime,
    timeZone: account.timeZone,
    publishingEnabled: publishingOn,

    voiceText: site?.voiceText ?? "",
    doNotClaim: site?.doNotClaim ?? [],

    destinations: destinations.list,
    destinationsReadable: destinations.readable,

    ...card,
    notifyPrefs: notify,

    billing,
    publishedPages: pages,
  };
}
