// SPEC §7 *This week* — the one model This Week renders from: the head, every
// card's words and the pane each card opens, all read from the week at 0¢.
// No component writes a line, a count or a date of its own.
import type { SiteCheck } from "@/lib/site-issues/types";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { needsYouLine } from "@/lib/publish/record/lines";
import { nextPublishStatement, stoppedWorkStatement } from "@/lib/presentation/stopped";
import type { PublishedPage, PublishedRead } from "@/lib/measure/published";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { formatCount, formatDate, formatDateTime, formatShortDay, formatTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { cardLineFor, stateLineOf } from "./DayCard";
import { cardLabel } from "./card-lines";
import { CHANGE_COPY_KEY } from "./change-line";
import { addDays, cardDate, dayNumber, fullDate, weekdayShort, type DayKey } from "./dates";
import { EMPTY_ACCOUNT_COPY_KEY, HELD_BY_SETTING_COPY_KEY, isLawCause, isSupplyCause, stopForEmptyDay, type OneLineCause } from "./empty";
import { dayStateOf, pagesThisWeek, type DayCell, type PageOnDay, type WeekModel } from "./month";
import type { PlanHeadFacts } from "./provider";
import { DAY_STATE_COPY_KEY, type DayState } from "./stages";
import { weekGoesLive } from "./WeekCard";

export interface ScreenHead {
  eyebrow: string;
  title: string;
  /** The commit's pages the title counts. */
  pages: number;
  /** Chosen, go-live time and next check; `null` before anything can be dated. */
  line: string | null;
  /** Stated in place of the go-live clause while publishing is paused. */
  paused: string | null;
  /** The line names the time the week's pages go live. */
  timed: boolean;
  foot: ScreenFoot;
}

export interface ScreenFoot {
  next: string;
  title: string;
  body: string;
}

export interface PaneFact {
  label: string;
  value: string;
  mono?: boolean;
}

export type PaneModel =
  | {
      kind: "page";
      draftId: string;
      date: string;
      host: string | null;
      title: string;
      titleLabel?: string;
      becameUpdate: string | null;
      notes: string[];
      next: string | null;
      /** Said in the body's place where the body could not be read. */
      unread: string | null;
    }
  | { kind: "planned"; date: string; title: string; why: string | null; facts: PaneFact[]; next: string | null }
  | { kind: "lines"; date: string; lines: string[] };

export interface CardModel {
  cell: DayCell;
  day: DayKey;
  /** "Mon 23", the card's own date. */
  dayLabel: string;
  kind: "new" | "update" | null;
  state: DayState | null;
  title: string | null;
  titleLabel?: string;
  /** The title is a search, drawn in mono. */
  search: boolean;
  lines: string[];
  /** The day's own state sentence: now an update, stopped, nothing worth writing. */
  stateLine: string | null;
  /** The quiet two words a day with no page says, where it says them. */
  emptyLine: string | null;
  fix: SiteCheck | null;
  ariaLabel: string;
  pane: PaneModel;
}

export interface WeekScreen {
  head: ScreenHead;
  cards: CardModel[];
  /** The card the pane opens on when the address names none. */
  opensOn: DayKey | null;
}

/** "Mon 23 Nov" for a site-local day. */
function shortDay(day: DayKey): string {
  return formatShortDay(new Date(`${day}T12:00:00.000Z`), "UTC");
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function weekdayLong(day: DayKey): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${day}T12:00:00.000Z`));
}

/** When the week was chosen and when it is checked next, in the site's own week: chosen is the last weekly check (the
 *  setup pass's day before the first), never after today; the next check is today on a Monday whose check has not run. */
export function checkDays(facts: PlanHeadFacts, today: DayKey): { chosen: DayKey | null; next: DayKey } {
  const ran = facts.lastCheck ?? facts.setupDay;
  return {
    chosen: ran === null ? null : ran > today ? today : ran,
    next: today === facts.weekStart && facts.lastCheck !== facts.weekStart ? today : addDays(facts.weekStart, 7),
  };
}

export function headOf(facts: PlanHeadFacts, week: WeekModel): ScreenHead {
  const pages = pagesThisWeek(week);
  const time = weekGoesLive(week, facts.publishTime);
  const check = checkDays(facts, week.today);
  const next = shortDay(check.next);
  const chosen = check.chosen === null ? null : shortDay(check.chosen);
  return {
    eyebrow: facts.week === null ? copy("shell.nav.plan") : copy("calendar.eyebrow", { n: formatCount(facts.week) }),
    title: pages === 0 ? copy("calendar.title.none") : pages === 1 ? copy("calendar.title.one") : copy("calendar.title", { n: formatCount(pages) }),
    pages,
    line:
      chosen === null
        ? pages === 0
          ? copy("calendar.first-week")
          : copy("calendar.head.undated")
        : time === null
          ? copy("calendar.head.line.held", { date: chosen, next })
          : copy("calendar.head.line", { date: chosen, time, next }),
    paused: week.held === "publishing_off" ? copy("calendar.head.paused") : null,
    timed: chosen !== null && time !== null,
    foot: {
      next: copy("calendar.next", { date: next, n: formatCount(WEEK_PLAN.days) }),
      title: copy("calendar.chosen.title"),
      body: `${copy("calendar.chosen.body", { n: formatCount(WEEK_PLAN.days) })} ${copy("calendar.chosen.stored")}`,
    },
  };
}

/** Where a live page stands this week, from its stored reading; else since when it is live. */
function liveLines(published: PublishedPage | undefined, timeZone: string, next: string): string[] {
  if (published === undefined) return [];
  const reading = published.reading;
  const out: string[] = [];
  if (reading?.place != null) {
    const n = formatCount(Math.round(reading.place.value));
    const up = reading.first === null ? 0 : reading.first.place - Math.round(reading.place.value);
    out.push(
      up > 0 && reading.first !== null
        ? copy("calendar.card.place", { n, k: formatCount(up), date: formatShortDay(new Date(reading.first.at), timeZone) })
        : copy("calendar.card.place.now", { n })
    );
  } else {
    out.push(copy("calendar.card.live", { date: formatShortDay(published.publishedAt, timeZone), next }));
  }
  const engines = (reading?.linkedBy ?? []).flatMap((engine) => {
    const key = ENGINE_LABEL[engine as AnswerEngine];
    return key === undefined ? [] : [copy(key)];
  });
  if (engines.length > 0) out.push(copy("calendar.card.linked", { engine: engines.join(", ") }));
  return out;
}

/** What a page waiting for its day knows of its search: demand, the best competitor, the customer's own place. */
function plannedFacts(page: PageOnDay): { lines: string[]; facts: PaneFact[] } {
  const lines: string[] = [];
  const facts: PaneFact[] = [{ label: copy("calendar.pane.searched"), value: page.why.search || page.title, mono: true }];
  const volume = page.why.volume;
  if (volume.kind !== "unmeasured") {
    const n = formatCount(volume.value);
    lines.push(copy("calendar.card.volume", { n }));
    facts.push({ label: copy("calendar.why.volume"), value: copy("calendar.why.volume.value", { count: n }) });
  }
  const rival = page.why.bestRival;
  if (rival !== null && rival.position.kind === "measured") {
    const rivalLine = copy("calendar.card.rival.place", { domain: rival.domain, n: formatCount(rival.position.value) });
    lines.push(rivalLine);
    facts.push({ label: copy("calendar.why.answered-today-by"), value: rivalLine });
  }
  const yours = page.why.youStand;
  if (page.update && yours !== null && yours.kind !== "unmeasured" && yours.value > 0) {
    const n = formatCount(yours.value);
    lines.push(copy("calendar.card.yours", { n }));
    facts.push({ label: copy("calendar.pane.yours"), value: copy("calendar.card.place.now", { n }) });
  }
  return { lines, facts };
}

/** A day with no page, in full: its own account, or the three lines a stop by ReachKit owes. */
function emptyAccount(cell: DayCell, week: WeekModel): string[] {
  const empty = cell.empty;
  if (empty === null) return cell.horizonMarker ? [writtenLine("calendar.horizon.marker")].filter((line) => line !== null) : [];
  if (isLawCause(empty.cause)) {
    const law = stoppedWorkStatement(stopForEmptyDay({ stop: week.stopped, since: new Date(`${cell.day}T00:00:00.000Z`) }), {
      formatDate: (on) => formatDate(on, week.timeZone),
    });
    return [law.line, law.needsLine, law.resumesLine];
  }
  if (isSupplyCause(empty.cause)) return [];
  const line =
    empty.cause === "customer_change_holds_pages"
      ? writtenLine(HELD_BY_SETTING_COPY_KEY[empty.setting])
      : empty.cause === "change_holds_generation"
        ? empty.because === "category"
          ? writtenLine("calendar.empty.change-holds-pages.category")
          : writtenLine(EMPTY_ACCOUNT_COPY_KEY.change_holds_generation, { change: copy(CHANGE_COPY_KEY[empty.because]), date: formatDate(empty.resumesOn, week.timeZone) })
        : writtenLine(EMPTY_ACCOUNT_COPY_KEY[empty.cause as OneLineCause]);
  return line === null ? [] : [line];
}

function cardOf(
  cell: DayCell,
  a: { week: WeekModel; time: string | null; next: string; firstSkip: boolean; published: ReadonlyMap<string, PublishedPage>; bodies: ReadonlySet<string> | null }
): CardModel {
  const { week, time } = a;
  const page = cell.page;
  const state = dayStateOf(cell);
  const date = fullDate(cell.day);
  const dayLabel = `${weekdayShort(cell.day)} ${dayNumber(cell.day)}`;
  const stateLine = stateLineOf(cell, a.firstSkip);
  // A stopped or skipped day's own sentence says it; its two words would repeat the badge.
  const emptyLine = stateLine !== null && (state === "stopped" || state === "skipped") ? null : cardLineFor(cell, "all");
  const base = {
    cell,
    day: cell.day,
    dayLabel,
    state,
    stateLine,
    emptyLine,
    fix: emptyLine !== null && cell.empty?.cause === "instruction" ? cell.empty.check : null,
    ariaLabel: cardLabel({ cell, page, line: emptyLine }),
  };
  // A page's label names the stage its badge shows.
  const labelled = (title: string): string =>
    state === null ? base.ariaLabel : copy("calendar.card.aria.page", { date: cardDate(cell.day), stage: copy(DAY_STATE_COPY_KEY[state]), title });

  if (page === null) {
    const lines =
      state === "stopped" && stateLine !== null
        ? [stateLine, ...(cell.day < week.today ? [] : [copy("calendar.pane.stopped.next", { weekday: weekdayLong(cell.day) })])]
        : state === "skipped"
          ? [copy("calendar.day.skipped.line")]
          : emptyAccount(cell, week);
    return { ...base, kind: null, title: null, search: false, lines: [], pane: { kind: "lines", date, lines } };
  }

  const kind = page.update ? "update" : "new";
  if (state === "writing") {
    const started = page.startedAt == null ? null : formatTime(page.startedAt, week.timeZone);
    const lines = started === null ? [] : [copy("calendar.day.writing.line", { time: started })];
    const pane = started === null ? copy("calendar.day.writing") : copy("calendar.pane.writing", { time: started });
    const title = page.why.search || page.title;
    return { ...base, ariaLabel: labelled(title), kind, title, search: true, lines, pane: { kind: "lines", date, lines: [pane] } };
  }

  const goesOn = `${weekdayShort(cell.day)} ${dayNumber(cell.day)}`;
  if (page.stage === "planned" && page.state === "planned") {
    const { lines, facts } = plannedFacts(page);
    return {
      ...base,
      ariaLabel: labelled(page.why.search || page.title),
      kind,
      title: page.why.search || page.title,
      search: true,
      lines,
      pane: {
        kind: "planned",
        date,
        title: copy("calendar.pane.planned.title", { search: page.why.search || page.title }),
        why: page.whyLine,
        facts,
        // A past day promises nothing, whatever its state.
        next: time === null || cell.day < week.today ? null : copy("calendar.pane.planned.next", { time, day: goesOn }),
      },
    };
  }

  // A page still to go out promises its day only while that day is to come; a past day never says it goes live.
  const waiting = (page.stage === "your_review" || page.stage === "scheduled") && cell.day >= week.today;
  const ready = waiting && cell.today;
  const needsYou = needsYouLine(page.needsYou);
  const lines =
    page.stage === "live"
      ? liveLines(page.draftId === null ? undefined : a.published.get(page.draftId), week.timeZone, a.next)
      : waiting && time !== null
        ? [ready ? copy("calendar.week.today", { time }) : copy("calendar.card.goes-live", { day: goesOn, time })]
        : [];
  if (needsYou !== null) lines.push(copy(needsYou));
  // While no time can be promised, the law's own line says why the page waits.
  const held =
    page.publishAt === null || time !== null || cell.day < week.today
      ? null
      : nextPublishStatement({
          stopped: week.stopped !== null || week.held === "billing_unreadable",
          otherwise: week.held === "unpaid" || week.held === "ended" ? { tag: week.held } : { tag: "scheduled", at: formatDateTime(page.publishAt, week.timeZone) },
        }).line;
  return {
    ...base,
    ariaLabel: labelled(page.title),
    kind,
    title: page.title,
    ...(page.titleLabel === undefined ? {} : { titleLabel: page.titleLabel }),
    search: false,
    lines,
    pane: {
      kind: "page",
      draftId: page.draftId ?? "",
      date,
      host: page.liveUrl === null ? null : hostOf(page.liveUrl),
      title: page.title,
      ...(page.titleLabel === undefined ? {} : { titleLabel: page.titleLabel }),
      becameUpdate: page.becameUpdate === true ? copy("calendar.day.became-update.line") : null,
      notes: [...(needsYou === null ? [] : [copy(needsYou)]), ...(held === null ? [] : [held])],
      next: waiting && time !== null ? copy("calendar.pane.written.next", { time, day: goesOn }) : null,
      unread: page.draftId !== null && a.bodies?.has(page.draftId) === true ? null : copy("calendar.pane.body.unread"),
    },
  };
}

/** The drafts whose body the pane draws: a page written or live, never one still planned or being written. */
export function writtenDrafts(week: WeekModel): string[] {
  return week.cells.flatMap((cell) => {
    const page = cell.page;
    return page === null || page.draftId === null || page.state === "generating" || page.state === "planned" ? [] : [page.draftId];
  });
}

/** The whole screen: head, one card a day in date order, and which card the pane opens on. `bodies` holds the drafts
 *  whose body was read, `null` where the read failed. */
export function weekScreen(a: { week: WeekModel; head: PlanHeadFacts; published: PublishedRead | null; bodies?: ReadonlySet<string> | null }): WeekScreen {
  const { week } = a;
  const time = weekGoesLive(week, a.head.publishTime);
  const next = shortDay(checkDays(a.head, week.today).next);
  const firstSkip = week.cells.find((cell) => dayStateOf(cell) === "skipped")?.day ?? null;
  const published = new Map((a.published?.pages ?? []).flatMap((page) => (page.draftId === undefined ? [] : [[page.draftId, page] as const])));
  const bodies = a.bodies === undefined ? new Set(writtenDrafts(week)) : a.bodies;
  const cards = [...week.cells]
    .sort((x, y) => x.day.localeCompare(y.day))
    .map((cell) => cardOf(cell, { week, time, next, firstSkip: cell.day === firstSkip, published, bodies }));
  const today = cards.find((card) => card.day === week.today);
  const written = cards.find((card) => card.day >= week.today && card.pane.kind === "page");
  return {
    head: headOf(a.head, week),
    cards,
    opensOn: (today?.cell.page != null ? today : (written ?? cards[0]))?.day ?? null,
  };
}
