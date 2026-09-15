// BUILD §12 — the report mail, drawn for the first time by UI-SPEC S20.
//
// `report` has been a row in `MAIL_KINDS` since the seam was built and had
// no template: the occasion is stated (§12) and nothing composed it. The
// approved set draws it, so this is where its blocks live — one directory
// per kind, named for the kind (ADR-040), a block list and nothing else.
//
// **It carries no stop control, and the register is why.** `stoppable:
// false`: a free report is a thing the reader asked for at a public
// address, sent once, and the footer's own line says how to have the
// report itself taken down (`removal.address`, REQ-002 c1) rather than how
// to unsubscribe from a series there is none of.
//
// **Verdict, next step, one action** (SPEC §8, #638). The verdict is the
// three fact rows and — where the score could be computed — the report's
// own sentence naming the factor that holds it down (`verdict.limiting.*`,
// the same key the report header renders). The next step is one line, and
// the action is the one button: open the report.
//
// The three fact rows are the report's own head, in the set's order and
// wording: the score with its band word (6a names the number), the AI
// answers count, the Google search count. Each arrives already written —
// the score through `formatStat`, the band through `BAND_LABELS` — because
// a fact row states a value and never formats one.
import type { CopyKey } from "@/lib/presentation/copy";
import type { ScoreFactorName } from "@/lib/measure/score";
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

/**
 * The values the mail states, each already written by the caller that
 * measured it.
 *
 * `aiAnswers` and `googleSearch` are the two `n of m` lines the report's
 * own head carries. They are strings and not numbers for the reason every
 * fact row's value is: this arm states a fact, and a second numeral
 * formatter living here is what §2.3's one-mono-rule exists to prevent.
 */
export interface ReportFacts {
  readonly domain: string;
  readonly score: string;
  readonly band: string;
  readonly aiAnswers: string;
  readonly googleSearch: string;
  /** The factor holding the score down, or `null` where the score could
   *  not be computed — an unmeasured verdict names no limiting factor. */
  readonly limiting: ScoreFactorName | null;
}

export function buildReport(a: {
  facts: ReportFacts;
  href: string;
  /** The address a removal request goes to — `removal.address`, read by
   *  the caller so this template holds no second copy of it (REQ-002 c1). */
  removalAddress: string;
  /** SPEC §9: the report's own stored checks (#573). Absent or `null` where
   *  the pass ran none — the rows are then absent, never nine zeros. */
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
          // The set writes the score and its band word on one row —
          // "62 · Hard to find" — because a number without its word is the
          // thing §2.5 refuses. The joiner is the caller's, for the same
          // reason: it is layout, and this file authors nothing.
          { label: FACT_SCORE, value: `${facts.score} · ${facts.band}` },
          { label: FACT_AI_ANSWERS, value: facts.aiAnswers },
          { label: FACT_GOOGLE, value: facts.googleSearch },
        ],
      },
      // SPEC §9: the faults the report counted, each titled as its card is
      // and figured as the Overview figures it. No fault, no block.
      ...(issues.length === 0 ? [] : [{ block: "facts", items: issues } as const]),
      ...(facts.limiting === null
        ? []
        : [{ block: "paragraph", text: LIMITING_LINES[facts.limiting] } as const]),
      { block: "paragraph", text: NEXT },
      { block: "action", label: ACTION, href: a.href },
    ],
  };
}
