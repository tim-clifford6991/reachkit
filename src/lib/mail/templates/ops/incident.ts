// The owner's incident alert (issue 330) — a job failed, a job was
// dead-lettered, or a deployment refused to boot.
//
// One shape, five occasions, the way the spend alert beside it is built:
// the occasion picks the line, and the fact rows carry closed names only.
// Nothing a customer typed, no event payload, no error message (a message
// can quote an address or a domain) and no subject id reaches this mail —
// the values are a job id from the registry, an attempt number, an error's
// class name and a boot check's name.
//
// **One occasion is the exception, on purpose** (issue 1187; owner, D27,
// 2026-10-02: "If a draft has failed twice, i would be highly concerned to
// why"). A draft the writing rules stopped twice is an alert, and the owner
// cannot investigate a rule without the words it stopped: that occasion names
// the site, each rule, and the sentences of the unpublished page that broke
// it. It goes to `OWNER_EMAILS` and to nobody else.
import type { CopyKey } from "@/lib/presentation/copy";
import type { FactRow, MailBlock } from "../../blocks/types";

export type OpsIncident =
  | { occasion: "job-failed"; jobId: string; attempt: number; errorName: string }
  | { occasion: "dead-lettered"; jobId: string; errorName: string }
  | { occasion: "boot-refused"; check: string; errorName: string }
  // Issue #770: no error — the market was read and was too small. The facts
  // are the scan's id and its tier, never the domain.
  | { occasion: "market-too-small"; scanId: string; tier: string }
  // Issue 796: the weekly passes of one Monday that found too little
  // market, folded into one line a week rather than one mail per site.
  // Issue 1184: the same Monday mail says why the week before's pages
  // stalled — per site, the pages that stopped of the pages written, and
  // how often each cause stopped one. Owner-only, so the site is named.
  | {
      occasion: "market-too-small-week";
      weekStart: string;
      scanIds: readonly string[];
      stopped?: {
        weekStart: string;
        sites: readonly {
          domain: string;
          written: number;
          stopped: number;
          causes: readonly { cause: string; count: number }[];
        }[];
      };
    }
  // Issue #799: no error — a scheduled job has not run for twice its
  // interval. The facts are the job id, its last run as an instant and its
  // interval in minutes.
  | { occasion: "job-stale"; jobId: string; lastRunAt: string; intervalMinutes: number }
  // Issue 1187: no error — the writing rules stopped one draft twice. Each
  // rule that stopped the last attempt, with the sentences that broke it
  // where the rule can point at them.
  | {
      occasion: "draft-stopped-twice";
      domain: string;
      draftId: string;
      attempts: number;
      failed: readonly { rule: string; sentences: readonly string[] }[];
    };

const SUBJECT = "mail.ops.incident.subject" satisfies CopyKey;
const HEADING = "mail.ops.incident.heading" satisfies CopyKey;
const STOPPED_WEEK = "mail.ops.incident.drafts-stopped-week" satisfies CopyKey;

const BODY: Readonly<Record<OpsIncident["occasion"], CopyKey>> = Object.freeze({
  "job-failed": "mail.ops.incident.job-failed",
  "dead-lettered": "mail.ops.incident.dead-lettered",
  "boot-refused": "mail.ops.incident.boot-refused",
  "market-too-small": "mail.ops.incident.market-too-small",
  "market-too-small-week": "mail.ops.incident.market-too-small-week",
  "job-stale": "mail.ops.incident.job-stale",
  "draft-stopped-twice": "mail.ops.incident.draft-stopped-twice",
});

/** A sentence of the stopped page, on one line and cut where a mail row
 *  stops being readable. */
const SENTENCE_MAX = 240;
function sentenceValue(sentence: string): string {
  const line = sentence.replace(/\s+/g, " ").trim();
  return line.length <= SENTENCE_MAX ? line : `${line.slice(0, SENTENCE_MAX - 1)}…`;
}

/** A recorded domain, or `unknown`: a host name and nothing else. */
function closedDomain(value: string): string {
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(value) ? value : "unknown";
}

/** A scan id is a UUID, and `closedName` would refuse one that starts with
 *  a digit; anything that is not one is written as `unknown`. */
function closedId(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : "unknown";
}

/** A name, or `Error` where the value is not one: a class name is letters,
 *  digits and underscores, and anything else could be a message. */
export function closedName(value: string): string {
  return /^[A-Za-z][A-Za-z0-9_/-]{0,63}$/.test(value) ? value : "Error";
}

/** A week is a stored calendar date; anything else is written `unknown`. */
function closedDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "unknown";
}

/** An instant written to the minute in UTC, or `unknown` where the value
 *  does not parse as one. */
function closedInstant(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "unknown" : `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function factsOf(incident: OpsIncident): FactRow[] {
  if (incident.occasion === "market-too-small-week") {
    return [
      { label: "mail.ops.incident.fact.week", value: closedDate(incident.weekStart) },
      ...incident.scanIds.map((id) => ({ label: "mail.ops.incident.fact.scan", value: closedId(id) }) as const),
    ];
  }
  if (incident.occasion === "draft-stopped-twice") {
    return [
      { label: "mail.ops.incident.fact.site", value: closedDomain(incident.domain) },
      { label: "mail.ops.incident.fact.draft", value: closedId(incident.draftId) },
      { label: "mail.ops.incident.fact.attempt", value: String(Math.max(0, Math.trunc(incident.attempts))) },
      ...incident.failed.flatMap((failure): FactRow[] => [
        { label: "mail.ops.incident.fact.rule", value: closedName(failure.rule) },
        ...failure.sentences.map((sentence): FactRow => ({ label: "mail.ops.incident.fact.sentence", value: sentenceValue(sentence) })),
      ]),
    ];
  }
  if (incident.occasion === "job-stale") {
    return [
      { label: "mail.ops.incident.fact.job", value: closedName(incident.jobId) },
      { label: "mail.ops.incident.fact.last-run", value: closedInstant(incident.lastRunAt) },
      { label: "mail.ops.incident.fact.interval", value: String(Math.max(0, Math.trunc(incident.intervalMinutes))) },
    ];
  }
  if (incident.occasion === "market-too-small") {
    return [
      { label: "mail.ops.incident.fact.scan", value: closedId(incident.scanId) },
      { label: "mail.ops.incident.fact.tier", value: closedName(incident.tier) },
    ];
  }
  const error = { label: "mail.ops.incident.fact.error", value: closedName(incident.errorName) } as const;
  switch (incident.occasion) {
    case "job-failed":
      return [
        { label: "mail.ops.incident.fact.job", value: closedName(incident.jobId) },
        // Zero-indexed on the platform; written one-indexed, as a person counts.
        { label: "mail.ops.incident.fact.attempt", value: String(Math.max(0, Math.trunc(incident.attempt)) + 1) },
        error,
      ];
    case "dead-lettered":
      return [{ label: "mail.ops.incident.fact.job", value: closedName(incident.jobId) }, error];
    case "boot-refused":
      return [{ label: "mail.ops.incident.fact.check", value: closedName(incident.check) }, error];
  }
}

function count(value: number): string {
  return String(Math.max(0, Math.trunc(value)));
}

/** The Monday digest: each half is drawn only where it has something to
 *  say, so a week with stalled pages and no thin market does not claim one. */
function weekBlocks(incident: Extract<OpsIncident, { occasion: "market-too-small-week" }>): MailBlock[] {
  const blocks: MailBlock[] = [];
  if (incident.scanIds.length > 0 || incident.stopped === undefined) {
    blocks.push({ block: "paragraph", text: BODY[incident.occasion] }, { block: "facts", items: factsOf(incident) });
  }
  if (incident.stopped !== undefined) {
    blocks.push(
      { block: "paragraph", text: STOPPED_WEEK },
      {
        block: "facts",
        items: [
          { label: "mail.ops.incident.fact.week", value: closedDate(incident.stopped.weekStart) },
          ...incident.stopped.sites.flatMap((site): FactRow[] => [
            { label: "mail.ops.incident.fact.site", value: closedDomain(site.domain) },
            { label: "mail.ops.incident.fact.stopped", value: `${count(site.stopped)} / ${count(site.written)}` },
            ...site.causes.map((cause): FactRow => ({ label: "mail.ops.incident.fact.cause", value: `${closedName(cause.cause)}: ${count(cause.count)}` })),
          ]),
        ],
      }
    );
  }
  return blocks;
}

export function buildIncidentAlert(incident: OpsIncident): { subject: CopyKey; blocks: readonly MailBlock[] } {
  if (incident.occasion === "market-too-small-week") {
    return { subject: SUBJECT, blocks: [{ block: "heading", text: HEADING }, ...weekBlocks(incident)] };
  }
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY[incident.occasion] },
      { block: "facts", items: factsOf(incident) },
    ],
  };
}
