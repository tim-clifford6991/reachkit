// BUILD §12 — the Monday mail: "`weekly` (score delta, AI answers delta,
// pages verdicts, next 3 — all values conditional: a missing number omits
// its section, never prints 0)".
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no formatter, no vendor
// knowledge, no sentence of its own — and, crucially, **no conditional of
// its own**. Every value that can be absent enters as a `Measured<T>`, so
// §12's omission rule is decided once in `blocks/omit.ts` and cannot be
// forgotten here: a delta that was not measured omits its stat, a list
// that was not measured omits its section, and a measured zero prints as
// the result it is.
//
// The four sections are §12's own four, in its own order. `weekly` is
// `stoppable: 'toggle'` in the register, so the caller hands `sendEmail` an
// unsubscribe control; this file carries none.
//
// **What is not here.** The whole-mail line a week that was not measured
// (or was measured only in part) carries is `composeMail`'s, chosen from
// the `MeasurementState` the caller passes beside these blocks — the one
// account of a week (REQ-065), which is the weekly measurement's to state
// and not this template's to re-derive.
//
// **A page is named by its address and an opportunity by the search it
// targets.** Both are measured fact. Neither is named by its title: a
// page's title and an opportunity's are model-written, and REQ-093 does
// not admit model text into a mail as ReachKit's own statement about the
// reader's market (§8, ADR-012).
import type { Measured } from "@/lib/measure/measured";
import type { WeekStanding } from "@/lib/opportunities";
import { PAGE_VERDICTS } from "@/lib/presentation/bands";
import type { CopyKey } from "@/lib/presentation/copy";
import { formatStat } from "../../blocks/format";
import type { CopyVars, ListRow, MailBlock, VerdictRow } from "../../blocks/types";

const SUBJECT = "mail.weekly.subject" satisfies CopyKey;
const SCORE = "mail.weekly.score" satisfies CopyKey;
const AI_ANSWERS = "mail.weekly.aiAnswers" satisfies CopyKey;
const VERDICTS = "mail.weekly.verdicts" satisfies CopyKey;
const VERDICTS_NONE = "mail.weekly.verdicts.none" satisfies CopyKey;
const NEXT = "mail.weekly.next" satisfies CopyKey;
const NEXT_NONE = "mail.weekly.next.none" satisfies CopyKey;
const NEXT_ITEM = "mail.weekly.next.item" satisfies CopyKey;
const PAGE = "mail.weekly.page" satisfies CopyKey;
const PAGE_MOVED = "mail.weekly.page.moved" satisfies CopyKey;
const PAGE_MOVED_OVER = "mail.weekly.page.moved_over" satisfies CopyKey;

/** One judged page, as the mail needs it. `standing` is read back from the
 *  week's stored verdict and is never recomputed here. */
export interface WeeklyPage {
  readonly liveUrl: string | null;
  readonly standing: WeekStanding;
}

export interface WeeklyMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/**
 * §12's four sections, in §12's order.
 *
 * `scoreDelta` and `aiAnswersDelta` are deltas and not levels — "score
 * delta, AI answers delta" — so they carry the `delta` format, whose
 * measured zero prints as `0`: no movement is a result, and REQ-064 c2 is
 * explicit that a measured zero is shown.
 */
export function buildWeekly(a: {
  scoreDelta: Measured<number>;
  aiAnswersDelta: Measured<number>;
  /** The week's standings. `unmeasured` where the week produced none to
   *  read — which omits the section rather than stating an empty one; a
   *  measured empty list is "you have published nothing yet", which is a
   *  different fact and gets its own written line. */
  pages: Measured<readonly WeeklyPage[]>;
  /** The next three, by the ranking. `unmeasured` omits the section;
   *  measured-and-empty states the supply's own empty line — the calendar
   *  is never padded (DECISIONS 2026-08-28). */
  next: Measured<readonly { targetQuery: string }[]>;
}): WeeklyMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "stat", label: SCORE, value: a.scoreDelta, format: "delta" },
      { block: "stat", label: AI_ANSWERS, value: a.aiAnswersDelta, format: "delta" },
      {
        block: "verdicts",
        label: VERDICTS,
        items: mapMeasuredRows(a.pages, verdictRows),
        emptyLine: VERDICTS_NONE,
      },
      {
        block: "list",
        label: NEXT,
        items: mapMeasuredRows(a.next, nextRows),
        emptyLine: NEXT_NONE,
      },
    ],
  };
}

/** `mapMeasured` over a list, keeping the arm and the date: an unmeasured
 *  section stays unmeasured (and is omitted), and a measured-empty one
 *  stays measured-empty (and states its written line). */
function mapMeasuredRows<A, B>(m: Measured<readonly A[]>, f: (a: readonly A[]) => readonly B[]): Measured<readonly B[]> {
  return m.kind === "unmeasured" ? m : { kind: m.kind, value: f(m.value), at: m.at };
}

/**
 * One row per page that has a verdict this week.
 *
 * A page whose standing is `not_measured` or `no_week` gets **no row**:
 * both are properties of the week rather than of the page, and
 * `composeMail`'s whole-mail line states them once for the mail (ADR-071
 * point 3). Stating them once per page would be the merge ADR-071 forbids,
 * printed.
 *
 * A page with no address is likewise dropped rather than named some other
 * way: there is nothing measured left to identify it by.
 */
function verdictRows(pages: readonly WeeklyPage[]): readonly VerdictRow[] {
  const rows: VerdictRow[] = [];
  for (const page of pages) {
    if (page.liveUrl === null) continue;
    const standing = page.standing;
    if (standing.kind === "not_measured" || standing.kind === "no_week") continue;
    if (standing.kind === "not_judgeable") {
      rows.push({
        subject: PAGE,
        subjectVars: { page: page.liveUrl },
        verdict: PAGE_VERDICTS.not_judgeable,
      });
      continue;
    }
    rows.push({ ...subjectOf(page.liveUrl, standing), verdict: PAGE_VERDICTS[standing.verdict] });
  }
  return rows;
}

/**
 * REQ-063 c3 and c4, as the row's own sentence: both raw figures, the date
 * the measurement was taken, and — only where the measurement compared
 * against is not the previous week's — the interval the change spans.
 *
 * Three keys, chosen by what there is to say and never by an `if` inside
 * one sentence. A movement whose figures are not both measured says
 * nothing about a change: it takes the plain form rather than printing a
 * placeholder for the figure that is missing (REQ-064 c1).
 */
function subjectOf(
  liveUrl: string,
  standing: Extract<WeekStanding, { kind: "verdict" }>
): { subject: CopyKey; subjectVars: CopyVars } {
  const movement = standing.movement;
  if (movement === null || movement.from.kind === "unmeasured" || movement.to.kind === "unmeasured") {
    return { subject: PAGE, subjectVars: { page: liveUrl } };
  }
  const common: CopyVars = {
    page: liveUrl,
    // The formatter both bodies share, so a figure in this sentence is
    // written the way a figure in a stat block is.
    from: formatStat(movement.from, "integer"),
    to: formatStat(movement.to, "integer"),
    measuredAt: standing.measuredAt.toISOString().slice(0, 10),
  };
  if (movement.spansWeeks === 1) return { subject: PAGE_MOVED, subjectVars: common };
  return {
    subject: PAGE_MOVED_OVER,
    subjectVars: { ...common, weeks: String(movement.spansWeeks) },
  };
}

/** "Next 3" — named by the search each targets, which is measured fact.
 *  The list is the caller's, already ranked and already cut to three:
 *  supply is the cap and this template never pads it. */
function nextRows(next: readonly { targetQuery: string }[]): readonly ListRow[] {
  return next.map((opportunity) => ({ label: NEXT_ITEM, vars: { search: opportunity.targetQuery } }));
}
