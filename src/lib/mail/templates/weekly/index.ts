// SPEC §8 — the Monday mail in board `MondayMail`'s order: greeting, calm line, Overview's numbers (and the month's on its first Monday),
// the week's pages with why and how to stop each, the pace line, one button. A block list only (ADR-040); absent values are `Measured<T>`.
// The numbers are Overview's, read with Overview's readers. The unmeasured-week line is `composeMail`'s (REQ-065); footer links are the caller's,
// since each carries a token only it can sign.
// A page is named by its address and an opportunity by its search: titles are model text, which REQ-093 keeps out (§8, ADR-012; decision 2026-10-19-1581).
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
const PREHEADER = "mail.weekly.preheader" satisfies CopyKey;
const ACTION = "mail.weekly.action" satisfies CopyKey;
const REASON = "mail.reason.weekly" satisfies CopyKey;

/** The Overview's address (§4.5), absolute from the boot-validated binding. */
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
const SET_ASIDE = {
  true: { one: "mail.weekly.setAside.one", many: "mail.weekly.setAside.many" },
  false: { one: "mail.weekly.setAside.one.unreplaced", many: "mail.weekly.setAside.many.unreplaced" },
} as const satisfies Record<string, Record<string, CopyKey>>;
const GOOGLE = "mail.weekly.google.title" satisfies CopyKey;
const SHOWING_CLIMBING = "mail.weekly.google.showing.climbing" satisfies CopyKey;
const OF_LIVE = "mail.weekly.google.of" satisfies CopyKey;
const GOOGLE_EARLY = "mail.weekly.google.early" satisfies CopyKey;
const VISITS = shownKey("mail-google-visits") satisfies CopyKey;
const VISITS_UP = shownKey("mail-google-visits-up") satisfies CopyKey;
const VISITS_DOWN = shownKey("mail-google-visits-down") satisfies CopyKey;
const VISITS_SAME = shownKey("mail-google-visits-same") satisfies CopyKey;
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

/** One judged page; `standing` is the week's stored verdict, never recomputed. */
export interface WeeklyPage {
  readonly liveUrl: string | null;
  readonly standing: WeekStanding;
  /** Whether any stored search result held the page; absent where unreadable. */
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
  readonly preheader: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/** SPEC §8: the one item needing the customer this week; absent, the calm line stands instead. */
export interface WeeklyNeedsYou {
  readonly line: CopyKey;
  readonly vars?: CopyVars;
  readonly href: string;
}

/** The Google steps the mail states: Overview's ladder past *Live*, which
 *  the pages row already says. */
export type GoogleStep = ReturnType<typeof shownKey<"mail-google-found" | "mail-google-showing" | "mail-google-first-page">>;

/** Overview's weekly figures from Overview's readers; a count nothing read says so in its row, never a zero. */
export interface WeeklyNumbers {
  readonly live: Measured<number>;
  readonly planned: Measured<number>;
  /** Pages the daily re-check set aside last week, and whether a next page was there to write; absent or 0, no line. */
  readonly setAside?: { readonly n: number; readonly replaced: boolean };
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
    /** The week before's visits, as the Google tab's second-to-last bar; absent in the first week with a visit. */
    readonly visitsBefore?: Measured<number>;
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
  /** The hosted address waiting for its record; absent once live. */
  connect?: { readonly host: string; readonly href: string };
  /** Absent on a week that measured nothing, which the whole-mail line already says once. */
  numbers?: WeeklyNumbers;
  /** The one thing waiting on the customer, where there is one. */
  needsYou?: WeeklyNeedsYou;
  /** `unmeasured` omits the section; measured-empty is its own written line. */
  pages: Measured<readonly WeeklyPage[]>;
  /** In date order. `unmeasured` omits the section; measured-empty states the supply's empty line, never padded. */
  next: Measured<readonly WeeklyNext[]>;
  /** The week's dates and publish time; absent, no strip and no calm line. */
  calendar?: WeeklyCalendar;
  /** Dates in the committed week with no page planned. */
  skippedDays?: number;
  /** Spares, written where a day's page cannot be; absent or empty, no list. */
  spares?: Measured<readonly { targetQuery: string }[]>;
  /** SPEC §9: checks whose count moved since last Monday; unmeasured or absent where either week stored none. */
  issues?: Measured<readonly IssueChange[]>;
  /** D28: what ReachKit changed about the market it measures this week, each with its reason. */
  marketChanges?: readonly { readonly line: CopyKey; readonly vars: CopyVars }[];
  /** SPEC §8 (D16): tracked questions that now name the site, by search, with the answer's address. */
  nowNamed?: Measured<readonly { search: string; answerUrl: string }[]>;
}): WeeklyMail {
  const issues = a.issues === undefined ? [] : issueChangeRows(a.issues);
  const g = a.greeting;
  return {
    subject: SUBJECT,
    preheader: PREHEADER,
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
      // No page goes live until the address is connected, so it comes early, every week.
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
      // The one needs-you item: its line and the button that opens it.
      ...(a.needsYou === undefined
        ? []
        : ([
            { block: "notice", text: a.needsYou.line, ...(a.needsYou.vars === undefined ? {} : { vars: a.needsYou.vars }) },
            { block: "action", label: NEEDS_YOU_ACTION, href: a.needsYou.href, variant: "secondary" },
          ] as const)),
      { block: "paragraph", text: PACE },
      // S20's one solid button, absolute: an inbox resolves no relative path.
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
  // Told once, with nothing asked: no link and no button follow it (owner O7).
  const aside = n.setAside;
  if (aside?.n === 1) blocks.push({ block: "paragraph", text: SET_ASIDE[`${aside.replaced}`].one });
  else if (aside !== undefined && aside.n > 1) blocks.push({ block: "paragraph", text: SET_ASIDE[`${aside.replaced}`].many, vars: { n: String(aside.n) } });
  const g = n.google;
  if (g !== undefined) {
    const steps = g.early ? g.steps.filter((step) => step.name === "draft.ladder.found") : g.steps;
    blocks.push({ block: "heading", text: GOOGLE });
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
      blocks.push(visitsLine(g.visits, g.visitsBefore));
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
        { block: "paragraph", text: AI_ASKED }
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
/** This week's visits, and which way they moved from the week before where there was one. */
function visitsLine(visits: Measured<number>, before: Measured<number> | undefined): MailBlock {
  const n = formatStat(visits, "integer");
  if (before === undefined || before.kind === "unmeasured" || visits.kind === "unmeasured") return { block: "paragraph", text: VISITS, vars: { n } };
  if (visits.value === before.value) return { block: "paragraph", text: VISITS_SAME, vars: { n } };
  return { block: "paragraph", text: visits.value > before.value ? VISITS_UP : VISITS_DOWN, vars: { n, before: formatStat(before, "integer") } };
}

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

/** "This week's pages": title, promise, the strip, the first pages with why and two links, and a count leading to Plan; uncommitted omits it. */
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
    { block: "paragraph", text: NEXT_INTRO, vars: { weekPages: String(WEEK_PLAN.days) } },
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

/** `mapMeasured` over a list: unmeasured stays omitted, measured-empty keeps its written line. */
function mapMeasuredRows<A, B>(m: Measured<readonly A[]>, f: (a: readonly A[]) => readonly B[]): Measured<readonly B[]> {
  return m.kind === "unmeasured" ? m : { kind: m.kind, value: f(m.value), at: m.at };
}

/** One row per page with a verdict this week. `not_measured` and `no_week` get no row: they belong to the week, and the whole-mail line
 *  states them once (ADR-071). A page with no address is dropped, as nothing measured identifies it. */
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
    // Held by no stored search result: the row says not seen, never not indexed.
    if (page.indexState === "not_verified" && standing.verdict !== "working") {
      rows.push({ subject: PAGE_NOT_VERIFIED, subjectVars: { page: page.liveUrl }, verdict: PAGE_VERDICTS[standing.verdict] });
      continue;
    }
    rows.push({ ...subjectOf(page.liveUrl, standing), verdict: PAGE_VERDICTS[standing.verdict] });
  }
  return rows;
}

/** REQ-063 c3–c4: both raw figures, the measurement date, and the interval where the comparison is not last week's.
 *  Three keys chosen by what there is to say; without both figures it takes the plain form, never a placeholder (REQ-064 c1). */
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
    // The shared formatter, so this figure is written as a stat block writes it.
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
