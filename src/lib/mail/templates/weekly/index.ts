// SPEC §8 (2026-10-07, issue 1329) — the Monday mail: the four headline
// numbers first, then what moved, the pages and the asks.
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no formatter, no vendor
// knowledge, no sentence of its own. Every value that can be absent enters
// as a `Measured<T>`, so what is printed for a value nobody measured is
// decided once in `blocks/omit.ts`: a headline number says it was not
// measured, a list that was not measured omits its section, and a measured
// zero prints as the result it is.
//
// **The numbers lead with what a page moves first** (owner, 2026-10-19,
// issue 1551; SEO review R5.1): the published pages' own questions an AI
// answer linked, then AI visits to a hosted blog, the pages in Google's
// first two pages, the pages linked, and last the AI mention rate, named
// as the brand reputation it is. The Discoverability Score is not in this
// mail: it is the free report's grade. Under them every block is a fact.
// No sentence says a number again.
//
// `weekly` is `stoppable: 'toggle'` in the register; the stop control is the
// caller's to hand `sendEmail`, and this file carries none. No caller hands
// one yet: there is no `/unsubscribe/{token}` page for the signed token to
// land on.
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
import type { Measured } from "@/lib/measure/measured";
import type { IndexState, WeekStanding } from "@/lib/opportunities";
import { PAGE_VERDICTS } from "@/lib/presentation/bands";
import type { CopyKey } from "@/lib/presentation/copy";
import type { IssueChange } from "@/lib/site-issues/changes";
import { formatStat } from "../../blocks/format";
import { issueChangeRows } from "../../blocks/site-issues";
import type { CopyVars, ListRow, MailBlock, StatRow, VerdictRow } from "../../blocks/types";

const SUBJECT = "mail.weekly.subject" satisfies CopyKey;
const HEADING = "mail.weekly.heading" satisfies CopyKey;
const ACTION = "mail.weekly.action" satisfies CopyKey;
const REASON = "mail.reason.weekly" satisfies CopyKey;

/** The Overview's address (§4.5), absolute — the construction
 *  `draft-ready` uses for its veto link, off the one binding `env.ts`
 *  validates at boot. */
function overviewHref(): string {
  return new URL("/app", env.NEXT_PUBLIC_APP_URL).toString();
}
const NEEDS_YOU_ACTION = "mail.weekly.needsYou.action" satisfies CopyKey;
const PAGE_QUESTIONS = "mail.weekly.number.pageQuestions" satisfies CopyKey;
const PAGE_QUESTIONS_OF = "mail.weekly.number.pageQuestions.of" satisfies CopyKey;
const MENTION_RATE = "mail.weekly.number.mentionRate" satisfies CopyKey;
const MENTION_RATE_BAND = "mail.weekly.number.mentionRate.band" satisfies CopyKey;
const MENTION_RATE_EARLY = "mail.weekly.number.mentionRate.early" satisfies CopyKey;
const PAGES_CITED = "mail.weekly.number.pagesCited" satisfies CopyKey;
const PAGES_CITED_WINDOW = "mail.weekly.number.pagesCited.window" satisfies CopyKey;
const TOP_20 = "mail.weekly.number.top20" satisfies CopyKey;
const AI_VISITS = "mail.weekly.number.aiVisits" satisfies CopyKey;
const AI_VISITS_AT_LEAST = "mail.weekly.number.aiVisits.atLeast" satisfies CopyKey;
const AI_VISITS_WINDOW = "mail.weekly.number.aiVisits.window" satisfies CopyKey;
const NOT_MEASURED = "mail.weekly.number.unmeasured" satisfies CopyKey;
const NOW_NAMED = "mail.weekly.nowNamed" satisfies CopyKey;
const NOW_NAMED_ITEM = "mail.weekly.nowNamed.item" satisfies CopyKey;
const VERDICTS = "mail.weekly.verdicts" satisfies CopyKey;
const VERDICTS_NONE = "mail.weekly.verdicts.none" satisfies CopyKey;
const NEXT = "mail.weekly.next" satisfies CopyKey;
const NEXT_NONE = "mail.weekly.next.none" satisfies CopyKey;
const NEXT_ITEM = "mail.weekly.next.item" satisfies CopyKey;
const PAGE = "mail.weekly.page" satisfies CopyKey;
const PAGE_MOVED = "mail.weekly.page.moved" satisfies CopyKey;
const PAGE_MOVED_OVER = "mail.weekly.page.moved_over" satisfies CopyKey;
const PAGE_NOT_VERIFIED = "mail.weekly.page.not_verified" satisfies CopyKey;

/** One judged page, as the mail needs it. `standing` is read back from the
 *  week's stored verdict and is never recomputed here. */
export interface WeeklyPage {
  readonly liveUrl: string | null;
  readonly standing: WeekStanding;
  /** Issue 1538: whether any stored search result held the page. Absent
   *  where that could not be read. */
  readonly indexState?: IndexState;
}

export interface WeeklyMail {
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

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

/**
 * D22's four headline numbers (SPEC §4, 2026-10-02), as the caller read
 * them from stored rows. Whole percentages and counts, as the app states
 * them. A number nobody measured is `unmeasured`, and its row says so.
 */
export interface WeeklyNumbers {
  /** Issue 1551: the published pages' own questions this week whose AI
   *  answer linked the site, out of those asked. Absent where the week
   *  asked none, and then the mail has no such row. */
  readonly pageQuestions?: { readonly cited: Measured<number>; readonly asked: number };
  /** The AI mention rate over the tracked buyer prompts, as a whole
   *  percentage, with the range it likely sits in. Before a rate may be
   *  shown (D58, issue 1287) it is the count of answers that named the
   *  site, with its sample. */
  readonly mentions:
    | { readonly kind: "rate"; readonly rate: Measured<number>; readonly low: number; readonly high: number }
    | { readonly kind: "count"; readonly mentioned: Measured<number>; readonly answers: number };
  /** Distinct pages of the site those answers cited, over `weeks` weeks. */
  readonly pagesCited: Measured<number>;
  readonly weeks: number;
  /** Published pages whose search the site holds a top-20 place for this
   *  week, and the change since the week before where both are stored. */
  readonly top20: Measured<number>;
  readonly top20Change?: Measured<number>;
  /** Pages an answer engine fetched over `windowDays` days, a floor. Only
   *  on a hosted blog with a page live: absent anywhere else, and then the
   *  mail has no such row, as Overview has no such tile. */
  readonly aiVisits?: { readonly fetches: Measured<number>; readonly windowDays: number };
}

export function buildWeekly(a: {
  /** Absent on a week that measured nothing: the whole-mail line says so
   *  once, and four rows saying it again would repeat it. */
  numbers?: WeeklyNumbers;
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
  /** D28 (#1185): what ReachKit changed about the market it measures this
   *  week — its category, a rival added or dropped — one line each, with
   *  the reason. Absent or empty: nothing changed, and nothing is said. */
  marketChanges?: readonly { readonly line: CopyKey; readonly vars: CopyVars }[];
  /** SPEC §8 2026-09-29 (D16): the tracked questions that now name the
   *  site, each by its search and with the answer's address. A week with
   *  none says nothing about it. */
  nowNamed?: Measured<readonly { search: string; answerUrl: string }[]>;
}): WeeklyMail {
  const issues = a.issues === undefined ? [] : issueChangeRows(a.issues);
  return {
    subject: SUBJECT,
    reason: REASON,
    blocks: [
      { block: "heading", text: HEADING },
      // The first thing is the numbers (owner, 2026-10-07), two to a row,
      // each with what it is read against (order: issue 1551).
      ...(a.numbers === undefined ? [] : [{ block: "stats", items: numberRows(a.numbers) } as const]),
      ...(a.marketChanges ?? []).map((change) => ({ block: "paragraph", text: change.line, vars: change.vars }) as const),
      // What moved among the technical checks: last week's count, then this
      // week's figure. Nothing measured, or nothing moved: no block.
      ...(issues.length === 0 ? [] : [{ block: "facts", items: issues } as const]),
      ...(a.nowNamed === undefined || a.nowNamed.kind === "unmeasured" || a.nowNamed.value.length === 0
        ? []
        : [
            {
              block: "list",
              label: NOW_NAMED,
              items: mapMeasuredRows(a.nowNamed, nowNamedRows),
              // Unreachable: an empty list is not composed at all.
              emptyLine: NOW_NAMED,
            } as const,
          ]),
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

/** The headline numbers as rows, in issue 1551's order. Each carries the
 *  line it states where nobody measured it, so a row is never dropped and
 *  never a zero. */
function numberRows(n: WeeklyNumbers): readonly StatRow[] {
  const weeks = String(n.weeks);
  const mentions: StatRow =
    n.mentions.kind === "rate"
      ? {
          label: MENTION_RATE,
          value: n.mentions.rate,
          format: "percent",
          note: { text: MENTION_RATE_BAND, vars: { low: String(n.mentions.low), high: String(n.mentions.high) } },
          unmeasuredLine: NOT_MEASURED,
        }
      : {
          label: MENTION_RATE,
          value: n.mentions.mentioned,
          format: "integer",
          note: { text: MENTION_RATE_EARLY, vars: { answers: String(n.mentions.answers) } },
          unmeasuredLine: NOT_MEASURED,
        };
  return [
    ...(n.pageQuestions === undefined
      ? []
      : [
          {
            label: PAGE_QUESTIONS,
            value: n.pageQuestions.cited,
            format: "integer",
            note: { text: PAGE_QUESTIONS_OF, vars: { asked: String(n.pageQuestions.asked) } },
            unmeasuredLine: NOT_MEASURED,
          } as const,
        ]),
    ...(n.aiVisits === undefined
      ? []
      : [
          {
            label: AI_VISITS,
            value: n.aiVisits.fetches,
            format: "integer",
            before: AI_VISITS_AT_LEAST,
            note: { text: AI_VISITS_WINDOW, vars: { days: String(n.aiVisits.windowDays) } },
            unmeasuredLine: NOT_MEASURED,
          } as const,
        ]),
    {
      label: TOP_20,
      value: n.top20,
      format: "integer",
      ...(n.top20Change === undefined ? {} : { change: n.top20Change }),
      unmeasuredLine: NOT_MEASURED,
    },
    {
      label: PAGES_CITED,
      value: n.pagesCited,
      format: "integer",
      note: { text: PAGES_CITED_WINDOW, vars: { weeks } },
      unmeasuredLine: NOT_MEASURED,
    },
    mentions,
  ];
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
    // Issue 1538: a page no stored search result held is not merely not
    // ranking — the row says it has not been seen, and never that it is
    // not indexed. A working page needs no such line.
    if (page.indexState === "not_verified" && standing.verdict !== "working") {
      rows.push({ subject: PAGE_NOT_VERIFIED, subjectVars: { page: page.liveUrl }, verdict: PAGE_VERDICTS[standing.verdict] });
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

/** A tracked question is named by its search, as a next page is, and the
 *  row leads to the answer. */
function nowNamedRows(questions: readonly { search: string; answerUrl: string }[]): readonly ListRow[] {
  return questions.map((question) => ({
    label: NOW_NAMED_ITEM,
    vars: { search: question.search },
    href: question.answerUrl,
  }));
}

/** "Next 3" — named by the search each targets, which is measured fact.
 *  The list is the caller's, already ranked and already cut to three:
 *  supply is the cap and this template never pads it. */
function nextRows(next: readonly { targetQuery: string }[]): readonly ListRow[] {
  return next.map((opportunity) => ({ label: NEXT_ITEM, vars: { search: opportunity.targetQuery } }));
}
