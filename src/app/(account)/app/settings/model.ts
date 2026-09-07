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
export interface BillingFacts {
  state: PlanState;
  /** `users.paid_through` — the access gate (ADR-050), and REQ-076
   *  criterion 3's "the exact date their access ends". */
  paidThrough: Date;
  /** REQ-097 c1's one destination. */
  surfaceHref: string;
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
    change: { on: string; changeKey: CopyKey; saved: boolean } | null;
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
 * REQ-071 c1/c6's one statement, chosen and written here.
 *
 * The unsaved change outranks the saved one: a customer who is typing is
 * being told what the button they are about to press will do, and the
 * older saved change is a fact they have already been given. Only one line
 * either way — §4.7 gives this card one written line, and two dated
 * sentences on it would be the same fact pretending to be two.
 */
function marketChange(facts: SettingsFacts): SettingsModel["market"]["change"] {
  const zoneWritten = (on: Date): string => formatDate(on, facts.timeZone);
  if (facts.editing !== null) {
    return {
      // Before the save there is no stored difference to read, so the date
      // is the one a change saved now would take: `effectiveOn()`'s own
      // answer, and no arithmetic here (issue #204).
      on: zoneWritten(effectiveOn({ savedAt: new Date(), timezone: facts.timeZone })),
      changeKey: CHANGE_COPY_KEY[facts.editing],
      saved: false,
    };
  }
  if (facts.pendingChange === null) return null;
  return {
    on: zoneWritten(facts.pendingChange.effectiveOn),
    changeKey: CHANGE_COPY_KEY[facts.pendingChange.kind],
    saved: true,
  };
}

export function assembleSettings(facts: SettingsFacts): SettingsModel {
  return {
    market: { category: facts.category, change: marketChange(facts) },
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
    billing: {
      state: facts.billing.state,
      // The one place the paid-through instant becomes a day a customer
      // reads, in the zone they stated. A card that formatted it would be
      // a second formatter, and the two would disagree the day one of them
      // was corrected.
      accessUntil: formatDate(facts.billing.paidThrough, facts.timeZone),
      surfaceHref: facts.billing.surfaceHref,
    },
    content: { pages: facts.publishedPages },
  };
}
