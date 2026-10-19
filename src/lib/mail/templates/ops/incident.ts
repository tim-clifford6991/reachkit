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
      // Issue 1286 (D57): what the same week cost — per site a measurement
      // and a page written, then free scans and smoke tests apart, then the
      // ledger's total. Cents, as the ledger holds them.
      costs?: {
        weekStart: string;
        sites: readonly {
          domain: string;
          measurements: { count: number; cents: number };
          pages: { count: number; cents: number };
        }[];
        freeScans: { count: number; cents: number };
        smokeTests: { count: number; cents: number };
        totalCents: number | null;
        // Issue 1298 (D63): the week's Google SERP reads, how many timed
        // out, and what the timed-out ones were billed.
        serp?: { reads: number; timeouts: number; wastedCents: number } | null;
      };
      // Issue 1287 (D58): the passes one of their own health checks failed
      // on, each with the check and what it found.
      unhealthy?: readonly {
        scanId: string;
        domain: string;
        failing: readonly { check: string; detail: string }[];
      }[];
    }
  // Issue #799: no error — a scheduled job has not run for twice its
  // interval. The facts are the job id, its last run as an instant and its
  // interval in minutes.
  | { occasion: "job-stale"; jobId: string; lastRunAt: string; intervalMinutes: number }
  // Issue 1455: no error — a paying site's publish time passed with no page
  // for the day. Owner-only, so the site is named; the reason is the code
  // its due hour recorded (`draft_days`), a closed name.
  | { occasion: "no-draft-at-publish"; domain: string; date: string; reason: string }
  // Issue 1536: no error — a site on autopilot has gone twice its cadence
  // with no page delivered. Owner-only, so the site is named.
  | { occasion: "autopilot-stalled"; domain: string; lastDelivered: string; days: number }
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
const COSTS_WEEK = "mail.ops.incident.costs-week" satisfies CopyKey;
const HEALTH_WEEK = "mail.ops.incident.health-week" satisfies CopyKey;

const BODY: Readonly<Record<OpsIncident["occasion"], CopyKey>> = Object.freeze({
  "job-failed": "mail.ops.incident.job-failed",
  "dead-lettered": "mail.ops.incident.dead-lettered",
  "boot-refused": "mail.ops.incident.boot-refused",
  "market-too-small": "mail.ops.incident.market-too-small",
  "market-too-small-week": "mail.ops.incident.market-too-small-week",
  "job-stale": "mail.ops.incident.job-stale",
  "no-draft-at-publish": "mail.ops.incident.no-draft-at-publish",
  "autopilot-stalled": "mail.ops.incident.autopilot-stalled",
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
  if (incident.occasion === "no-draft-at-publish") {
    return [
      { label: "mail.ops.incident.fact.site", value: closedDomain(incident.domain) },
      { label: "mail.ops.incident.fact.date", value: closedDate(incident.date) },
      { label: "mail.ops.incident.fact.cause", value: closedName(incident.reason.replace(/[^A-Za-z0-9_/-]/g, "/").slice(0, 64)) },
    ];
  }
  if (incident.occasion === "autopilot-stalled") {
    return [
      { label: "mail.ops.incident.fact.site", value: closedDomain(incident.domain) },
      { label: "mail.ops.incident.fact.last-delivered", value: closedDate(incident.lastDelivered) },
      { label: "mail.ops.incident.fact.days-without", value: count(incident.days) },
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

/** Ledger cents to one decimal: the cheapest vendor rows cost a fraction. */
function money(cents: number): string {
  return `${(Number.isFinite(cents) && cents > 0 ? cents : 0).toFixed(1)}¢`;
}

/** The average cost of one and how many there were: `36.2¢ × 2`. */
function each(line: { count: number; cents: number }): string {
  return `${money(line.count > 0 ? line.cents / line.count : 0)} × ${count(line.count)}`;
}

type WeekCosts = NonNullable<Extract<OpsIncident, { occasion: "market-too-small-week" }>["costs"]>;

function costFacts(costs: WeekCosts): FactRow[] {
  return [
    { label: "mail.ops.incident.fact.week", value: closedDate(costs.weekStart) },
    ...costs.sites.flatMap((site): FactRow[] => [
      { label: "mail.ops.incident.fact.site", value: closedDomain(site.domain) },
      ...(site.measurements.count > 0 ? [{ label: "mail.ops.incident.fact.cost-measurement", value: each(site.measurements) } as const] : []),
      ...(site.pages.count > 0 ? [{ label: "mail.ops.incident.fact.cost-page", value: each(site.pages) } as const] : []),
      { label: "mail.ops.incident.fact.cost-site", value: money(site.measurements.cents + site.pages.cents) },
    ]),
    { label: "mail.ops.incident.fact.cost-free-scans", value: `${money(costs.freeScans.cents)} × ${count(costs.freeScans.count)}` },
    { label: "mail.ops.incident.fact.cost-smoke-tests", value: `${money(costs.smokeTests.cents)} × ${count(costs.smokeTests.count)}` },
    ...(costs.totalCents === null ? [] : [{ label: "mail.ops.incident.fact.cost-total", value: money(costs.totalCents) } as const]),
    ...(costs.serp === undefined || costs.serp === null || costs.serp.reads <= 0
      ? []
      : ([
          {
            label: "mail.ops.incident.fact.serp-timeouts",
            value: `${Math.round((costs.serp.timeouts / costs.serp.reads) * 100)}% (${count(costs.serp.timeouts)} / ${count(costs.serp.reads)})`,
          },
          { label: "mail.ops.incident.fact.serp-timeout-cost", value: money(costs.serp.wastedCents) },
        ] as const)),
  ];
}

/** The Monday digest: each part is drawn only where it has something to
 *  say, so a week with stalled pages and no thin market does not claim one. */
function weekBlocks(incident: Extract<OpsIncident, { occasion: "market-too-small-week" }>): MailBlock[] {
  const blocks: MailBlock[] = [];
  if (incident.scanIds.length > 0 || (incident.stopped === undefined && incident.costs === undefined && incident.unhealthy === undefined)) {
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
  if (incident.unhealthy !== undefined) {
    blocks.push(
      { block: "paragraph", text: HEALTH_WEEK },
      {
        block: "facts",
        items: incident.unhealthy.flatMap((pass): FactRow[] => [
          { label: "mail.ops.incident.fact.site", value: closedDomain(pass.domain) },
          { label: "mail.ops.incident.fact.scan", value: closedId(pass.scanId) },
          ...pass.failing.map(
            (failed): FactRow => ({ label: "mail.ops.incident.fact.health-check", value: `${closedName(failed.check)}: ${sentenceValue(failed.detail)}` })
          ),
        ]),
      }
    );
  }
  if (incident.costs !== undefined) {
    blocks.push({ block: "paragraph", text: COSTS_WEEK }, { block: "facts", items: costFacts(incident.costs) });
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
