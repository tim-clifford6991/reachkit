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
// `stoppable: 'toggle'` in the register; the stop control is the caller's to
// hand `sendEmail`, and this file carries none. No caller hands one yet:
// there is no `/unsubscribe/{token}` page for the signed token to land on.
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
import { env } from "@/lib/config/env";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { WeekStanding } from "@/lib/opportunities";
import { PAGE_VERDICTS } from "@/lib/presentation/bands";
import type { CopyKey } from "@/lib/presentation/copy";
import type { IssueChange } from "@/lib/site-issues/changes";
import { formatStat } from "../../blocks/format";
import { issueChangeRows } from "../../blocks/site-issues";
import type { CopyVars, ListRow, MailBlock, VerdictRow } from "../../blocks/types";

const SUBJECT = "mail.weekly.subject" satisfies CopyKey;
const HEADING = "mail.weekly.heading" satisfies CopyKey;
const BODY = "mail.weekly.body" satisfies CopyKey;
const ACTION = "mail.weekly.action" satisfies CopyKey;
const REASON = "mail.reason.weekly" satisfies CopyKey;

/** The Overview's address (§4.5), absolute — the construction
 *  `draft-ready` uses for its veto link, off the one binding `env.ts`
 *  validates at boot. */
function overviewHref(): string {
  return new URL("/app", env.NEXT_PUBLIC_APP_URL).toString();
}
const MOVED_UP = "mail.weekly.moved.up" satisfies CopyKey;
const MOVED_FLAT = "mail.weekly.moved.flat" satisfies CopyKey;
const MOVED_DOWN = "mail.weekly.moved.down" satisfies CopyKey;
const NEEDS_YOU_ACTION = "mail.weekly.needsYou.action" satisfies CopyKey;
const SEARCHES = "mail.weekly.searches" satisfies CopyKey;
const PAGES_LIVE = "mail.weekly.pagesLive" satisfies CopyKey;
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
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
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
/** SPEC §8 (2026-09-20, #933): the one item that needs the customer this
 *  week, as the caller read it — the written line's own key and the address
 *  of the thing that needs them. Absent where nothing does, and then the
 *  mail says nothing about it: a week with nothing outstanding states
 *  nothing rather than "nothing needs you". */
export interface WeeklyNeedsYou {
  readonly line: CopyKey;
  readonly vars?: CopyVars;
  readonly href: string;
}

export function buildWeekly(a: {
  scoreDelta: Measured<number>;
  aiAnswersDelta: Measured<number>;
  /** SPEC §8 (2026-09-20, #933): the four Overview numbers as the app
   *  states them — the score up top with its change, and the three beside
   *  it. Each is omitted on its own where the week did not measure it. */
  score?: Measured<number>;
  searches?: Measured<number>;
  searchesDelta?: Measured<number>;
  aiAnswers?: Measured<number>;
  pagesLive?: Measured<number>;
  pagesLiveDelta?: Measured<number>;
  /** The one thing waiting on the customer, where there is one. */
  needsYou?: WeeklyNeedsYou;
  /** The week's standings. `unmeasured` where the week produced none to
   *  read — which omits the section rather than stating an empty one; a
   *  measured empty list is "you have published nothing yet", which is a
   *  different fact and gets its own written line. */
  pages: Measured<readonly WeeklyPage[]>;
  /** The next three, by the ranking. `unmeasured` omits the section;
   *  measured-and-empty states the supply's own empty line — the calendar
   *  is never padded (DECISIONS 2026-08-28). */
  next: Measured<readonly { targetQuery: string }[]>;
  /** SPEC §9 on Monday (#573): the technical checks whose count moved since
   *  last Monday. Unmeasured — or absent — where either week stored no
   *  checks, and then the rows are absent; a week with no movement has
   *  none either. */
  issues?: Measured<readonly IssueChange[]>;
}): WeeklyMail {
  const issues = a.issues === undefined ? [] : issueChangeRows(a.issues);
  const unknownAt = unmeasured<number>("undeterminable", new Date(0));
  return {
    subject: SUBJECT,
    reason: REASON,
    blocks: [
      // S20's shape: the heading and the one line that says what this mail
      // is and is not — "Only what was measured. A number that was not
      // measured is not here." — then the measured sections, which §12's
      // omission rule drops one at a time.
      { block: "heading", text: HEADING },
      // SPEC §8 (2026-09-20, #933): the one number up top is the score,
      // with the week's change beside it. A week that did not measure it
      // takes the whole block with it — including the change, which is a
      // movement of nothing without its number.
      {
        block: "hero",
        label: SCORE,
        value: a.score ?? unknownAt,
        format: "integer",
        change: a.scoreDelta,
      },
      // The headline sentence, chosen by what the week actually did. One
      // key per direction rather than one sentence with a slot: "the gap is
      // closing" is not a thing to say about a week that went the other
      // way, and a mail must not claim a direction it did not measure.
      { block: "paragraph", text: movementLine(a.scoreDelta) },
      { block: "paragraph", text: BODY },
      // The other three Overview numbers, with their change. Two to a row;
      // each is dropped on its own, and the group goes when none is left.
      {
        block: "stats",
        items: [
          { label: SEARCHES, value: a.searches ?? unknownAt, format: "integer", ...(a.searchesDelta === undefined ? {} : { change: a.searchesDelta }) },
          { label: AI_ANSWERS, value: a.aiAnswers ?? unknownAt, format: "integer", change: a.aiAnswersDelta },
          { label: PAGES_LIVE, value: a.pagesLive ?? unknownAt, format: "integer", ...(a.pagesLiveDelta === undefined ? {} : { change: a.pagesLiveDelta }) },
        ],
      },
      // What moved among the technical checks: last week's count, then this
      // week's figure. Nothing measured, or nothing moved: no block.
      ...(issues.length === 0 ? [] : [{ block: "facts", items: issues } as const]),
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
      // #933's one needs-you item: the line, and the button that opens the
      // thing itself. Both or neither — an item with nowhere to go is a
      // sentence about a page the reader cannot reach.
      ...(a.needsYou === undefined
        ? []
        : ([
            { block: "notice", text: a.needsYou.line, ...(a.needsYou.vars === undefined ? {} : { vars: a.needsYou.vars }) },
            { block: "action", label: NEEDS_YOU_ACTION, href: a.needsYou.href, variant: "secondary" },
          ] as const)),
      // S20's one solid button. Absolute, because a mail client resolves
      // no relative path.
      { block: "action", label: ACTION, href: overviewHref() },
    ],
  };
}

/**
 * SPEC §8 (2026-09-20, #933) — the headline sentence, from the week's own
 * movement.
 *
 * Three keys and no slot: a sentence that read "the gap is {direction}"
 * would be one sentence pretending to be three, and the owner's drafted
 * line ("The gap is closing…") is true of exactly one of the three. A week
 * whose score was not measured says the neutral one — it has moved nothing
 * it can speak about, and the mail's own body line then says why.
 */
function movementLine(scoreDelta: Measured<number>): CopyKey {
  if (scoreDelta.kind === "unmeasured") return MOVED_FLAT;
  if (scoreDelta.value > 0) return MOVED_UP;
  if (scoreDelta.value < 0) return MOVED_DOWN;
  return MOVED_FLAT;
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
