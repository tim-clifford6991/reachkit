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
// **Billing degrades; the other reads leave their panel unread, and that asymmetry is the
// point.** A fixture value is a *claim* — a mode the customer never chose,
// a date nobody measured — and a customer acting on one is worse off than a
// customer told the product could not read it. Billing has a stated
// degraded arm because REQ-097 c5 and c6 design one for it.
// The rest have none: there is no honest way to draw a veto window or a
// do-not-claim list that was not read, and a default in its place is the
// same defect as the fixture with a different provenance. Those reads are
// named in `unread`, and every panel that states one draws its error line
// while the tab's other panels, and billing, still draw.
//
// **Every read is made concurrently** (DECISIONS 2026-09-07, #186): ten
// sequential reads would be ten round trips deep on a database that is slow.
// A read waits for its answer; only a real failure leaves its panel unread.
import { now as clock } from "@/lib/config/now";
import type { AppAccount } from "../_session/account";
import { ACCOUNT_NOTE_KEYS } from "@/lib/account/identity/notes";
import { recorded } from "@/lib/ops/events";
import type { AccountFacts, BillingFacts, SettingsFacts, SettingsRead } from "./model";
import { paymentFailedOf } from "./billing";

/** One read, its module resolved at the call; a real failure is recorded under its name and rethrown. */
function logged<M, T>(name: string, load: () => Promise<M>, call: (loaded: M) => Promise<T>, siteId: string | null = null): Promise<T> {
  return recorded(load().then(call), name, siteId);
}

/** A read that could not be made. `null` is not used for these: `null` is a
 *  value several of these facts legitimately have, and the two must not be
 *  confused. */
export type Read<T> = { ok: true; value: T } | { ok: false };

async function read<M, T>(
  name: string,
  load: () => Promise<M>,
  call: (loaded: M) => Promise<T>,
  siteId: string | null = null
): Promise<Read<T>> {
  try {
    return { ok: true, value: await logged(name, load, call, siteId) };
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
export async function readBilling(userId: string): Promise<BillingFacts> {
  const [summary, spot] = await Promise.all([
    read("billing", () => import("@/lib/account/billing"), ({ billingSummary }) => billingSummary(userId)),
    import("@/lib/account/offer/spots").then(({ spotOf }) => spotOf(userId)).catch(() => null),
  ]);
  if (!summary.ok || !summary.value.ok) return { readable: false, surfaceHref: BILLING_SURFACE };
  return {
    readable: true,
    state: summary.value.summary.state,
    paidThrough: summary.value.summary.paidThrough,
    pagesOfflineOn: summary.value.summary.pagesOfflineOn,
    paymentFailed: paymentFailedOf(summary.value.summary.planStatus),
    surfaceHref: BILLING_SURFACE,
    spotTakenAt: spot?.takenAt ?? null,
  };
}

/**
 * §4.7's account card: the name, the address, a change awaiting
 * confirmation, and the note keys.
 *
 * A read that fails leaves the card unrenderable — there is no honest arm
 * for "we do not know your address" — so it propagates and the card's own
 * failure states it. Until #228 it fell back to the fixture's founder, which
 * showed a real customer somebody else's address.
 *
 * Exported because it is the account half of this screen's read and is
 * asserted as one (`tests/app/settings/account-read.test.ts`); the other
 * nine reach modules with suites of their own.
 */
export async function readAccountFacts(userId: string): Promise<AccountFacts> {
  const card = await logged(
    "card",
    () => import("@/lib/account/identity"),
    ({ accountCard }) => accountCard(userId)
  );
  if (card === null) {
    // No row for the signed-in account. There is no arm of this card that
    // states an address the product does not hold, so the card draws its
    // error line rather than one.
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
 * Ten reads, run together, each settling on its own. Each is the module that owns the fact —
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
  const unread: SettingsRead[] = [];
  const settle = <T,>(name: SettingsRead, work: Promise<T>): Promise<T | undefined> =>
    work.catch(() => {
      unread.push(name);
      return undefined;
    });

  const [answers, measured, publishing, publishingOn, site, notify, pages, billing, destinations, card, concluded, locale, writingVoice, cnameTarget] =
    await Promise.all([
      settle("answers", logged("answers", () => import("@/lib/market/changes"), (m) => m.declaredAnswers(siteId), siteId)),
      settle("measured", logged("measured", () => import("@/lib/market/changes"), (m) => m.measuredAnswers(siteId), siteId)),
      settle("publishing", logged("publishing", () => import("@/lib/publish/settings"), (m) => m.readPublishingSettings(siteId), siteId)),
      settle("publishingOn", logged("publishingOn", () => import("@/lib/publish/switch"), (m) => m.isPublishingOn(siteId), siteId)),
      settle("site", logged("site", () => import("@/lib/generate/store"), (m) => m.generateStore().siteFacts(siteId), siteId)),
      settle("notify", logged("notify", () => import("@/lib/mail/notifications"), (m) => m.readNotifyPrefs(userId), siteId)),
      settle("pages", logged("pages", () => import("./pages"), (m) => m.livePageCount(siteId), siteId)),
      readBilling(userId),
      settle("destinations", logged("destinations", () => import("@/lib/publish/destinations"), (m) => m.listDestinations(siteId), siteId)),
      settle("card", readAccountFacts(userId)),
      concludedFor(siteId),
      localeFor(siteId),
      // Issue 1390. A read that fails is "not chosen": the select then shows what ReachKit does, which is choose.
      logged("writingVoice", () => import("@/lib/generate/store"), async (m) => m.generateStore().writingVoice(siteId), siteId).catch(() => null),
      // The record's value, this site's own, as setup reads it.
      import("@/lib/publish/destinations/hosted/hostname").then((m) => m.siteEdgeOf(siteId)),
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
  // One clock read for the whole screen (issue #304). The market card's two
  // dates — the change already saved and the one a change saved now would
  // take — are answers about the same moment, and reading the clock twice
  // is what would let them disagree.
  //
  // Through the seam since #305, so this screen's dates hold still under the
  // sweep's frozen instant like every other surface's — the card states a
  // date in words, and a wall clock here would move a baseline the day the
  // sentence changed.
  const now = clock();
  const [change] = (answers === undefined || measured === undefined ? [] : pendingChanges({
    declared: answers,
    measured,
    now,
    timezone: account.timeZone,
  })).filter((entry): entry is typeof entry & { kind: "domain" | "category" } =>
    entry.kind === "domain" || entry.kind === "category"
  );

  return {
    now,
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
    category: answers?.category ?? "",
    competitors: answers?.rivals ?? [],
    measuredRivals: measured?.rivals ?? null,
    concluded,
    ...locale,

    // §9's four publishing settings, and the switch; an unread one is never drawn.
    mode: publishing?.mode ?? "autopilot",
    vetoHours: publishing?.vetoHours ?? 0,
    publishTime: publishing?.publishTime ?? "",
    timeZone: account.timeZone,
    publishingEnabled: publishingOn ?? false,

    voiceText: site?.voiceText ?? "",
    writingVoice,
    doNotClaim: site?.doNotClaim ?? [],

    destinations: destinations ?? [],
    cnameTarget,

    ...(card ?? { name: null, email: "", pendingEmail: null, noteKeys: ACCOUNT_NOTE_KEYS }),
    notifyPrefs: notify ?? {},

    billing,
    publishedPages: pages ?? 0,
    unread,
  };
}

interface LocaleQuery<R> extends PromiseLike<{ data: R[] | null; error: { message: string } | null }> {
  eq(column: string, value: string): LocaleQuery<R>;
  not(column: string, operator: string, value: null): LocaleQuery<R>;
  order(column: string, opts: { ascending: boolean }): LocaleQuery<R>;
  limit(n: number): LocaleQuery<R>;
}

/** D66: the stored pair, and the markets the newest pass read the site
 *  declaring. Fails soft: a read that raised leaves the default pair. */
async function localeFor(siteId: string): Promise<Pick<SettingsFacts, "locale">> {
  try {
    const [{ dbAdmin }, { DEFAULT_LOCALE, localeOf }] = await Promise.all([import("@/lib/db"), import("@/lib/locale/locales")]);
    const from = <R,>(table: string, columns: string): LocaleQuery<R> =>
      (dbAdmin() as unknown as { from(t: string): { select(c: string): LocaleQuery<R> } }).from(table).select(columns);
    const [site, newest] = await Promise.all([
      from<{ country: unknown; language: unknown }>("sites", "country, language").eq("id", siteId).limit(1),
      from<{ report: { locale?: { alsoServes?: unknown } } | null }>("scans", "report")
        .eq("site_id", siteId)
        .not("report", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const row = site.data?.[0];
    const tags = newest.data?.[0]?.report?.locale?.alsoServes;
    return {
      locale: {
        current: localeOf(row?.country, row?.language) ?? DEFAULT_LOCALE,
        alsoServes: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [],
      },
    };
  } catch {
    return {};
  }
}

/** D28 (#1185): the market and rivals ReachKit concluded, with their
 *  reasons. Fails soft: a read that raised states no reasons, and the two
 *  cards stand as they did before. */
async function concludedFor(siteId: string): Promise<SettingsFacts["concluded"]> {
  try {
    const { readSiteMarket } = await import("@/lib/market/infer/stored");
    const stored = (await readSiteMarket(siteId))?.stored ?? null;
    const current = stored?.current ?? null;
    if (stored === null || current === null) return null;
    return {
      category: current.category,
      categoryReason: current.categoryReason,
      reasons: Object.fromEntries(current.rivals.map((rival) => [rival.domain, rival.reason])),
      categoryOverridden: stored.categoryOverridden,
      rivalsOverridden: stored.rivalsOverridden,
    };
  } catch {
    return null;
  }
}
