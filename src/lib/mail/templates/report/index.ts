// BUILD §12 — the report mail, as `Canvas: MailReport` draws it.
//
// The canvas heads the card on the sequence eyebrow and the one line, then
// states the verdict twice: the score card — the number, its band word as a
// tinted chip, the domain it is about — and the three factor tiles under
// it. The fact rows the older draft carried are gone; the canvas draws the
// score and its factors instead.
//
// **It carries no stop control, and the register is why.** `stoppable:
// false`: a free report is a thing the reader asked for at a public
// address, sent once, and the footer's own line says how to have the
// report itself taken down (`removal.address`, REQ-002 c1) rather than how
// to unsubscribe from a series there is none of.
//
// Every value arrives already written — the score through `formatStat`, the
// band word through `SCORE_BANDS`, the tone through the caller that banded
// the number — because this file states facts and formats none.
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock, MeaningTone } from "../../blocks/types";

const SUBJECT = "mail.report.subject" satisfies CopyKey;
const EYEBROW = "mail.report.eyebrow" satisfies CopyKey;
const HEADING = "mail.report.heading" satisfies CopyKey;
const BODY = "mail.report.body" satisfies CopyKey;
const ACTION = "mail.report.action" satisfies CopyKey;
const NOTE = "mail.report.sequence_note" satisfies CopyKey;
const SCORE_LABEL = "mail.report.fact.score" satisfies CopyKey;
const REASON = "mail.reason.report" satisfies CopyKey;

/** The three factors the canvas tiles, in its order. The words are
 *  `verdict.factor.*` — the report screen's own labels, never authored
 *  here. */
const FACTOR_LABELS = Object.freeze({
  foundations: "verdict.factor.foundations",
  answerability: "verdict.factor.answerability",
  presence: "verdict.factor.presence",
} as const satisfies Readonly<Record<string, CopyKey>>);

export interface ReportMail {
  readonly subject: CopyKey;
  readonly subjectVars: Readonly<Record<string, string | number>>;
  readonly blocks: readonly MailBlock[];
  readonly reason: CopyKey;
  readonly reasonVars: Readonly<Record<string, string | number>>;
}

/** One factor tile: the value as the caller wrote it, and how full its bar
 *  is. Two fields because a bar drawn from a parsed string would be this
 *  file formatting a number. */
export interface ReportFactor {
  readonly value: string;
  readonly fill: number;
}

/** The values the mail states, each already written by the caller that
 *  measured it. `tone` is the band's own meaning handle — the map from band
 *  to tone is the product's one map (`src/ui/bands.ts`), and `src/lib/**`
 *  may not import it, so the caller passes the answer rather than this
 *  seam keeping a second copy. */
export interface ReportFacts {
  readonly domain: string;
  readonly score: string;
  readonly band: string;
  readonly tone: MeaningTone;
  readonly foundations: ReportFactor;
  readonly answerability: ReportFactor;
  readonly presence: ReportFactor;
}

export function buildReport(a: {
  facts: ReportFacts;
  href: string;
  /** The address a removal request goes to — `removal.address`, read by
   *  the caller so this template holds no second copy of it (REQ-002 c1). */
  removalAddress: string;
}): ReportMail {
  const { facts } = a;
  return {
    subject: SUBJECT,
    subjectVars: { domain: facts.domain, score: facts.score, band: facts.band },
    reason: REASON,
    reasonVars: { address: a.removalAddress },
    blocks: [
      { block: "eyebrow", text: EYEBROW },
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY },
      {
        block: "score",
        label: SCORE_LABEL,
        value: facts.score,
        band: facts.band,
        tone: facts.tone,
        subject: facts.domain,
      },
      {
        block: "meters",
        items: [
          { label: FACTOR_LABELS.foundations, ...facts.foundations },
          { label: FACTOR_LABELS.answerability, ...facts.answerability },
          { label: FACTOR_LABELS.presence, ...facts.presence },
        ],
      },
      { block: "action", label: ACTION, href: a.href },
      { block: "footnote", text: NOTE },
    ],
  };
}
