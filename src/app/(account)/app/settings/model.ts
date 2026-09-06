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
// derived number and no billing figure of its own: the billing values are
// `FromStripe` (REQ-097) and `content.pages` is a count of the customer's own
// published pages, which is not a billing value and not a measurement.
//
// **`vetoHours` is read, never corrected.** WO-179 step 5: the rule — a whole
// multiple of 24 in [0, 168] — belongs to the publishing settings writer
// (issue #46) and to nothing else. "A read that 'corrects' a stored value
// would hide the very state [the] validator exists to prevent from ever being
// stored", so this module validates nothing and the screen renders what is
// there.
import type { PublishingMode } from "../_shell/model";
import type { BillingSummary } from "./billing";
import { notificationRows, type NotificationRow, type NotifyKind } from "./notifications";

/** §10's `destinations` row, as the screen needs it. `health` is a **state**
 *  and never an error (ADR-086, WO-179 step 4): `expired` carries a Reconnect
 *  action and the queue holds — it is not a failure the screen apologises
 *  for. */
export type DestinationKind = "hosted" | "wordpress";
export type DestinationHealth = "ok" | "expired" | "error";

export interface DestinationRow {
  id: string;
  kind: DestinationKind;
  health: DestinationHealth;
}

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

export interface SettingsModel {
  market: { category: string };
  competitors: readonly string[];
  domain: string;
  publishing: PublishingSettings;
  destinations: readonly DestinationRow[];
  voice: { text: string };
  doNotClaim: readonly string[];
  notifications: readonly NotificationRow[];
  account: { name: string; email: string };
  billing: BillingSummary;
  /** §4.7's "pages count" — how many of the customer's pages are published. */
  content: { pages: number };
}

/** Everything Settings reads, before it is a model. One shape, so a fixture
 *  and the three queries that replace it answer the same question. */
export interface SettingsFacts {
  /** `sites` (§10). */
  domain: string;
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
  destinations: readonly DestinationRow[];
  /** `users` (§10), plus the notify preferences the toggles read. A kind
   *  absent from the record reads as on. */
  name: string;
  email: string;
  notifyPrefs: Partial<Record<NotifyKind, boolean>>;
  /** Stripe's own summary (#34). Every value on it is `FromStripe`. */
  billing: BillingSummary;
  /** `publications` (§10) — the customer's live pages. */
  publishedPages: number;
}

export function assembleSettings(facts: SettingsFacts): SettingsModel {
  return {
    market: { category: facts.category },
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
    account: { name: facts.name, email: facts.email },
    billing: facts.billing,
    content: { pages: facts.publishedPages },
  };
}
