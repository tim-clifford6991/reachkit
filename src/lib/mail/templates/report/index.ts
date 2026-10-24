// BUILD §12 — the report mail (UI-SPEC S20), as a block list only (ADR-040).
// No stop control (`stoppable: false`): the reader asked for it once, and the footer says how to have the report taken down (REQ-002 c1).
// Verdict, next step, one action (SPEC §8): three fact rows in the report head's order, the biggest gap where a score exists, one line,
// and the button to open the report. Values arrive written (`formatStat`, `BAND_LABELS`); a fact row never formats.
import type { CopyKey } from "@/lib/presentation/copy";
import type { ShownFactor } from "@/lib/measure/verdict";
import { LIMITING_LINES } from "@/lib/presentation/bands";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import { issueRows } from "../../blocks/site-issues";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.report.subject" satisfies CopyKey;
const HEADING = "mail.report.heading" satisfies CopyKey;
const BODY = "mail.report.body" satisfies CopyKey;
const NEXT = "mail.report.next" satisfies CopyKey;
const ACTION = "mail.report.action" satisfies CopyKey;
const FACT_SCORE = "mail.report.fact.score" satisfies CopyKey;
const FACT_AI_ANSWERS = "mail.report.fact.aiAnswers" satisfies CopyKey;
const FACT_GOOGLE = "mail.report.fact.googleSearch" satisfies CopyKey;
const REASON = "mail.reason.report" satisfies CopyKey;

export interface ReportMail {
  readonly subject: CopyKey;
  readonly subjectVars: Readonly<Record<string, string | number>>;
  readonly blocks: readonly MailBlock[];
  readonly reason: CopyKey;
  readonly reasonVars: Readonly<Record<string, string | number>>;
}

/** The values the mail states, each written by the caller that measured it; the `n of m` lines are strings, as every fact value is. */
export interface ReportFacts {
  readonly domain: string;
  readonly score: string;
  readonly band: string;
  readonly aiAnswers: string;
  readonly googleSearch: string;
  /** The bar holding the score down, or `null` without a score: an unmeasured verdict names no gap. */
  readonly limiting: ShownFactor | null;
}

export function buildReport(a: {
  facts: ReportFacts;
  href: string;
  /** `removal.address`, read by the caller so this template holds no second copy (REQ-002 c1). */
  removalAddress: string;
  /** SPEC §9: the report's stored checks; absent or `null` gives no rows, never nine zeros. */
  issues?: SiteIssuesSection | null;
}): ReportMail {
  const { facts } = a;
  const issues = issueRows(a.issues ?? null);
  return {
    subject: SUBJECT,
    subjectVars: { domain: facts.domain, score: facts.score, band: facts.band },
    reason: REASON,
    reasonVars: { address: a.removalAddress },
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY },
      {
        block: "facts",
        items: [
          // Score and band word on one row, since §2.5 refuses a number without its word; the joiner is the caller's.
          { label: FACT_SCORE, value: `${facts.score} · ${facts.band}` },
          { label: FACT_AI_ANSWERS, value: facts.aiAnswers },
          { label: FACT_GOOGLE, value: facts.googleSearch },
        ],
      },
      // SPEC §9: the counted faults, titled as their cards. No fault, no block.
      ...(issues.length === 0 ? [] : [{ block: "facts", items: issues } as const]),
      ...(facts.limiting === null
        ? []
        : [
            { block: "paragraph", text: LIMITING_LINES[facts.limiting].title } as const,
            { block: "paragraph", text: LIMITING_LINES[facts.limiting].line } as const,
          ]),
      { block: "paragraph", text: NEXT },
      { block: "action", label: ACTION, href: a.href },
    ],
  };
}
