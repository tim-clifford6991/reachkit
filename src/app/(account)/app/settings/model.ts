// BUILD §4.7 — the whole of what Settings states, in one shape.
//
// WO-179 `## Goal`: "Assemble `SettingsModel` from one read of `sites`,
// `destinations` and `users`, with notification toggles projected from the
// stoppable subset of `MAIL_KINDS` rather than hand-written."
//
// `assembleSettings` is pure: facts in, model out. The reading of those facts
// is `provider.ts`'s, and today it reads a fixture — issue #18 builds this
// screen on fixture data behind the typed provider, exactly as issue #9 built
// the shell. Keeping the assembly pure is what lets every criterion be
// decided by a test with no database at all.
//
// The model carries a value for each of the fourteen `SETTABLE` keys and
// nothing a control could bind to besides. It carries no measurement, no
// derived number and no billing figure at all: REQ-097 keeps the next
// invoice, the card and the invoice history off every ReachKit surface
// (`billing.ts` records the owner's ruling on which of §4.7's four things
// survive it), and `content.pages` is a count of the customer's own
// published pages, which is not a billing value and not a measurement.
//
// **`vetoHours` is read, never corrected.** WO-179 step 5: the rule — a whole
// multiple of 24 in [0, 168] — belongs to the publishing settings writer
// (issue #46) and to nothing else. "A read that 'corrects' a stored value
// would hide the very state [the] validator exists to prevent from ever being
// stored", so this module validates nothing and the screen renders what is
// there.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-08-31: Declared answer and measured answer are two facts; a pending change is
//   computed as their difference, never stored as a state. — ADR-030
//
// DECISIONS 2026-09-07: A pending settings change is the computed difference between the
//   declared answer on sites and the measured answer on the current scan (ADR-030): no queue,
//   no pending column, no change log; it clears when a pass completes. effectiveOn asks the
//   weekly clock (nextDueAfter), never +7 days. generationHold holds on a domain or category
//   change and not on a rival edit (REQ-071 c11). Change markers are derived from the scans
//   and sit on the later scan of a changed pair. do_not_claim has one writer, which sweeps
//   outstanding rechecks in the same function after the write lands. No settings Server
//   Function takes a site id. — #202
//
// DECISIONS 2026-09-07: REQ-071 lines: c1 and c6 are one statement on the market card chosen
//   in the model (the unsaved change outranks the saved one) and replace the standing §4.7
//   line; c16 sits where the rival chips would be; c11 is the calendar's eighth precedence
//   arm, change_holds_generation, between customer_change_holds_pages and page_held; {change}
//   is spoken through a key per change kind, never the discriminant; written lines live
//   outside the setting-* control namespace. — #227
//
// DECISIONS 2026-09-07: Settings refusal sentences are the Settings screen's own keys, not
//   setup's (a refusal to a founder mid-setup and to a customer editing an answer are two
//   voices); the rival set is read on the server and never sent from the browser — the two
//   rival actions take one typed domain. — #239
//
// DECISIONS 2026-09-07: Every §4.7 settings fact is read live for a non-reserved account
//   through the module that owns it (ten bounded concurrent reads); only billing and
//   destinations have a designed degraded arm (REQ-097 c5/c6) — every other unread fact
//   propagates to the error boundary rather than defaulting; a fixture binding may be passed
//   whole behind the reserved branch and never spread (rule in the no-fixture test); a
//   server-side read of users.notify goes through the admin client scoped by user id, because
//   the anon client carries no JWT and RLS answered absent for every user. — #245

import type { CopyKey } from "@/lib/presentation/copy";
// Imported by file and not through `@/lib/market/changes`'s barrel: the
// barrel re-exports `declared.ts`, which reaches `@/lib/db` and parses
// every deployment binding the moment it is evaluated. This module is pure
// — "keeping the assembly pure is what lets every criterion be decided by a
// test with no database at all" — and `pending.ts` imports only the week
// clock. ADR-092's idiom, applied to keep a leaf a leaf.
import { effectiveOn } from "@/lib/market/changes/pending";
import { CHANGE_COPY_KEY } from "../calendar/change-line";
import type { DestinationView } from "@/lib/publish/types";
import type { ACCOUNT_NOTE_KEYS } from "@/lib/account/identity/notes";
import type { PublishingMode } from "../_shell/model";
import { formatDate, formatDateTime } from "../_shell/format";
import type { BillingSummary, PlanState } from "./billing";
import { notificationRows, type NotificationRow, type NotifyKind } from "./notifications";

/** The destination read model, entire — **the registry's own
 *  `DestinationView`, not a narrower copy of it** (#48).
 *
 *  This screen carried three fields of its own until the registry landed
 *  (an id, a kind and a health), and with them it could render neither the
 *  one written line a broken destination owes the customer nor the action
 *  that is not ordinary Reconnect. A screen-shaped copy of an engine's
 *  read model is how a surface ends up unable to say what the engine
 *  knows, so there is one shape and the screen reads it.
 *
 *  `health` is a **state** and never an error (ADR-086): `expired` carries
 *  an action and the queue holds — it is not a failure the screen
 *  apologises for. */
export type {
  DestinationAction,
  DestinationHealth,
  DestinationKind,
  DestinationView,
  HealthReason,
} from "@/lib/publish/types";

export interface PublishingSettings {
  mode: PublishingMode;
  /** A whole multiple of 24 in [0, 168] — the screen's whole days 0 to 7
   *  (`VETO.minDays` / `VETO.maxDays`). The value the validator produced,
   *  not a value this module checked. */
  vetoHours: number;
  /** Time of day, as stored: 24-hour `HH:MM`. */
  publishTime: string;
  /** REQ-073 c1's one stored preference — the zone every time this screen
   *  and the shell state is expressed in. */
  timeZone: string;
  /** REQ-070 c1's "whether pages publish at all". */
  enabled: boolean;
}

/** What `src/lib/account/billing`'s `billingSummary` answers, as this
 *  screen needs it. Deliberately three members and no billing value:
 *  REQ-097 criterion 5 keeps the next invoice, the card and the invoice
 *  history off every ReachKit surface, and `billing.ts` records the ruling
 *  that settled which of §4.7's four things survive it. */
/**
 * The billing facts, or the arm that says they could not be read (#228).
 *
 * **A union, not a nullable field.** Until #228 an unreadable read fell
 * back to the fixture's plan state and date, which put a state the customer
 * never held and a date nobody measured on their own screen. There is no
 * honest value for either, so the shape has no place to put one: the
 * `readable: false` arm carries the control and nothing else, and REQ-097
 * c6's three sentences are what the card states in their place.
 */
export type BillingFacts =
  | {
      readable: true;
      state: PlanState;
      /** `users.paid_through` — the access gate (ADR-050), and REQ-076
       *  criterion 3's "the exact date their access ends". It is also the
       *  day the next invoice falls, which is why S18's "next invoice" row
       *  needs no second date and no second read (#374). */
      paidThrough: Date;
      /** REQ-097 c1's one destination. */
      surfaceHref: string;
      /** The card on file's last four, or `null` where nothing read one —
       *  see `billing.ts` for why it is never invented. */
      cardLast4: string | null;
    }
  | { readable: false; surfaceHref: string };

/** REQ-071 c1/c6's one statement: the date, the answer being replaced, and
 *  which of the two criteria this is. A name of its own because the panel
 *  chooses one too — see `marketChange` below. */
export interface MarketChange {
  on: string;
  changeKey: CopyKey;
  saved: boolean;
}

export interface SettingsModel {
  market: {
    category: string;
    /**
     * REQ-071 c1 and c6, as one statement (issue #204).
     *
     * `on` is the written date — an instant on the facts and a written
     * moment here, the one-place-only rule `billing.paidThrough` already
     * follows. `changeKey` is the registry key for the answer being
     * replaced, never the engine's own `ChangeKind` handle: `{change}` is
     * a fragment the owner writes and "domain" is an internal name.
     *
     * `saved` is which of the two criteria this is: `false` while the
     * customer is still typing (c1 — the consequence read before the
     * button), `true` once it is saved and standing until the pass adopts
     * it (c6). `null` where neither is true, and the card then states its
     * standing effect line instead.
     */
    change: MarketChange | null;
    /**
     * The date a change saved right now would take effect —
     * `effectiveOn()`'s own answer, written once, in the customer's zone.
     *
     * On the model rather than computed where it is needed because c1's
     * line is stated *before* a save, and by then the fact deciding
     * whether to state it (which field the customer opened) is the
     * browser's. One date, written on the server, and no arithmetic on
     * the screen (issue #231).
     */
    wouldTakeEffectOn: string;
  };
  competitors: readonly string[];
  domain: string;
  publishing: PublishingSettings;
  destinations: readonly DestinationView[];
  voice: { text: string };
  doNotClaim: readonly string[];
  notifications: readonly NotificationRow[];
  account: AccountCardView;
  billing: BillingSummary;
  /** §4.7's "pages count" — how many of the customer's pages are published. */
  content: { pages: number };
}

/**
 * The account card, as the screen states it (#134).
 *
 * `noteKeys` is `accountCard()`'s own list and not a copy of it: REQ-077
 * criterion 1 names two note lines in an order, identity returns the keys
 * in that order, and a screen that held its own array would be the copy
 * that goes stale the day a third is added. The card speaks no sentence of
 * its own — it renders the keys it is handed.
 */
/** The account half of `SettingsFacts`, named so the provider's read and
 *  its fallback are one shape and a field cannot be forgotten in either. */
export interface AccountFacts {
  name: string | null;
  email: string;
  pendingEmail: { email: string; expiresAt: Date } | null;
  noteKeys: typeof ACCOUNT_NOTE_KEYS;
}

export interface AccountCardView {
  /** `null` where the account has stated no name. */
  name: string | null;
  email: string;
  /** The address awaiting confirmation and the moment its link lapses, as
   *  a written moment in the customer's own zone — or `null`. */
  pending: { email: string; expiresAt: string } | null;
  noteKeys: typeof ACCOUNT_NOTE_KEYS;
}

/** Everything Settings reads, before it is a model. One shape, so a fixture
 *  and the three queries that replace it answer the same question. */
export interface SettingsFacts {
  /**
   * The instant this screen is being read at.
   *
   * A fact like every other, and a parameter rather than a clock read
   * inside `assembleSettings` (issue #304). Two things follow from it. The
   * function's own header says it is pure — facts in, model out — and a
   * `new Date()` in the middle of it made that untrue: the same facts gave
   * two different models on two different weeks. And the market card
   * carries two dates that must mean the same moment, `pendingChange`'s and
   * `wouldTakeEffectOn`'s; the store read the clock once for the first and
   * the model read it again for the second, so a render that straddled the
   * boundary between them would have stated two different weeks on one
   * card.
   *
   * The reserved fixture account passes a fixed instant, the same way
   * `FIXTURE_BILLING.paidThrough` is fixed and for the same reason — a
   * fixture that moves makes the layout sweep non-deterministic.
   */
  now: Date;
  /** `sites` (§10). */
  domain: string;
  /** REQ-071's pending market change, or `null`. `pendingChanges()`'s own
   *  first entry — the engine has already decided what differs and when it
   *  takes effect, and this screen reads both (issue #204). `editing` is
   *  the kind the customer is part-way through changing, which is c1's
   *  before-the-save state and is the screen's own fact, not a row. */
  pendingChange: { kind: "domain" | "category"; effectiveOn: Date } | null;
  editing: "domain" | "category" | null;
  category: string;
  competitors: readonly string[];
  mode: PublishingMode;
  vetoHours: number;
  publishTime: string;
  timeZone: string;
  publishingEnabled: boolean;
  voiceText: string;
  doNotClaim: readonly string[];
  /** `destinations` (§10), health included — read as a state (#48). */
  destinations: readonly DestinationView[];
  /** False where the registry could not be read (#228). An empty list and
   *  an unreadable one are different facts, and only the first is one the
   *  customer can act on. */
  destinationsReadable: boolean;
  /** `users` (§10), plus the notify preferences the toggles read. A kind
   *  absent from the record reads as on. `name` is `null` where the account
   *  has not stated one — `accountCard()` returns the column as it is, and
   *  a blank is a fact rather than a missing string to be filled in. */
  name: string | null;
  email: string;
  /** REQ-077 c4's change awaiting confirmation, or `null`. An **instant**
   *  here and a written moment on the model, the same one-place-only rule
   *  `billing.paidThrough` follows two fields down. A change past its
   *  window arrives here as `null`: the window is computed by
   *  `accountCard()` and never stored, so its lapse needs no sweeper and
   *  this screen holds no clock of its own. */
  pendingEmail: { email: string; expiresAt: Date } | null;
  /** REQ-077 c1's two note lines, in the order the criterion names them —
   *  `accountCard()`'s `noteKeys`, carried through untouched. */
  noteKeys: typeof ACCOUNT_NOTE_KEYS;
  notifyPrefs: Partial<Record<NotifyKind, boolean>>;
  /** The billing facts (#34), before they are a card. `paidThrough` is an
   *  instant here and a written day on the model: the customer's own stated
   *  zone is applied once, below, and nowhere else (REQ-073 c3). */
  billing: BillingFacts;
  /** `publications` (§10) — the customer's live pages. */
  publishedPages: number;
}

/**
 * REQ-071 c1/c6's one statement, chosen here.
 *
 * The unsaved change outranks the saved one: a customer who is typing is
 * being told what the button they are about to press will do, and the
 * older saved change is a fact they have already been given. Only one line
 * either way — §4.7 gives this card one written line, and two dated
 * sentences on it would be the same fact pretending to be two.
 *
 * **Exported, and called twice with the same rule** (issue #231). Which
 * answer the customer is part-way through changing is a fact the browser
 * settles, after the server has rendered the card: `MarketPanel` opens a
 * field and asks this function again with the field it opened. The
 * precedence is stated once, here, rather than a second time on the
 * screen — the card model chooses the line, and the panel renders it.
 */
export function marketChange(
  market: SettingsModel["market"],
  editing: "domain" | "category" | null
): MarketChange | null {
  if (editing === null) return market.change;
  return {
    // Before the save there is no stored difference to read, so the date is
    // the one a change saved now would take — written on the model, above,
    // and read here (issue #204, #231).
    on: market.wouldTakeEffectOn,
    changeKey: CHANGE_COPY_KEY[editing],
    saved: false,
  };
}

/** The saved half: REQ-071 c6's standing change, read as the difference
 *  between the declared and measured answers (`pendingChanges()`), or
 *  `null` where there is none and the card states its standing effect
 *  line instead. */
function savedChange(facts: SettingsFacts): MarketChange | null {
  if (facts.pendingChange === null) return null;
  return {
    on: formatDate(facts.pendingChange.effectiveOn, facts.timeZone),
    changeKey: CHANGE_COPY_KEY[facts.pendingChange.kind],
    saved: true,
  };
}

export function assembleSettings(facts: SettingsFacts): SettingsModel {
  const market = {
    category: facts.category,
    change: savedChange(facts),
    wouldTakeEffectOn: formatDate(
      effectiveOn({ savedAt: facts.now, timezone: facts.timeZone }),
      facts.timeZone
    ),
  };
  return {
    // The same chooser the panel calls, with the same fact, so REQ-071's
    // precedence is decided in one place whichever side settled it.
    market: { ...market, change: marketChange(market, facts.editing) },
    competitors: facts.competitors,
    domain: facts.domain,
    publishing: {
      mode: facts.mode,
      vetoHours: facts.vetoHours,
      publishTime: facts.publishTime,
      timeZone: facts.timeZone,
      enabled: facts.publishingEnabled,
    },
    destinations: facts.destinations,
    voice: { text: facts.voiceText },
    doNotClaim: facts.doNotClaim,
    notifications: notificationRows(facts.notifyPrefs),
    account: {
      name: facts.name,
      email: facts.email,
      pending:
        facts.pendingEmail === null
          ? null
          : {
              email: facts.pendingEmail.email,
              expiresAt: formatDateTime(facts.pendingEmail.expiresAt, facts.timeZone),
            },
      noteKeys: facts.noteKeys,
    },
    billing: facts.billing.readable
      ? {
          readable: true,
          state: facts.billing.state,
          // The one place the paid-through instant becomes a day a customer
          // reads, in the zone they stated. A card that formatted it would
          // be a second formatter, and the two would disagree the day one
          // of them was corrected.
          accessUntil: formatDate(facts.billing.paidThrough, facts.timeZone),
          surfaceHref: facts.billing.surfaceHref,
          cardLast4: facts.billing.cardLast4,
        }
      : { readable: false, surfaceHref: facts.billing.surfaceHref },
    content: { pages: facts.publishedPages },
  };
}
