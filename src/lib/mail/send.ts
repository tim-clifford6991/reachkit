// BUILD §12 — sendEmail(): the one seam every mail leaves through.
//
// Compose once, consult **exactly one** stoppability store — chosen by the
// sending kind's own register row — and reach the vendor only if that
// store says send. `MAIL_KINDS[kind].stoppable` is the dispatch, not
// documentation (ADR-042): `'toggle'` asks the customer's three switches,
// `'opt-out'` asks the address-wide suppression store, `false` asks
// neither. There is no call that asks both and no helper that unifies
// them. Merging them takes a magic-link customer's sign-in mail away,
// silently, and the customer discovers it when they cannot get back in.
//
// The consult happens **immediately before the vendor call**, never at
// schedule time: a customer who switches a mail off between the two must
// not receive it.
//
// This function never throws and is **not idempotent on its own** — a
// caller that must send at most once carries its own natural key. It
// retries nothing either; the retry window belongs to whoever owns the
// occasion.
import type { CopyKey } from "@/lib/presentation/copy";
import type { CopyVars, MailBlock } from "./blocks/types";
import { MAIL_KINDS, type MailKind } from "./kinds";
import { stoppedByPreference } from "./notifications";
import { composeMail, type MeasurementState, type OptOutControl } from "./shell/compose";
import { recipientDigest, sendViaVendor } from "./vendor/resend";

/** The kinds whose register row says `'toggle'`, derived from the register
 *  at the type level so a `userId` becomes required the moment a row
 *  changes — a compile error, never a runtime surprise. */
type ToggleKind = { [K in MailKind]: (typeof MAIL_KINDS)[K]["stoppable"] extends "toggle" ? K : never }[MailKind];

interface SendCommon {
  to: string;
  subject: CopyKey;
  subjectVars?: CopyVars;
  blocks: readonly MailBlock[];
  /** UI-SPEC S20's footer line: why this mail arrived. The template that
   *  knows the occasion names it; the seam only carries it through. */
  reason?: CopyKey;
  /** The reason line's own slots, where its sentence takes one. */
  reasonVars?: CopyVars;
  optOut?: OptOutControl;
  /** The one occasion a togglable mail is sent anyway: a page going live
   *  under autopilot at a veto window of zero, where the mail is the whole
   *  of the customer's telling and no interval in which to stop it exists
   *  (`MAIL_KINDS['draft-ready'].unsuppressibleWhen`). Only `false` is
   *  accepted — there is no `true` to leave lying around. */
  suppressible?: false;
}

export type SendInput =
  | (SendCommon & { kind: "weekly"; measurement: MeasurementState; userId: string })
  | (SendCommon & { kind: Exclude<ToggleKind, "weekly">; measurement?: never; userId: string })
  | (SendCommon & { kind: Exclude<MailKind, ToggleKind>; measurement?: never; userId?: string });

export type SendResult =
  | { sent: true; id: string }
  | {
      sent: false;
      reason:
        | "suppressed"
        | "suppression-unreadable"
        | "preference-off"
        | "preference-unreadable"
        | "not-composable"
        | "vendor";
      retryUntil?: Date;
    };

/** The address-wide suppression read (§4.2's lead opt-out). It is a
 *  different mechanism, a different store and a different token from the
 *  three notification toggles, and it lives in `src/lib/mail/leads/**` —
 *  issue #31. This seam holds the port and no suppression logic of its
 *  own. */
export type SuppressionReader = (address: string) => Promise<"send" | "suppressed" | "unreadable">;

/** Not wired yet, and it **fails closed**: until the store exists, a mail
 *  whose register row says `'opt-out'` is not sent, because the only
 *  honest answer to "has this person opted out?" with no store to ask is
 *  "we cannot tell", and mailing on that answer is the failure this port
 *  exists to prevent. `false` and `'toggle'` kinds are untouched by this —
 *  they never consult this store at all. */
const notWiredYet: SuppressionReader = async () => "unreadable";

let suppressionReader: SuppressionReader = notWiredYet;

/** Wired by the module that owns the suppression store (issue #31);
 *  `null` restores the fail-closed default. */
export function registerSuppressionReader(reader: SuppressionReader | null): void {
  suppressionReader = reader ?? notWiredYet;
}

function log(a: {
  kind: MailKind;
  recipient: string;
  outcome: string;
  omitted: number;
  vendorId: string | null;
}): void {
  console.log(JSON.stringify({ event: "mail_seam", ...a }));
}

/** The one store this kind's row chooses, asked once. A kind whose row
 *  says `false`, and any send the caller has marked unsuppressible, asks
 *  nothing at all. */
type Stopped = Extract<SendResult, { sent: false }>;

async function consultOneStore(m: SendInput): Promise<Stopped | "send"> {
  if (m.suppressible === false) return "send";

  const stoppable = MAIL_KINDS[m.kind].stoppable;

  if (stoppable === "toggle") {
    // `userId` is required by the type for every `'toggle'` kind.
    const userId = (m as { userId: string }).userId;
    const answer = await stoppedByPreference({ userId, kind: m.kind });
    if (answer === "stopped") return { sent: false, reason: "preference-off" };
    if (answer === "unreadable") return { sent: false, reason: "preference-unreadable" };
    return "send";
  }

  if (stoppable === "opt-out") {
    const answer = await suppressionReader(m.to);
    if (answer === "suppressed") return { sent: false, reason: "suppressed" };
    if (answer === "unreadable") return { sent: false, reason: "suppression-unreadable" };
    return "send";
  }

  return "send";
}

export async function sendEmail(m: SendInput): Promise<SendResult> {
  const recipientEarly = recipientDigest(m.to);

  let composed: ReturnType<typeof composeMail>;
  try {
    composed = compose(m);
  } catch (error) {
    // A sentence this mail needs has not been written yet, so there is no
    // mail to send. It is reported as its own reason rather than thrown:
    // an unwritten line is the owner's debt, not a reason for the job
    // holding this send to fall over — and it is never papered over with
    // an empty line, which is what `copy()` refusing the key prevents.
    log({
      kind: m.kind,
      recipient: recipientEarly,
      outcome: "not-composable",
      omitted: 0,
      vendorId: null,
    });
    console.warn(
      JSON.stringify({ event: "mail_not_composable", kind: m.kind, detail: String(error) })
    );
    return { sent: false, reason: "not-composable" };
  }

  const recipient = recipientEarly;
  const omitted = composed.omitted.length;

  const consulted = await consultOneStore(m);
  if (consulted !== "send") {
    log({ kind: m.kind, recipient, outcome: consulted.reason, omitted, vendorId: null });
    return consulted;
  }

  const result = await sendViaVendor({
    kind: m.kind,
    to: m.to,
    subject: composed.subject,
    html: composed.html,
    text: composed.text,
  });

  if (result.ok) {
    log({ kind: m.kind, recipient, outcome: "sent", omitted, vendorId: result.id });
    return { sent: true, id: result.id };
  }

  // A permanent rejection still surfaces as `reason: 'vendor'`, with no
  // `retryUntil`, so a caller's retry window can end early rather than
  // spending every attempt on an address that will never accept mail.
  log({ kind: m.kind, recipient, outcome: "vendor", omitted, vendorId: null });
  return result.retryUntil === undefined
    ? { sent: false, reason: "vendor" }
    : { sent: false, reason: "vendor", retryUntil: result.retryUntil };
}

/** The compose call, split out only so `sendEmail` reads as one path.
 *  `measurement` is required for `'weekly'` and rejected for every other
 *  kind, which is why the two arms are written out rather than spread. */
function compose(m: SendInput): ReturnType<typeof composeMail> {
  return m.kind === "weekly"
    ? composeMail({
        kind: m.kind,
        subject: m.subject,
        subjectVars: m.subjectVars,
        blocks: m.blocks,
        reason: m.reason,
        reasonVars: m.reasonVars,
        optOut: m.optOut,
        measurement: m.measurement,
      })
    : composeMail({
        kind: m.kind,
        subject: m.subject,
        subjectVars: m.subjectVars,
        blocks: m.blocks,
        reason: m.reason,
        reasonVars: m.reasonVars,
        optOut: m.optOut,
      });
}

/** Re-exported so a caller holds one import for the seam. `copy` is not
 *  re-exported: a caller composes with keys, never with sentences. */
export type { MailKind } from "./kinds";
export { MAIL_KINDS } from "./kinds";
export type { MailBlock } from "./blocks/types";
export type { MeasurementState, OptOutControl } from "./shell/compose";
export { composeMail } from "./shell/compose";
