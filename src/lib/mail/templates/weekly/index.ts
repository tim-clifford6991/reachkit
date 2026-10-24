// SPEC §8 — the Monday mail, in the order board `MondayMail` draws it: a
// greeting, the calm line, Overview's numbers (Pages, Google, AI, and the
// month's figures on its first Monday), the week's pages with why each was
// chosen and how to stop it, the pace line, the one button.
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no vendor knowledge, no sentence of
// its own. Every value that can be absent enters as a `Measured<T>`, so what
// is printed for a value nobody measured is decided once in `blocks/omit.ts`
// or by the row that says so; a measured zero prints as the result it is.
//
// **The numbers are Overview's numbers** (owner, 2026-10-19, the simple
// model: "app and Monday email, same numbers"). The caller reads them with
// the readers Overview reads them with.
//
// **What is not here.** The whole-mail line a week that was not measured
// (or was measured only in part) carries is `composeMail`'s, chosen from
// the `MeasurementState` the caller passes beside these blocks (REQ-065).
// The footer's links — pause, settings, unsubscribe — are the caller's,
// because each carries a token only the caller can sign.
//
// **A page is named by its address and an opportunity by the search it
// targets.** Both are measured fact. Neither is named by its title: a
// page's title and an opportunity's are model-written, and REQ-093 does
// not admit model text into a mail as ReachKit's own statement about the
// reader's market (§8, ADR-012). Where the board draws a title, the dated
// SPEC line wins (decision 2026-10-19-1581).
import { env } from "@/lib/config/env";
import { WEEK_PLAN } from "@/lib/config/constants";
import type { Measured } from "@/lib/measure/measured";
import { shownKey } from "@/lib/measure/registry";
import type { IndexState, WeekStanding } from "@/lib/opportunities";
import { PAGE_VERDICTS } from "@/lib/presentation/bands";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { IssueChange } from "@/lib/site-issues/changes";
import { formatMailDayMonth, formatMailWeekday, formatStat } from "../../blocks/format";
import { issueChangeRows } from "../../blocks/site-issues";
import type { CopyVars, FactRow, ListRow, MailBlock, StatRow, VerdictRow } from "../../blocks/types";

const SUBJECT = "mail.weekly.subject" satisfies CopyKey;
const ACTION = "mail.weekly.action" satisfies CopyKey;
const REASON = "mail.reason.weekly" satisfies CopyKey;

/** The Overview's address (§4.5), absolute — the construction
 *  `draft-ready` uses for its veto link, off the one binding `env.ts`
 *  validates at boot. */
function overviewHref(): string {
  return new URL("/app", env.NEXT_PUBLIC_APP_URL).toString();
}
const HI = "mail.weekly.hi" satisfies CopyKey;
const HI_UNNAMED = "mail.weekly.hi.unnamed" satisfies CopyKey;
const CALM = "mail.weekly.calm" satisfies CopyKey;
const NEEDS_YOU_ACTION = "mail.weekly.needsYou.action" satisfies CopyKey;
const CONNECT = "mail.weekly.connect" satisfies CopyKey;
const CONNECT_ACTION = "mail.weekly.connect.action" satisfies CopyKey;
const LIVE = shownKey("mail-pages-live") satisfies CopyKey;
const PLANNED = shownKey("mail-pages-planned") satisfies CopyKey;
const GOOGLE = "mail.weekly.google.title" satisfies CopyKey;
const GOOGLE_INTRO = "mail.weekly.google.intro" satisfies CopyKey;
const SHOWING_CLIMBING = "mail.weekly.google.showing.climbing" satisfies CopyKey;
const OF_LIVE = "mail.weekly.google.of" satisfies CopyKey;
const GOOGLE_EARLY = "mail.weekly.google.early" satisfies CopyKey;
const VISITS = shownKey("mail-google-visits") satisfies CopyKey;
const CLIMB = "mail.weekly.google.climb" satisfies CopyKey;
const CLIMB_CLIMBING = "mail.weekly.google.climb.climbing" satisfies CopyKey;
const CLIMB_NONE = "mail.weekly.google.climb.none" satisfies CopyKey;
const AI = "mail.weekly.ai.title" satisfies CopyKey;
const AI_LINKED = shownKey("mail-ai-linked") satisfies CopyKey;
const AI_ASKED = "mail.weekly.ai.asked" satisfies CopyKey;
const AI_EARLY = "mail.weekly.ai.early" satisfies CopyKey;
const AI_READS = shownKey("mail-ai-reads") satisfies CopyKey;
const MONTH = "mail.weekly.month" satisfies CopyKey;
const MONTH_INTRO = "mail.weekly.month.intro" satisfies CopyKey;
const SCORE = shownKey("mail-score-month") satisfies CopyKey;
const MARKET = shownKey("mail-market-month") satisfies CopyKey;
const REPUTATION = shownKey("mail-reputation") satisfies CopyKey;
const OF = "mail.weekly.month.of" satisfies CopyKey;
const UP = "mail.weekly.month.up" satisfies CopyKey;
const DOWN = "mail.weekly.month.down" satisfies CopyKey;
const NOT_MEASURED = "mail.weekly.number.unmeasured" satisfies CopyKey;
const NOW_NAMED = "mail.weekly.nowNamed" satisfies CopyKey;
const NOW_NAMED_ITEM = "mail.weekly.nowNamed.item" satisfies CopyKey;
const VERDICTS = "mail.weekly.verdicts" satisfies CopyKey;
const VERDICTS_NONE = "mail.weekly.verdicts.none" satisfies CopyKey;
const NEXT = "mail.weekly.next" satisfies CopyKey;
const NEXT_INTRO = "mail.weekly.next.intro" satisfies CopyKey;
const NEXT_NONE = "mail.weekly.next.none" satisfies CopyKey;
const NEXT_ITEM = "mail.weekly.next.item" satisfies CopyKey;
const NEXT_WHY = "mail.weekly.next.why" satisfies CopyKey;
const NEXT_STOP = "mail.weekly.next.stop" satisfies CopyKey;
const NEXT_EDIT = "mail.weekly.next.edit" satisfies CopyKey;
const NEXT_MORE = "mail.weekly.next.more" satisfies CopyKey;
const NEXT_MORE_SPAN = "mail.weekly.next.more.span" satisfies CopyKey;
const NEXT_ALL = "mail.weekly.next.all" satisfies CopyKey;
const NEXT_SKIPPED = "mail.weekly.next.skipped" satisfies CopyKey;
const STRIP_DAY = "mail.weekly.strip.day" satisfies CopyKey;
const PACE = "mail.weekly.pace" satisfies CopyKey;
const SPARES = "mail.weekly.spares" satisfies CopyKey;
const PAGE = "mail.weekly.page" satisfies CopyKey;
const PAGE_MOVED = "mail.weekly.page.moved" satisfies CopyKey;
const PAGE_MOVED_OVER = "mail.weekly.page.moved_over" satisfies CopyKey;
const PAGE_NOT_VERIFIED = "mail.weekly.page.not_verified" satisfies CopyKey;

/** A page's day line, by whether it updates a page and whether it goes live today. */
const DAY_LINE = {
  new: { today: "mail.weekly.next.day.new.today", later: "mail.weekly.next.day.new" },
  update: { today: "mail.weekly.next.day.update.today", later: "mail.weekly.next.day.update" },
} as const satisfies Record<string, Record<string, CopyKey>>;

/** The board writes out the first three pages and counts the rest. */
const WRITTEN_OUT = 3;

/** One judged page, as the mail needs it. `standing` is read back from the
 *  week's stored verdict and is never recomputed here. */
export interface WeeklyPage {
  readonly liveUrl: string | null;
  readonly standing: WeekStanding;
  /** Issue 1538: whether any stored search result held the page. Absent
   *  where that could not be read. */
  readonly indexState?: IndexState;
}

/** A page the week planned: its search and, once its day is committed,
 *  that day, whether it updates a page, why it was chosen and its two links. */
export interface WeeklyNext {
  readonly targetQuery: string;
  /** `YYYY-MM-DD`, site-local. */
  readonly day?: string;
  readonly update?: boolean;
  /** Why the week chose it, as Plan says it; absent where nothing is stored. */
  readonly why?: string;
  readonly stopHref?: string;
  readonly editHref?: string;
}

/** The week the strip draws: its seven dates, the mail's own date, the site's
 *  publish time as the clock writes it, and Plan's address. */
export interface WeeklyCalendar {
  readonly days: readonly string[];
  readonly today: string;
  readonly time: string;
  readonly planHref: string;
}

export interface WeeklyMail {
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/** SPEC §8 (2026-09-20, #933): the one item that needs the customer this
 *  week, as the caller read it. Absent where nothing does, and then the
 *  calm line stands in its place. */
export interface WeeklyNeedsYou {
  readonly line: CopyKey;
  readonly vars?: CopyVars;
  readonly href: string;
}

/** The Google steps the mail states: Overview's ladder past *Live*, which
 *  the pages row already says. */
export type GoogleStep = ReturnType<typeof shownKey<"mail-google-found" | "mail-google-showing" | "mail-google-first-page">>;

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
    /** Showing pages still climbing, as Overview's badge counts them. */
    readonly climbing?: number;
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
  /** Who the mail greets and which week of service it is; absent, no greeting. */
  greeting?: { readonly name: string | null; readonly week: number; readonly business: string };
  /** The hosted address still waiting for its record, and where it is
   *  connected. Absent once it is live. */
  connect?: { readonly host: string; readonly href: string };
  /** Absent on a week that measured nothing: the whole-mail line says so
   *  once, and four rows saying it again would repeat it. */
  numbers?: WeeklyNumbers;
  /** The one thing waiting on the customer, where there is one. */
  needsYou?: WeeklyNeedsYou;
  /** The week's standings. `unmeasured` omits the section; a measured
   *  empty list is "you have published nothing yet", its own written line. */
  pages: Measured<readonly WeeklyPage[]>;
  /** The week's pages, in date order (issue 1559). `unmeasured` omits the
   *  section; measured-and-empty states the supply's own empty line — the
   *  calendar is never padded (DECISIONS 2026-08-28). */
  next: Measured<readonly WeeklyNext[]>;
  /** The week's dates and publish time; absent, no strip and no calm line. */
  calendar?: WeeklyCalendar;
  /** Dates in the committed week with no page planned. */
  skippedDays?: number;
  /** The week's spares, written where a day's page cannot be. Absent or
   *  empty: no list. */
  spares?: Measured<readonly { targetQuery: string }[]>;
  /** SPEC §9 on Monday (#573): the technical checks whose count moved since
   *  last Monday. Unmeasured — or absent — where either week stored no
   *  checks, and then the rows are absent. */
  issues?: Measured<readonly IssueChange[]>;
  /** D28 (#1185): what ReachKit changed about the market it measures this
   *  week, one line each, with the reason. */
  marketChanges?: readonly { readonly line: CopyKey; readonly vars: CopyVars }[];
  /** SPEC §8 2026-09-29 (D16): the tracked questions that now name the
   *  site, each by its search and with the answer's address. */
  nowNamed?: Measured<readonly { search: string; answerUrl: string }[]>;
}): WeeklyMail {
  const issues = a.issues === undefined ? [] : issueChangeRows(a.issues);
  const g = a.greeting;
  return {
    subject: SUBJECT,
    reason: REASON,
    blocks: [
      ...(g === undefined
        ? []
        : [
            g.name === null || g.name.trim() === ""
              ? ({ block: "heading", text: HI_UNNAMED, vars: { week: String(g.week), business: g.business } } as const)
              : ({ block: "heading", text: HI, vars: { name: g.name.trim(), week: String(g.week), business: g.business } } as const),
          ]),
      // The calm line, only where nothing waits on the customer and pages can go live.
      ...(a.needsYou !== undefined || a.connect !== undefined || a.calendar === undefined
        ? []
        : [{ block: "paragraph", text: CALM, vars: { time: a.calendar.time } } as const]),
      // Until the address is connected no page goes live, so it comes early,
      // every week.
      ...(a.connect === undefined
        ? []
        : ([
            { block: "notice", text: CONNECT, vars: { host: a.connect.host } },
            { block: "action", label: CONNECT_ACTION, href: a.connect.href, variant: "secondary" },
          ] as const)),
      ...(a.numbers === undefined ? [] : numberBlocks(a.numbers)),
      ...(a.marketChanges ?? []).map((change) => ({ block: "paragraph", text: change.line, vars: change.vars }) as const),
      // What moved among the technical checks. Nothing measured, or nothing moved: no block.
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
      ...weekBlocks(a.next, a.calendar),
      ...(a.skippedDays === undefined || a.skippedDays === 0
        ? []
        : [{ block: "paragraph", text: NEXT_SKIPPED, vars: { count: String(a.skippedDays) } } as const]),
      ...(a.spares === undefined || a.spares.kind === "unmeasured" || a.spares.value.length === 0
        ? []
        : [{ block: "list", label: SPARES, items: mapMeasuredRows(a.spares, spareRows), emptyLine: NEXT_NONE } as const]),
      // #933's one needs-you item: the line, and the button that opens it.
      ...(a.needsYou === undefined
        ? []
        : ([
            { block: "notice", text: a.needsYou.line, ...(a.needsYou.vars === undefined ? {} : { vars: a.needsYou.vars }) },
            { block: "action", label: NEEDS_YOU_ACTION, href: a.needsYou.href, variant: "secondary" },
          ] as const)),
      { block: "paragraph", text: PACE },
      // S20's one solid button. Absolute, because a mail client resolves
      // no relative path.
      { block: "action", label: ACTION, href: overviewHref() },
    ],
  };
}

/** Pages, then Google, AI and the month, each under its own title. Every row a
 *  reader could take for a zero carries the line it states instead. */
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
    blocks.push({ block: "heading", text: GOOGLE });
    if (n.live.kind !== "unmeasured") blocks.push({ block: "paragraph", text: GOOGLE_INTRO, vars: { n: formatStat(n.live, "integer") } });
    if (steps.length > 0) {
      blocks.push({
        block: "stats",
        items: steps.map((step): StatRow => ({
          ...(step.name === "draft.ladder.showing" && (g.climbing ?? 0) > 0
            ? { label: SHOWING_CLIMBING, labelVars: { n: String(g.climbing) } }
            : { label: step.name }),
          value: step.count,
          format: "integer",
          note: { text: OF_LIVE, vars: { n: String(step.of) } },
          unmeasuredLine: NOT_MEASURED,
        })),
      });
    }
    if (g.early) blocks.push({ block: "paragraph", text: GOOGLE_EARLY });
    if (g.visits !== undefined && g.visits.kind !== "unmeasured") {
      blocks.push({ block: "paragraph", text: VISITS, vars: { n: formatStat(g.visits, "integer") } });
    }
    if (g.climb === null) blocks.push({ block: "paragraph", text: CLIMB_NONE });
    else if (g.climb !== undefined) {
      const vars = { search: g.climb.search, from: String(g.climb.from), to: String(g.climb.to) };
      blocks.push({ block: "paragraph", text: g.climb.climbing ? CLIMB_CLIMBING : CLIMB, vars });
    }
  }
  if (n.ai !== undefined) {
    blocks.push({ block: "heading", text: AI });
    if (n.ai.linked.kind === "unmeasured") blocks.push({ block: "paragraph", text: AI_EARLY });
    else {
      const linked = formatStat(n.ai.linked, "integer");
      blocks.push(
        { block: "paragraph", text: AI_LINKED, vars: { n: linked, of: String(n.ai.asked) } },
        { block: "paragraph", text: AI_ASKED, vars: { n: linked } }
      );
    }
    if (n.ai.reads !== undefined && n.ai.reads.kind !== "unmeasured") {
      blocks.push({ block: "paragraph", text: AI_READS, vars: { n: formatStat(n.ai.reads, "integer") } });
    }
  }
  const m = n.month;
  if (m !== undefined) {
    const rows: FactRow[] = [
      ...monthRow(SCORE, undefined, m.score?.value, undefined, m.score?.change),
      ...monthRow(MARKET, undefined, m.market?.value, m.market?.of, m.market?.change),
      ...monthRow(REPUTATION, { weeks: String(m.reputation?.weeks ?? "") }, m.reputation?.value, m.reputation?.answers),
    ];
    if (rows.length > 0) {
      blocks.push({ block: "heading", text: MONTH }, { block: "paragraph", text: MONTH_INTRO }, { block: "facts", items: rows });
    }
  }
  return blocks;
}

/** One of the month's figures as the board writes it: `31 up from 27`,
 *  `1 of 12`. A figure nobody stored has no row; a change nobody measured is not stated. */
function monthRow(
  label: CopyKey,
  labelVars: CopyVars | undefined,
  value: Measured<number> | undefined,
  of: number | undefined,
  change?: Measured<number>
): FactRow[] {
  if (value === undefined || value.kind === "unmeasured") return [];
  const now = of === undefined ? formatStat(value, "integer") : copy(OF, { n: formatStat(value, "integer"), of: String(of) });
  const moved = change !== undefined && change.kind !== "unmeasured" && change.value !== 0 ? change.value : null;
  const written = moved === null ? now : copy(moved > 0 ? UP : DOWN, { now, before: String(value.value - moved) });
  return [{ label, ...(labelVars === undefined ? {} : { labelVars }), value: written }];
}

/** "This week's pages": its title and promise, the Monday-to-Sunday strip,
 *  the first pages written out with why and their two links, and a count of
 *  the rest leading to Plan. A week nobody committed omits the section. */
function weekBlocks(next: Measured<readonly WeeklyNext[]>, calendar: WeeklyCalendar | undefined): readonly MailBlock[] {
  if (next.kind === "unmeasured") return [];
  const strip: FactRow[] =
    calendar === undefined
      ? []
      : calendar.days.map((day) => {
          const page = next.value.find((p) => p.day === day);
          const word: CopyKey =
            page === undefined
              ? "mail.weekly.strip.none"
              : day === calendar.today
                ? "mail.weekly.strip.today"
                : page.update === true
                  ? "mail.weekly.strip.update"
                  : "mail.weekly.strip.new";
          return { label: STRIP_DAY, labelVars: { day: formatMailWeekday(day) }, value: copy(word) };
        });
  return [
    { block: "heading", text: NEXT },
    { block: "paragraph", text: NEXT_INTRO, vars: { n: String(WEEK_PLAN.days) } },
    ...(strip.length === 0 ? [] : [{ block: "facts", items: strip } as const]),
    { block: "list", items: mapMeasuredRows(next, (pages) => nextRows(pages, calendar)), emptyLine: NEXT_NONE },
  ];
}

/** The first pages written out, then the rest as one row that leads to Plan. */
function nextRows(next: readonly WeeklyNext[], calendar: WeeklyCalendar | undefined): readonly ListRow[] {
  const shown = calendar === undefined ? next : next.slice(0, WRITTEN_OUT);
  const rest = next.slice(shown.length);
  const rows = shown.map((page): ListRow => {
    if (page.day === undefined || calendar === undefined) return { label: NEXT_ITEM, vars: { search: page.targetQuery } };
    const kind = DAY_LINE[page.update === true ? "update" : "new"];
    const today = page.day === calendar.today;
    return {
      label: today ? kind.today : kind.later,
      vars: { day: formatMailWeekday(page.day), time: calendar.time, ...(today ? {} : { date: formatMailDayMonth(page.day) }) },
      detail: [
        { text: NEXT_ITEM, vars: { search: page.targetQuery } },
        ...(page.why === undefined ? [] : [{ text: NEXT_WHY as CopyKey, vars: { reason: page.why } }]),
      ],
      links: [
        ...(page.stopHref === undefined ? [] : [{ label: NEXT_STOP as CopyKey, href: page.stopHref }]),
        ...(page.editHref === undefined ? [] : [{ label: NEXT_EDIT as CopyKey, href: page.editHref }]),
      ],
    };
  });
  if (rest.length === 0 || calendar === undefined) return rows;
  const named = rest.flatMap((page) => (page.day === undefined ? [] : [formatMailWeekday(page.day)]));
  return [
    ...rows,
    {
      label: named.length < 2 ? NEXT_MORE : NEXT_MORE_SPAN,
      vars: { from: named[0] ?? "", to: named.at(-1) ?? "", n: String(rest.length) },
      links: [{ label: NEXT_ALL, vars: { n: String(next.length) }, href: calendar.planHref }],
    },
  ];
}

/** A spare is named by its search alone. */
function spareRows(spares: readonly { targetQuery: string }[]): readonly ListRow[] {
  return spares.map((spare) => ({ label: NEXT_ITEM, vars: { search: spare.targetQuery } }));
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
