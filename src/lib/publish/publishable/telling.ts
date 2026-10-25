// BUILD §9 · §12 — the telling: what the customer is told, when the pair changes, and the one mail that cannot be
// suppressed. REQ-057 c8: "No page publishes on a pair the customer was never told about, and no page publishes at all
// without their having been told, on the pair it actually publishes under, either the interval they have to stop it or
// that no interval exists."
// It writes no mail and no sentence: the occasion, the copy key and its values. Two kinds, from the pair alone:
//   autopilot, window > 0  → `interval`      (c1)
//   autopilot, window = 0  → `no_interval`   (c7)
// No telling says an approval is needed. The destination clause is not part of the pair (BP-046 decision 5), or every
// health flap would re-open the telling; `destination_working` holds such a page.
import { publishDb } from "../db";
import { adapterFor, destinationOf, withConfig } from "../destinations";
import type { DestinationKind, DraftView, GoverningPair, ToldRecord, VetoLink } from "../types";
import { samePair } from "../settings/pair";
import { becomesPublishable } from "./predicate";

/** REQ-057 c9: what the telling says about the destination, for a page bound for the customer's own site, decided from
 *  `hostedByUs === false`, never `kind === 'wordpress'`, which would pass every test today. `servesPublicly` is true at
 *  both since ADR-084. `null` at a destination we serve, unless its address is not connected yet. */
export type DestinationClause =
  | {
      says: "goes_live_there";
      site: string;
      copy:
        | "mail.draftReady.dest.goesLiveThen"
        | "mail.draftReady.dest.goesLiveAtOnce";
    }
  /** We read the site as one we cannot publish to, so the telling says so and what must change. It suppresses nothing
   *  else: the date, the stop action and the zero-window mail stay; it only stops claiming the page goes live there. */
  | {
      says: "cannot_go_live_there";
      site: string;
      /** `addressNotConnected`: a hosted address waiting for its record, so the mail names no moment. */
      copy: "mail.draftReady.dest.cannotPublish" | "mail.draftReady.dest.addressNotConnected";
    };

export type Telling =
  | {
      kind: "interval";
      publishesAt: Date;
      stopAction: VetoLink;
      destination: DestinationClause | null;
      copy: "mail.draftReady.autopilotWindow";
    }
  | {
      kind: "no_interval";
      publishesAt: Date;
      destination: DestinationClause | null;
      copy: "mail.draftReady.autopilotZero";
    }
  /** No stated zone, so no moment to name; the page is held by the same absence, and no mail names an uncomputable moment. */
  | { kind: "not_yet_tellable"; because: "zone_not_set" };

export type TellingKind = Telling["kind"];

export interface TellingInput {
  draft: DraftView;
  /** The destination the page is bound for, whose clause is read as the telling is composed. */
  destination: DestinationKind;
  /** The stop action, issued by the caller; only `interval` offers one. */
  stopAction?: VetoLink;
}

/** The telling owed now. Async because criterion 9 reads the destination's health "at the moment that telling is sent",
 *  never from `drafts.told`; everything else is the `DraftView`'s. */
export async function tellingFor(a: TellingInput): Promise<Telling> {
  const kind = kindOf(a.draft.governing);
  const destination = await destinationClause(a.draft.siteId, a.destination, kind);

  const answer = becomesPublishable(withoutHolds(a.draft));
  if (!answer.publishable) {
    // Only a site with no stated zone has no moment to name.
    return { kind: "not_yet_tellable", because: "zone_not_set" };
  }

  if (kind === "no_interval") {
    return {
      kind,
      publishesAt: answer.at,
      destination,
      copy: "mail.draftReady.autopilotZero",
    };
  }

  return {
    kind: "interval",
    publishesAt: answer.at,
    stopAction: a.stopAction ?? { token: "", expiresAt: a.draft.vetoDeadline },
    destination,
    copy: "mail.draftReady.autopilotWindow",
  };
}

/** The kind, from the pair alone, so criterion 1's first telling and criterion 8's later ones share it. */
export function kindOf(pair: GoverningPair): Exclude<TellingKind, "not_yet_tellable"> {
  return pair.vetoHours === 0 ? "no_interval" : "interval";
}

/** Only `no_interval`: that mail is the whole telling, so no setting suppresses it and it carries no unsubscribe link,
 *  "because no link would stop it" (REQ-057 c7). Adding one is not a compliance fix but a false statement. */
export function isUnsuppressible(t: Telling): boolean {
  return t.kind === "no_interval";
}

export type ToldAnswer =
  | { told: true }
  | { told: false; because: "never_told" | "pair_changed" };

/** REQ-057 c8's precondition for `customer_told`: the four pair members and no fifth. The stored destination clause is
 *  not compared, so a health change never re-opens the telling. */
export function toldCurrentPair(d: DraftView): ToldAnswer {
  const record = d.told;
  if (record === null) return { told: false, because: "never_told" };
  return samePair(record.pair, d.governing)
    ? { told: true }
    : { told: false, because: "pair_changed" };
}

/** Writes `drafts.told` after a successful send only, so a failed send leaves the telling owed and the page held. */
export async function recordTold(
  draftId: string,
  t: Telling,
  pair: GoverningPair,
  sentAt: Date = new Date(),
  mailed?: boolean
): Promise<void> {
  if (t.kind === "not_yet_tellable") return;
  const record: ToldRecord = {
    pair,
    kind: t.kind,
    publishesAt: t.publishesAt.toISOString(),
    sentAt: sentAt.toISOString(),
    ...(mailed === undefined ? {} : { mailed }),
  };
  const { error } = await publishDb()
    .from<never>("drafts")
    .update({ told: record as unknown as Record<string, unknown> })
    .eq("id", draftId);
  if (error !== null) {
    throw new Error(`src/lib/publish/publishable: could not record the telling: ${error.message}`);
  }
}

/** Criterion 9's clause at send time. Hosted by us is `null` unless its address waits for its record; otherwise the
 *  site is named, live or not by its health now. No adapter, no clause: `destination_working` holds that page. */
async function destinationClause(
  siteId: string,
  kind: DestinationKind,
  telling: Exclude<TellingKind, "not_yet_tellable">
): Promise<DestinationClause | null> {
  const adapter = adapterFor(kind);
  if (adapter === null) return null;
  if (adapter.hostedByUs) return hostedClause(siteId);

  const row = await destinationOf(siteId, kind);
  if (row === null) return null;

  const site = await siteOf(row.id);
  // `ok` is the whole test: ADR-086's `cannot_publish` arrives as `error` and joins this arm, one thing to say for both.
  if (row.health !== "ok") {
    return { says: "cannot_go_live_there", site, copy: "mail.draftReady.dest.cannotPublish" };
  }

  return {
    says: "goes_live_there",
    site,
    copy:
      telling === "no_interval"
        ? "mail.draftReady.dest.goesLiveAtOnce"
        : "mail.draftReady.dest.goesLiveThen",
  };
}

/** A hosted address waiting for its record; a live host, no host or a failed read says nothing. */
async function hostedClause(siteId: string): Promise<DestinationClause | null> {
  try {
    const { hostedHostFor } = await import("../destinations/hosted/hostname");
    const host = await hostedHostFor(siteId);
    if (host === null || host.state === "live") return null;
    return { says: "cannot_go_live_there", site: host.hostname, copy: "mail.draftReady.dest.addressNotConnected" };
  } catch {
    return null;
  }
}

/** The address the clause names, read through `withConfig`, which returns the address and never the config. `""` with
 *  no credential stored. */
async function siteOf(destinationId: string): Promise<string> {
  try {
    return await withConfig(destinationId, async (cfg: Record<string, unknown>) => {
      const url = cfg.baseUrl ?? cfg.siteUrl ?? cfg.site_url ?? cfg.host;
      return typeof url === "string" ? url : "";
    });
  } catch {
    return "";
  }
}

/** The draft as the telling reads it: when does it go out. An unsaved edit or claim re-check holds it at the guard but
 *  does not change its date, so they are cleared here. */
function withoutHolds(d: DraftView): DraftView {
  return { ...d, hasUnsavedEdit: false, claimRecheckOutstanding: false };
}
