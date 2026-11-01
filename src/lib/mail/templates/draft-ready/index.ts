// BUILD §12 · SPEC §8 — the `draft-ready` mail, as a block list only (ADR-040): title, goes-live line, the fact rows, the page's first
// lines, *Read the full page* and *Stop this page*, with the searches a month up top and not repeated as a fact row.
// It lays out the telling `tellingFor` chose; choosing here would copy the rule the `customer_told` guard reads. The switch is exhaustive
// over the three tellable arms (`not_yet_tellable` is refused upstream), so a fourth does not compile.
// Only `interval` carries a `stopAction` (REQ-057 c7: a zero window issues no link); this file mints none and never renders an empty token.
// The model-written title travels only in `pageBody`, whose `GeneratedText` label names the page (ADR-012); `subject` is a `CopyKey`,
// so a title cannot reach the subject without its label.
// The why-data is §7's stored evidence, never re-measured. A `fix` page has none and is never drafted into review (§9), so none is stated.
import type { CopyKey } from "@/lib/presentation/copy";
import type { Measured } from "@/lib/measure/measured";
import type { Telling } from "@/lib/publish/publishable";
import type { FactRow, MailBlock } from "../../blocks/types";

const SUBJECT = "mail.draftReady.subject" satisfies CopyKey;
const WAITING_SUBJECT = "mail.draftReady.waiting.subject" satisfies CopyKey;
const PREHEADER = "mail.draftReady.preheader" satisfies CopyKey;
const WAITING_PREHEADER = "mail.draftReady.waiting.preheader" satisfies CopyKey;
const ADDRESS_NOT_CONNECTED = "mail.draftReady.dest.addressNotConnected" satisfies CopyKey;
const ADDRESS_NOT_CONNECTED_NO_RECORD = "mail.draftReady.dest.addressNotConnected.noRecord" satisfies CopyKey;
const RECORD_TYPE = "mail.draftReady.record.type" satisfies CopyKey;
const RECORD_NAME = "mail.draftReady.record.name" satisfies CopyKey;
const RECORD_VALUE = "mail.draftReady.record.value" satisfies CopyKey;
const HEADING = "mail.draftReady.heading" satisfies CopyKey;
const READY = "mail.draftReady.ready" satisfies CopyKey;
const REASON = "mail.reason.draftReady" satisfies CopyKey;
const STOP_ACTION = "mail.draftReady.stopAction" satisfies CopyKey;
const READ_ACTION = "mail.draftReady.readAction" satisfies CopyKey;
const STOP_NOTE = "mail.draftReady.stopNote" satisfies CopyKey;
const WHY_VOLUME = "mail.draftReady.why.volume" satisfies CopyKey;
// The board's four row labels.
const FACT_SEARCH = "mail.draftReady.fact.search" satisfies CopyKey;
const FACT_ANSWERED = "mail.draftReady.fact.answeredBy" satisfies CopyKey;
const FACT_CHANCES = "mail.draftReady.fact.chances" satisfies CopyKey;
const FACT_WRITTEN_FROM = "mail.draftReady.fact.writtenFrom" satisfies CopyKey;

/** The page's model-written title and its body, together, since the title's label is the block's own. */
export interface DraftReadyPage {
  readonly title: string;
  readonly markdown: string;
}

/** §7's stored evidence as §12's why-data; an unmeasured `volume` omits its row, never prints 0. */
export interface DraftReadyWhy {
  readonly query: string;
  readonly volume: Measured<number>;
  /** SPEC §8's other three fact rows, written by the caller; a row the evidence lacks is absent. */
  readonly answeredBy?: string;
  readonly chances?: string;
  readonly writtenFrom?: string;
}

/** The one setting an unconnected hosted address needs, each field as the
 *  customer types it where their domain is managed. */
export interface DraftReadyRecord {
  readonly type: string;
  readonly name: string;
  readonly value: string;
}

export interface DraftReadyMail {
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly subject: CopyKey;
  readonly preheader: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/** Every telling arm but the one with no moment, narrowed by type so the occasion module's refusal need not be trusted. */
export type TellableTelling = Exclude<Telling, { kind: "not_yet_tellable" }>;

/** The `draft-ready` mail for one telling. `publishesAt` is written by the caller in the customer's zone (REQ-073 c1).
 *  `stopHref` is the veto route's absolute address: required on `interval`, refused elsewhere, so a stop is never offered or dropped wrongly. */
export function buildDraftReady(a: {
  telling: TellableTelling;
  publishesAt?: string;
  stopHref?: string;
  /** Absent only without a title, which a page in review always has. */
  page?: DraftReadyPage;
  /** §7's stored evidence; absent for a `fix` page, which cannot reach this mail. */
  why?: DraftReadyWhy;
  /** SPEC §8: the page's address in the app, so *Read the full page* is a deep link; absent leaves the button off. */
  readHref?: string;
  /** Only on the not-connected arm, and only where the host has a record. */
  record?: DraftReadyRecord;
}): DraftReadyMail {
  const blocks: MailBlock[] = [];
  // No page goes live before the hosted address is connected, so no moment is named.
  const waitsForAddress = a.telling.destination?.copy === ADDRESS_NOT_CONNECTED;

  // The opening line, above the title: what this mail is.
  blocks.push({ block: "paragraph", text: READY });

  // S20's heading: the page's own title, which this kind is handed.
  if (a.page !== undefined) {
    blocks.push({ block: "heading", text: HEADING, vars: { title: a.page.title } });
  }

  // The one number up top: the searches a month. Unmeasured takes the block with it.
  if (a.why !== undefined) {
    blocks.push({ block: "hero", label: WHY_VOLUME, value: a.why.volume, format: "perMonth" });
  }

  // §12's "publishes tomorrow 09:00 unless you say no", either form; no arm asks for an approval.
  if (!waitsForAddress) {
    blocks.push({ block: "paragraph", text: a.telling.copy, vars: { publishesAt: a.publishesAt ?? "" } });
  }

  // REQ-057 c9's destination clause, as a `notice` beside the telling: a condition of their own site, which changes nothing c9 keeps.
  if (a.telling.destination !== null) {
    // The sentence says the setting is below only when it is.
    const record = waitsForAddress ? a.record : undefined;
    blocks.push({
      block: "notice",
      text: waitsForAddress && record === undefined ? ADDRESS_NOT_CONNECTED_NO_RECORD : a.telling.destination.copy,
      vars: { site: a.telling.destination.site },
    });
    if (record !== undefined) {
      blocks.push({
        block: "facts",
        items: [
          { label: RECORD_TYPE, value: record.type },
          { label: RECORD_NAME, value: record.name },
          { label: RECORD_VALUE, value: record.value },
        ],
      });
    }
  }

  // §7's stored evidence, never re-measured; each row only where the evidence has it, and an empty block drops itself.
  if (a.why !== undefined) {
    const facts: FactRow[] = [{ label: FACT_SEARCH, value: a.why.query }];
    if (a.why.answeredBy !== undefined) facts.push({ label: FACT_ANSWERED, value: a.why.answeredBy });
    if (a.why.chances !== undefined) facts.push({ label: FACT_CHANCES, value: a.why.chances });
    if (a.why.writtenFrom !== undefined) {
      facts.push({ label: FACT_WRITTEN_FROM, value: a.why.writtenFrom });
    }
    blocks.push({ block: "facts", items: facts });
  }

  // §12's "title" in the one carrier that keeps its `GeneratedText` label: the page's first lines, since the page is one link away.
  if (a.page !== undefined) {
    blocks.push({
      block: "pageBody",
      pageTitle: a.page.title,
      written: true,
      markdown: a.page.markdown,
    });
  }

  // The two buttons in board order: the one most wanted, then the stop.
  if (a.readHref !== undefined) {
    blocks.push({ block: "action", label: READ_ACTION, href: a.readHref, variant: "primary" });
  }

  // "one veto link" — one, on the one arm that has an interval to offer.
  if (a.telling.kind === "interval" && a.stopHref !== undefined) {
    blocks.push({
      block: "action",
      label: STOP_ACTION,
      href: a.stopHref,
      // Secondary: stopping is the second thing a reader does, and two solid fills would be two primaries.
      variant: a.readHref === undefined ? "primary" : "secondary",
    });
    // The stop link needs no session until the page is live, said beside its button.
    blocks.push({ block: "notice", text: STOP_NOTE });
  }

  return {
    subject: waitsForAddress ? WAITING_SUBJECT : SUBJECT,
    preheader: waitsForAddress ? WAITING_PREHEADER : PREHEADER,
    reason: REASON,
    blocks,
  };
}
