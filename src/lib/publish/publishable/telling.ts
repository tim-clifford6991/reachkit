// BUILD §9 · §12 — the telling: what the customer is told, when the pair
// changes, and the one mail that cannot be suppressed.
//
// §9's promise is draft-by-default, and REQ-057 c8 states what makes it
// true across a draft's whole life: "No page publishes on a pair the
// customer was never told about, and no page publishes at all without their
// having been told, on the pair it actually publishes under, either the
// interval they have to stop it or that no interval exists."
//
// **This module writes no mail and no sentence.** It returns the occasion,
// the copy key and the values the key interpolates. `sendEmail()` sends;
// the strings are the owner's.
//
// Three kinds, derived from the governing pair **alone** — nothing about
// the destination enters the kind:
//
//   autopilot, window > 0  → `interval`      (c1)
//   autopilot, window = 0  → `no_interval`   (c7)
//   copilot, any window    → `approval_only` (c1)
//
// The destination clause is composed separately, at the moment the telling
// is composed, and is **not part of the pair** (BP-046 decision 5). Putting
// destination health in the pair would make every health flap re-open the
// telling and hold pages on a precondition c8 never names; what holds a
// page against a destination that cannot publish is the
// `destination_working` guard, which already exists.
//
// The archived plan is WO-216.
import { publishDb } from "../db";
import { adapterFor, destinationOf, withConfig } from "../destinations";
import type { DestinationKind, DraftView, GoverningPair, ToldRecord, VetoLink } from "../types";
import { samePair } from "../settings/pair";
import { becomesPublishable } from "./predicate";

/**
 * REQ-057 criterion 9. What the telling says about the destination.
 *
 * Present only for a page bound for the customer's own site — decided from
 * `hostedByUs === false` on the adapter, **never** from
 * `kind === 'wordpress'`. Since ADR-084 `servesPublicly` is true at both
 * destinations and can no longer answer that question; the two properties
 * are coextensive today, which is exactly why a kind check would pass every
 * test that exists.
 *
 * `null` at a destination ReachKit serves, which criterion 9 does not speak
 * about.
 */
export type DestinationClause =
  | {
      says: "goes_live_there";
      site: string;
      copy:
        | "mail.draftReady.dest.goesLiveThen"
        | "mail.draftReady.dest.goesLiveAtOnce"
        | "mail.draftReady.dest.goesLiveOnApproval";
    }
  /** ReachKit already reads that site as one it cannot publish to. The
   *  telling says the page cannot go live there as things stand and what
   *  must change. It **suppresses nothing else**: the date criteria 1, 7
   *  and 8 have it name is still named, the stop action is still offered,
   *  and the zero-window mail is still unsuppressible. It only stops the
   *  telling asserting the page goes live there then, or that approving it
   *  will make it live. */
  | { says: "cannot_go_live_there"; site: string; copy: "mail.draftReady.dest.cannotPublish" };

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
  | {
      kind: "approval_only";
      destination: DestinationClause | null;
      copy: "mail.draftReady.copilot";
    }
  /** The page has no publish moment to name yet — the site has no stated
   *  time zone, so no date exists to tell the customer. The page is held by
   *  the same absence (`becomesPublishable` answers `zone_not_set`), so
   *  nothing publishes untold; this arm exists so a caller cannot compose a
   *  mail naming a moment nobody could compute. */
  | { kind: "not_yet_tellable"; because: "zone_not_set" };

export type TellingKind = Telling["kind"];

export interface TellingInput {
  draft: DraftView;
  /** The destination the page is bound for. The clause is read for this one
   *  destination, at the moment the telling is composed. */
  destination: DestinationKind;
  /** The stop action, issued by the caller before composing. Absent for
   *  every kind but `interval`, which is the only kind that offers one. */
  stopAction?: VetoLink;
}

/**
 * The telling owed for a page right now.
 *
 * Asynchronous because criterion 9's third arm binds on what ReachKit reads
 * "at the moment that telling is sent": the destination's health is read
 * here, never taken from `drafts.told`. Every other input is a pure
 * function of the `DraftView`.
 */
export async function tellingFor(a: TellingInput): Promise<Telling> {
  const kind = kindOf(a.draft.governing);
  const destination = await destinationClause(a.draft.siteId, a.destination, kind);

  if (kind === "approval_only") {
    return { kind, destination, copy: "mail.draftReady.copilot" };
  }

  const answer = becomesPublishable(withoutHolds(a.draft));
  if (!answer.publishable) {
    // The only way a page under autopilot with a started window has no
    // moment to name is a site with no stated zone. Nothing is composed
    // around a date nobody could compute.
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

/**
 * The kind, from the governing pair alone.
 *
 * Nothing about the destination, the draft's state or the clock enters
 * here — which is what lets the same three kinds serve criterion 1's first
 * telling and criterion 8's further ones without a fourth arm.
 */
export function kindOf(pair: GoverningPair): Exclude<TellingKind, "not_yet_tellable"> {
  if (pair.mode === "copilot") return "approval_only";
  return pair.vetoHours === 0 ? "no_interval" : "interval";
}

/** True only for `kind: 'no_interval'`: that telling is the whole of the
 *  telling, so no notification setting suppresses it and it carries no
 *  unsubscribe link — "because no link would stop it" (REQ-057 c7).
 *
 *  Adding an unsubscribe link to that mail will look like a compliance fix
 *  and is not one: the link would stop nothing, which is a false statement
 *  to the customer about the one thing they might act on. */
export function isUnsuppressible(t: Telling): boolean {
  return t.kind === "no_interval";
}

export type ToldAnswer =
  | { told: true }
  | { told: false; because: "never_told" | "pair_changed" };

/**
 * REQ-057 c8's precondition, as the `customer_told` guard reads it.
 *
 * One comparison, over the four members of the governing pair **and no
 * fifth**. The destination clause is stored in `drafts.told` as sent and is
 * deliberately not compared: a destination that goes healthy → unhealthy
 * between two evaluations must not re-open the telling obligation.
 */
export function toldCurrentPair(d: DraftView): ToldAnswer {
  const record = d.told;
  if (record === null) return { told: false, because: "never_told" };
  return samePair(record.pair, d.governing)
    ? { told: true }
    : { told: false, because: "pair_changed" };
}

/** Writes `drafts.told`: the pair, what was said, the moment named and the
 *  moment it was sent. Called by the sender **after** the send succeeded —
 *  a send that failed leaves the telling owed, and the page held. */
export async function recordTold(
  draftId: string,
  t: Telling,
  pair: GoverningPair,
  sentAt: Date = new Date()
): Promise<void> {
  if (t.kind === "not_yet_tellable") return;
  const record: ToldRecord = {
    pair,
    kind: t.kind,
    publishesAt: t.kind === "approval_only" ? null : t.publishesAt.toISOString(),
    sentAt: sentAt.toISOString(),
  };
  const { error } = await publishDb()
    .from<never>("drafts")
    .update({ told: record as unknown as Record<string, unknown> })
    .eq("id", draftId);
  if (error !== null) {
    throw new Error(`src/lib/publish/publishable: could not record the telling: ${error.message}`);
  }
}

/**
 * Criterion 9's clause, composed at send time.
 *
 * `hostedByUs === true` ⇒ `null`: a destination ReachKit serves is not what
 * criterion 9 speaks about. `false` ⇒ the site is named, and whether the
 * clause says the page goes live there or that it cannot is read from the
 * destination's health **now**.
 *
 * A kind with no adapter in this build has no `hostedByUs` to read, and no
 * clause is composed: a page bound for a destination the product cannot
 * reach is held by `destination_working`, and a mail must not assert
 * anything about a site nothing can answer for.
 */
async function destinationClause(
  siteId: string,
  kind: DestinationKind,
  telling: Exclude<TellingKind, "not_yet_tellable">
): Promise<DestinationClause | null> {
  const adapter = adapterFor(kind);
  if (adapter === null || adapter.hostedByUs) return null;

  const row = await destinationOf(siteId, kind);
  if (row === null) return null;

  const site = await siteOf(row.id);
  // `ok` is the whole test today. The `cannot_publish` reason ADR-086 adds
  // (a credential that can create posts but cannot publish them) is #48's
  // and lands as a further health reading; it joins this arm, not a new
  // one, because criterion 9 names one thing to say for both.
  if (row.health !== "ok") {
    return { says: "cannot_go_live_there", site, copy: "mail.draftReady.dest.cannotPublish" };
  }

  return {
    says: "goes_live_there",
    site,
    copy:
      telling === "no_interval"
        ? "mail.draftReady.dest.goesLiveAtOnce"
        : telling === "approval_only"
          ? "mail.draftReady.dest.goesLiveOnApproval"
          : "mail.draftReady.dest.goesLiveThen",
  };
}

/**
 * The address the clause names.
 *
 * Read from the destination's own config through the sealed-credential
 * door, which decrypts it, hands it to this callback and returns **what
 * this callback returns** — an address, never the config. The credential
 * that sits beside the address in the same object has no way out of the
 * callback and is not logged, thrown with or stored (issue #54; before it,
 * this function was handed the ciphertext and read an empty address out of
 * it).
 *
 * The empty string where there is nothing to name: a destination with no
 * credential stored has no address to put in a sentence, and the clause
 * that carries it is composed from a state, not from this.
 */
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

/**
 * The draft as the *telling* reads it.
 *
 * `becomesPublishable` is asked one question here — when does this page go
 * out — and the two holds that are about the page's own text rather than
 * about its moment (an unsaved edit, an outstanding claim re-check) would
 * make it answer "never", which is not a telling and not what the customer
 * needs to be told. Those two hold the page at the guard; they do not
 * change the date it is bound for.
 */
function withoutHolds(d: DraftView): DraftView {
  return { ...d, hasUnsavedEdit: false, claimRecheckOutstanding: false };
}
