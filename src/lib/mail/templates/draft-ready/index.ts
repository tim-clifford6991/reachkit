// BUILD §12 — the `draft-ready` mail: "daily: title, why-data, *publishes
// tomorrow 09:00 unless you say no*, one veto link".
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no send, no decision about
// whether there is a mail, and no sentence.
//
// **It is handed a telling and lays it out.** Which of §12's three things
// this mail says is `tellingFor`'s answer, not this file's: "here is the
// window you have to stop it", "there is no window, because you set none"
// and "nothing happens until you approve" are three different statements
// about the same page, and a mail that chose between them would be a
// second copy of the rule the `customer_told` guard reads.
//
// **Three arms in, three arms out, and no default.** The `Telling` union's
// fourth arm — `not_yet_tellable` — never reaches here: a page whose site
// states no time zone has no publish moment to name, so there is nothing
// to compose, and the occasion module refuses before this file is called.
// The switch below is exhaustive over the three that remain, so a fourth
// tellable arm would not compile rather than falling into a default that
// said the wrong one.
//
// **The stop link rides the telling and appears on exactly one arm.** Only
// `interval` carries a `stopAction`, because it is the only kind with an
// interval to stop the page inside (REQ-057 c7 — at a window of zero no
// link is issued, because a link would be an offer the product cannot
// keep). This file does not mint one, does not decide the window, and
// never renders an action with an empty token.
import type { CopyKey } from "@/lib/presentation/copy";
import type { Telling } from "@/lib/publish/publishable";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.draftReady.subject" satisfies CopyKey;
const STOP_ACTION = "mail.draftReady.stopAction" satisfies CopyKey;

export interface DraftReadyMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/** The telling arms this mail can be composed from — every arm but the one
 *  that has no moment to name. Narrowed by type so the occasion module's
 *  refusal is not a rule this file has to trust. */
export type TellableTelling = Exclude<Telling, { kind: "not_yet_tellable" }>;

/**
 * The `draft-ready` mail for one telling.
 *
 * `publishesAt` is already written by the caller, in the customer's own
 * zone (REQ-073 c1: never a zone nobody stated). A template that formatted
 * a date would be a second date formatter, and the two would disagree the
 * first time either moved.
 *
 * `stopHref` is the absolute address of the veto route (#154), composed by
 * the caller from the token the telling carries. It is required on the
 * `interval` arm and refused on the others by the same union, so a mail
 * cannot offer a stop that does not exist and cannot omit one that does.
 */
export function buildDraftReady(a: {
  telling: TellableTelling;
  publishesAt?: string;
  stopHref?: string;
}): DraftReadyMail {
  const blocks: MailBlock[] = [];

  // §12's "publishes tomorrow 09:00 unless you say no" — whichever of the
  // three that is for this page. The date slot is on two of the three
  // keys; `copilot` names no moment because there is none to name until
  // the customer approves.
  blocks.push(
    a.telling.kind === "approval_only"
      ? { block: "paragraph", text: a.telling.copy }
      : { block: "paragraph", text: a.telling.copy, vars: { publishesAt: a.publishesAt ?? "" } }
  );

  // REQ-057 c9's destination clause, where the page is bound for a site
  // ReachKit does not serve. A `notice` and not a second paragraph: it is
  // a condition of their own site, said beside the telling rather than in
  // place of it — c9 keeps the date, the interval and the stop action
  // exactly as the other criteria set them.
  if (a.telling.destination !== null) {
    blocks.push({
      block: "notice",
      text: a.telling.destination.copy,
      vars: { site: a.telling.destination.site },
    });
  }

  // "one veto link" — one, on the one arm that has an interval to offer.
  if (a.telling.kind === "interval" && a.stopHref !== undefined) {
    blocks.push({ block: "action", label: STOP_ACTION, href: a.stopHref });
  }

  return { subject: SUBJECT, blocks };
}
