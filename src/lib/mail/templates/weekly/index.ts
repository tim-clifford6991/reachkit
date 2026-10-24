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
// **The numbers are Overview's numbers** (owner, 2026-10-19, the simple
// model: "app and Monday email, same numbers"): the pages live and planned,
// the Google steps, the AI rows, and in the first mail of a month the
// figures that move over months (M-b). The caller reads them with the
// readers Overview reads them with. Under them every block is a fact.
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
import { formatMailDay, formatStat } from "../../blocks/format";
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
const CONNECT = "mail.weekly.connect" satisfies CopyKey;
const CONNECT_ACTION = "mail.weekly.connect.action" satisfies CopyKey;
const LIVE = "mail.weekly.pages.live" satisfies CopyKey;
const PLANNED = "mail.weekly.pages.planned" satisfies CopyKey;
const OF_LIVE = "mail.weekly.google.of" satisfies CopyKey;
const GOOGLE_EARLY = "mail.weekly.google.early" satisfies CopyKey;
const VISITS = "mail.weekly.google.visits" satisfies CopyKey;
const CLIMB = "mail.weekly.google.climb" satisfies CopyKey;
const CLIMB_CLIMBING = "mail.weekly.google.climb.climbing" satisfies CopyKey;
const CLIMB_NONE = "mail.weekly.google.climb.none" satisfies CopyKey;
const AI_LINKED = "mail.weekly.ai.linked" satisfies CopyKey;
const AI_LINKED_OF = "mail.weekly.ai.linked.of" satisfies CopyKey;
const AI_EARLY = "mail.weekly.ai.early" satisfies CopyKey;
const AI_READS = "mail.weekly.ai.reads" satisfies CopyKey;
const MONTH = "mail.weekly.month" satisfies CopyKey;
const SCORE = "mail.weekly.month.score" satisfies CopyKey;
const SCORE_OF = "mail.weekly.month.score.of" satisfies CopyKey;
const MARKET = "mail.weekly.month.market" satisfies CopyKey;
const MARKET_OF = "mail.weekly.month.market.of" satisfies CopyKey;
const REPUTATION = "mail.weekly.month.reputation" satisfies CopyKey;
const REPUTATION_OF = "mail.weekly.month.reputation.of" satisfies CopyKey;
const NOT_MEASURED = "mail.weekly.number.unmeasured" satisfies CopyKey;
const NOW_NAMED = "mail.weekly.nowNamed" satisfies CopyKey;
const NOW_NAMED_ITEM = "mail.weekly.nowNamed.item" satisfies CopyKey;
const VERDICTS = "mail.weekly.verdicts" satisfies CopyKey;
const VERDICTS_NONE = "mail.weekly.verdicts.none" satisfies CopyKey;
const NEXT = "mail.weekly.next" satisfies CopyKey;
const NEXT_NONE = "mail.weekly.next.none" satisfies CopyKey;
const NEXT_ITEM = "mail.weekly.next.item" satisfies CopyKey;
const NEXT_DAY = "mail.weekly.next.day" satisfies CopyKey;
const NEXT_SKIPPED = "mail.weekly.next.skipped" satisfies CopyKey;
const SPARES = "mail.weekly.spares" satisfies CopyKey;
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

/** A page the week planned: its search, and, once its day is committed,
 *  that day and the link that stops it before it is written. */
export interface WeeklyNext {
  readonly targetQuery: string;
  readonly day?: string;
  readonly stopHref?: string;
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

/** The Google steps the mail states: Overview's ladder past *Live*, which
 *  the pages row already says. */
export type GoogleStep = "draft.ladder.found" | "draft.ladder.showing" | "draft.ladder.first-page";

/**
 * Overview's weekly figures, as the caller read them with Overview's own
 * readers. A count nothing read is `null` or unmeasured, and its row says
 * so: never a zero.
 */
export interface WeeklyNumbers {
  readonly live: Measured<number>;
  readonly planned: Measured<number>;
  /** Absent where no page is live: Overview then draws no ladder. */
  readonly google?: {
    /** Each step over the pages it can be read on; unmeasured where none was read. */
    readonly steps: readonly { readonly name: GoogleStep; readonly count: Measured<number>; readonly of: number }[];
    /** No page shows in results yet, so the steps past *Found* are too early to count. */
    readonly early: boolean;
    /** Visits from Google this week on the hosted pages; absent where none can be counted. */
    readonly visits?: Measured<number>;
    /** `null` where a place was read and no page rose; absent with no place read. */
    readonly climb?: { readonly search: string; readonly from: number; readonly to: number; readonly climbing: boolean } | null;
  };
  /** Absent where no page is live. */
  readonly ai?: {
    /** Live pages an answer to their own question linked, of `asked`;
     *  unmeasured before any page's own question was asked. */
    readonly linked: Measured<number>;
    readonly asked: number;
    /** AI reads this week, on a hosted page; absent elsewhere. */
    readonly reads?: Measured<number>;
  };
  /** Only in the first mail of a month (M-b); each figure absent where that pass stored none. */
  readonly month?: {
    readonly score?: { readonly value: Measured<number>; readonly change?: Measured<number> };
    readonly market?: { readonly value: Measured<number>; readonly of: number; readonly change?: Measured<number> };
    readonly reputation?: { readonly value: Measured<number>; readonly answers: number; readonly weeks: number };
  };
}

export function buildWeekly(a: {
  /** The hosted address still waiting for its record, and where it is
   *  connected. Absent once it is live. */
  connect?: { readonly host: string; readonly href: string };
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
  /** The week's pages, in date order, as this Monday committed them (issue
   *  1559). `unmeasured` omits the section; measured-and-empty states the
   *  supply's own empty line — the calendar is never padded (DECISIONS
   *  2026-08-28). */
  next: Measured<readonly WeeklyNext[]>;
  /** Dates in the committed week with no page planned. */
  skippedDays?: number;
  /** The week's spares, written where a day's page cannot be. Absent or
   *  empty: no list. */
  spares?: Measured<readonly { targetQuery: string }[]>;
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
      // Until the address is connected no page goes live, so it comes first,
      // every week.
      ...(a.connect === undefined
        ? []
        : ([
            { block: "notice", text: CONNECT, vars: { host: a.connect.host } },
            { block: "action", label: CONNECT_ACTION, href: a.connect.href, variant: "secondary" },
          ] as const)),
      // The first thing is the numbers (owner, 2026-10-07): Pages, Google, AI.
      ...(a.numbers === undefined ? [] : numberBlocks(a.numbers)),
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
      ...(a.skippedDays === undefined || a.skippedDays === 0
        ? []
        : [{ block: "paragraph", text: NEXT_SKIPPED, vars: { count: String(a.skippedDays) } } as const]),
      ...(a.spares === undefined || a.spares.kind === "unmeasured" || a.spares.value.length === 0
        ? []
        : [{ block: "list", label: SPARES, items: mapMeasuredRows(a.spares, nextRows), emptyLine: NEXT_NONE } as const]),
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

/** Pages, Google and AI, each its own group, then the month's figures. Every
 *  row a reader could take for a zero carries the line it states instead. */
function numberBlocks(n: WeeklyNumbers): readonly MailBlock[] {
  const blocks: MailBlock[] = [
    {
      block: "stats",
      items: [
        { label: LIVE, value: n.live, format: "integer", unmeasuredLine: NOT_MEASURED },
        { label: PLANNED, value: n.planned, format: "integer", unmeasuredLine: NOT_MEASURED },
      ],
    },
  ];
  const g = n.google;
  if (g !== undefined) {
    const steps = g.early ? g.steps.filter((step) => step.name === "draft.ladder.found") : g.steps;
    blocks.push({
      block: "stats",
      items: [
        ...steps.map((step): StatRow => ({
          label: step.name,
          value: step.count,
          format: "integer",
          note: { text: OF_LIVE, vars: { n: String(step.of) } },
          unmeasuredLine: NOT_MEASURED,
        })),
        ...(g.visits === undefined ? [] : [{ label: VISITS, value: g.visits, format: "integer" } as const]),
      ],
    });
    if (g.early) blocks.push({ block: "paragraph", text: GOOGLE_EARLY });
    if (g.climb === null) blocks.push({ block: "paragraph", text: CLIMB_NONE });
    else if (g.climb !== undefined) {
      const vars = { search: g.climb.search, from: String(g.climb.from), to: String(g.climb.to) };
      blocks.push({ block: "paragraph", text: g.climb.climbing ? CLIMB_CLIMBING : CLIMB, vars });
    }
  }
  if (n.ai !== undefined) {
    blocks.push({
      block: "stats",
      items: [
        {
          label: AI_LINKED,
          value: n.ai.linked,
          format: "integer",
          note: { text: AI_LINKED_OF, vars: { of: String(n.ai.asked) } },
          unmeasuredLine: AI_EARLY,
        },
        ...(n.ai.reads === undefined ? [] : [{ label: AI_READS, value: n.ai.reads, format: "integer" } as const]),
      ],
    });
  }
  const m = n.month;
  if (m !== undefined) {
    const rows: StatRow[] = [
      ...(m.score === undefined
        ? []
        : [{ label: SCORE, value: m.score.value, format: "integer", note: { text: SCORE_OF }, ...(m.score.change === undefined ? {} : { change: m.score.change }) } as const]),
      ...(m.market === undefined
        ? []
        : [
            {
              label: MARKET,
              value: m.market.value,
              format: "integer",
              note: { text: MARKET_OF, vars: { of: String(m.market.of) } },
              ...(m.market.change === undefined ? {} : { change: m.market.change }),
            } as const,
          ]),
      ...(m.reputation === undefined
        ? []
        : [
            {
              label: REPUTATION,
              value: m.reputation.value,
              format: "integer",
              note: { text: REPUTATION_OF, vars: { answers: String(m.reputation.answers), weeks: String(m.reputation.weeks) } },
            } as const,
          ]),
    ];
    if (rows.length > 0) blocks.push({ block: "paragraph", text: MONTH }, { block: "stats", items: rows });
  }
  return blocks;
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

/** The week's pages, named by the search each targets, which is measured
 *  fact; a committed day's row is its stop link. Supply is the cap and this
 *  template never pads it. */
function nextRows(next: readonly WeeklyNext[]): readonly ListRow[] {
  return next.map((page): ListRow =>
    page.day === undefined || page.stopHref === undefined
      ? { label: NEXT_ITEM, vars: { search: page.targetQuery } }
      : { label: NEXT_DAY, vars: { day: formatMailDay(page.day), search: page.targetQuery }, href: page.stopHref }
  );
}
