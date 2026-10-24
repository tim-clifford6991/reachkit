// BUILD §12 — sendEmail(): the one seam every mail leaves through. It composes once and asks exactly the one store the kind's
// `stoppable` row names (ADR-042), never both: merging them would silently take a magic-link customer's sign-in mail away.
// The store is asked immediately before the vendor call, never at schedule time, so a mail switched off in between is not sent.
// The stop control leaves twice: as a link in both bodies and as RFC 8058's headers, since an inbox does not read the body.
// It never throws, retries nothing, and is not idempotent: a caller that must send once carries its own key.
import { TODO_COPY_MARKER, type CopyKey } from "@/lib/presentation/copy";
import type { CopyVars, MailBlock } from "./blocks/types";
import { MAIL_KINDS, type MailKind } from "./kinds";
import { stoppedByPreference } from "./notifications";
import { composeMail, type MeasurementState, type OptOutControl } from "./shell/compose";
import { recipientDigest, sendViaVendor } from "./vendor/resend";

/** The `'toggle'` kinds at the type level, so `userId` becomes required the moment a row changes. */
type ToggleKind = { [K in MailKind]: (typeof MAIL_KINDS)[K]["stoppable"] extends "toggle" ? K : never }[MailKind];

interface SendCommon {
  to: string;
  subject: CopyKey;
  subjectVars?: CopyVars;
  blocks: readonly MailBlock[];
  /** S20's footer line, named by the template that knows the occasion. */
  reason?: CopyKey;
  /** The reason line's own slots, where its sentence takes one. */
  reasonVars?: CopyVars;
  optOut?: OptOutControl;
  /** Footer links drawn before the stop control. */
  footerLinks?: readonly { label: CopyKey; href: string }[];
  /** A page going live under autopilot at a zero veto window, where the mail is the whole telling
   *  (`MAIL_KINDS['draft-ready'].unsuppressibleWhen`). Only `false`, so no `true` is left lying around. */
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

/** The address-wide suppression read (§4.2), owned by `src/lib/mail/leads/**`; the seam holds the port only. */
export type SuppressionReader = (address: string) => Promise<"send" | "suppressed" | "unreadable">;

/** Fails closed: unwired, an `'opt-out'` kind is not sent, since "cannot tell" must not mail. Other kinds never ask it. */
const notWiredYet: SuppressionReader = async () => "unreadable";

let suppressionReader: SuppressionReader = notWiredYet;

/** Wired by the suppression store's owner; `null` restores the fail-closed default. */
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

/** The one store the kind's row chooses, asked once; `false` kinds and unsuppressible sends ask nothing. */
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

  let composed: Awaited<ReturnType<typeof composeMail>>;
  try {
    composed = await compose(m);
    // SPEC §8, "unwritten keys send nothing": a `TODO(copy)` key renders as itself, which a mail, sent once, must not.
    if ([composed.subject, composed.html, composed.text].some((part) => part.includes(TODO_COPY_MARKER))) {
      throw new Error("sendEmail: the mail carries an unwritten TODO(copy) line.");
    }
  } catch (error) {
    // Reported as its own reason, not thrown: an unwritten line must not fail the job, and is never papered over with an empty line.
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
    // RFC 8058: the headers go out exactly where the mail carries a stop control, so an unstoppable kind never claims it can.
    listUnsubscribe: m.optOut?.oneClickHref,
  });

  if (result.ok) {
    log({ kind: m.kind, recipient, outcome: "sent", omitted, vendorId: result.id });
    return { sent: true, id: result.id };
  }

  // A permanent rejection is `reason: 'vendor'` with no `retryUntil`, so a caller's retry window ends early.
  log({ kind: m.kind, recipient, outcome: "vendor", omitted, vendorId: null });
  return result.retryUntil === undefined
    ? { sent: false, reason: "vendor" }
    : { sent: false, reason: "vendor", retryUntil: result.retryUntil };
}

/** The compose call, so `sendEmail` reads as one path. `measurement` is required for `'weekly'` only, so the arms are written out.
 *  Async only for React Email's renderer; nothing here reaches the vendor. */
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
        footerLinks: m.footerLinks,
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
        footerLinks: m.footerLinks,
      });
}

/** One import for the seam. `copy` is not re-exported: callers compose with keys, never sentences. */
export type { MailKind } from "./kinds";
export { MAIL_KINDS } from "./kinds";
export type { MailBlock } from "./blocks/types";
export type { MeasurementState, OptOutControl } from "./shell/compose";
export { composeMail } from "./shell/compose";
