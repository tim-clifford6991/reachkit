// SPEC §7 *This week* — the one model This Week renders from: the head, every
// card's words and the pane each card opens, all read from the week at 0¢.
// No component writes a line, a count or a date of its own.
import type { SiteCheck } from "@/lib/site-issues/types";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { writtenDay } from "@/lib/opportunities/why";
import { needsYouLine } from "@/lib/publish/record/lines";
import { nextPublishStatement, stoppedWorkStatement } from "@/lib/presentation/stopped";
import type { PublishedPage, PublishedRead } from "@/lib/measure/published";
import type { AnswerEngine } from "@/lib/opportunities/types";
import type { CitationEntry, PageCitations } from "@/lib/generate/citations";
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
      /** A hot page's reason, drawn as the planned pane draws its own. */
      why: string | null;
      notes: string[];
      next: string | null;
      /** Said in the body's place where the body could not be read. */
      unread: string | null;
      sources: SourcesModel | null;
    }
  | { kind: "planned"; date: string; title: string; why: string | null; moved: string | null; facts: PaneFact[]; next: string | null }
  | { kind: "lines"; date: string; lines: string[] };

export interface SourceEntryModel {
  n: number | null;
  kind: "site" | "public";
  /** Its accessible name where it carries a number. */
  name: string | null;
  kindLine: string;
  url: string;
  passages: string[];
  many: string | null;
  read: string | null;
  used: string | null;
  kept: string | null;
}

/** A written page's sources, every word said: no component counts or dates one. */
export interface SourcesModel {
  summary: string | null;
  /** The swap to the list; `null` where no sentence carries a number. */
  toggle: string | null;
  /** The list's heading; `null` where the pack could not be read and the note alone is said. */
  heading: string | null;
  note: string | null;
  entries: SourceEntryModel[];
  /** Said only where a number is drawn, and on a page not live only where its go-live is promised. */
  foot: string | null;
}

export interface CardModel {
  cell: DayCell;
  day: DayKey;
  /** "Mon 23", the card's own date; "Today, Mon 23" on today's. */
  dayLabel: string;
  kind: "new" | "update" | null;
  state: DayState | null;
  title: string | null;
  titleLabel?: string;
  /** The title is a search, drawn in mono. */
  search: boolean;
  lines: string[];
  /** How many sources the page's sentences link, where they link any. */
  sources: string | null;
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
      body: `${copy("calendar.chosen.body", { n: formatCount(WEEK_PLAN.days) })} ${copy("calendar.chosen.added")} ${copy("calendar.chosen.stored")}`,
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

/** "4 Oct", a read date as the list states it. */
function dayMonth(iso: string, timeZone: string): string | null {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : formatShortDay(at, timeZone).split(" ").slice(1).join(" ");
}

function entryOf(entry: CitationEntry, timeZone: string): SourceEntryModel {
  const n = entry.n === null ? null : formatCount(entry.n);
  const read = entry.readAt === null ? null : dayMonth(entry.readAt, timeZone);
  const kept = entry.keptFrom === null ? null : dayMonth(entry.keptFrom, timeZone);
  return {
    n: entry.n,
    kind: entry.kind,
    name: n === null ? null : copy(entry.kind === "site" ? "calendar.sources.mark.site" : "calendar.sources.mark.public", { n }),
    // A market fact saved before the pack kept no title: its host names it.
    kindLine: entry.kind === "site" ? copy("calendar.sources.kind.site") : copy("calendar.sources.kind.public", { title: entry.title ?? hostOf(entry.url) ?? entry.url }),
    url: entry.url,
    passages: entry.passages,
    many: entry.many > 1 ? copy("calendar.sources.many", { k: formatCount(entry.many) }) : null,
    read: read === null ? null : copy("calendar.sources.read", { date: read }),
    used: entry.n === null ? null : entry.used === 1 ? copy("calendar.sources.used.one") : copy("calendar.sources.used", { n: formatCount(entry.used) }),
    kept: kept === null ? null : copy("calendar.sources.kept", { date: kept }),
  };
}

/** The summary, the list and the foot for a written or live page; `goesLive` is whether the pane promises its time. */
export function sourcesOf(read: PageCitations, stage: { live: boolean; goesLive: boolean }, timeZone: string): SourcesModel {
  if (read.kind === "unread") return { summary: null, toggle: null, heading: null, note: copy("calendar.sources.unread"), entries: [], foot: null };
  const { sentences, entries } = read.citations;
  const kindOf = new Map(entries.flatMap((e) => (e.n === null ? [] : [[e.n, e.kind] as const])));
  const site = sentences.filter((n) => n !== null && kindOf.get(n) === "site").length;
  const pub = sentences.filter((n) => n !== null && kindOf.get(n) === "public").length;
  const pages = entries.filter((e) => e.n !== null && e.kind === "public" && e.used > 0).length;
  const vars = { n: formatCount(sentences.length), a: formatCount(site), b: formatCount(pub), m: formatCount(pages), c: formatCount(sentences.length - site - pub) };
  const numbered = entries.filter((e) => e.n !== null).length;
  const old = read.old === null ? null : dayMonth(read.old, timeZone);
  return {
    summary: copy(pages === 1 ? "calendar.sources.summary.one-page" : "calendar.sources.summary", vars),
    toggle: numbered === 0 && entries.length === 0 ? null : copy("calendar.sources.toggle", { n: formatCount(entries.length) }),
    note: old !== null ? copy("calendar.sources.old", { date: old }) : numbered === 0 ? copy("calendar.sources.none") : null,
    heading: copy("calendar.sources.heading"),
    entries: entries.map((entry) => entryOf(entry, timeZone)),
    foot: numbered === 0 ? null : stage.live ? copy("calendar.sources.foot.live") : stage.goesLive ? copy("calendar.sources.foot.written") : null,
  };
}

function cardOf(
  cell: DayCell,
  a: {
    week: WeekModel;
    time: string | null;
    next: string;
    firstSkip: boolean;
    published: ReadonlyMap<string, PublishedPage>;
    bodies: ReadonlySet<string> | null;
    sources: ReadonlyMap<string, PageCitations>;
  }
): CardModel {
  const { week, time } = a;
  const page = cell.page;
  const state = dayStateOf(cell);
  const date = fullDate(cell.day);
  const goesOn = `${weekdayShort(cell.day)} ${dayNumber(cell.day)}`;
  const dayLabel = cell.today ? copy("calendar.card.day.today", { day: goesOn }) : goesOn;
  const spoken = cell.today ? dayLabel : cardDate(cell.day);
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
    ariaLabel: cardLabel({ cell, page, line: emptyLine ?? stateLine, date: spoken }),
    sources: null,
  };
  // A page's label names the stage its badge shows.
  const labelled = (title: string): string =>
    state === null ? base.ariaLabel : copy("calendar.card.aria.page", { date: spoken, stage: copy(DAY_STATE_COPY_KEY[state]), title });

  if (page === null) {
    const lines =
      state === "stopped" && stateLine !== null
        ? [stateLine, ...(cell.day < week.today ? [] : [copy("calendar.pane.stopped.next", { weekday: weekdayLong(cell.day) })])]
        : state === "skipped"
          ? [stateLine ?? copy("calendar.day.skipped.line")]
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

  if (page.stage === "planned" && page.state === "planned") {
    const { lines, facts } = plannedFacts(page);
    if (page.hotLine != null) lines.unshift(page.hotLine);
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
        moved: movedLine(page, cell.day),
        facts,
        // A past day promises nothing, whatever its state.
        next: time === null || cell.day < week.today ? null : copy("calendar.pane.planned.next", { time, day: goesOn }),
      },
    };
  }

  // A page still to go out promises its day only while that day is to come; a past day never says it goes live.
  const waiting = waitsToGoLive(cell, week.today);
  const ready = waiting && cell.today;
  const needsYou = needsYouLine(page.needsYou);
  const lines =
    page.stage === "live"
      ? liveLines(page.draftId === null ? undefined : a.published.get(page.draftId), week.timeZone, a.next)
      : waiting && time !== null
        ? [ready ? copy("calendar.week.today", { time }) : copy("calendar.card.goes-live", { day: goesOn, time })]
        : cell.day < week.today && (page.stage === "your_review" || page.stage === "scheduled")
          ? [copy("calendar.day.written.past.line")]
          : [];
  if (needsYou !== null) lines.push(copy(needsYou));
  if (page.hotLine != null && page.stage !== "live") lines.unshift(page.hotLine);
  // While no time can be promised, the law's own line says why the page waits.
  const held =
    page.publishAt === null || time !== null || cell.day < week.today
      ? null
      : nextPublishStatement({
          stopped: week.stopped !== null || week.held === "billing_unreadable",
          otherwise: week.held === "unpaid" || week.held === "ended" ? { tag: week.held } : { tag: "scheduled", at: formatDateTime(page.publishAt, week.timeZone) },
        }).line;
  const read = page.draftId === null ? undefined : a.sources.get(page.draftId);
  const sources = read === undefined ? null : sourcesOf(read, { live: page.stage === "live", goesLive: waiting && time !== null }, week.timeZone);
  // One count of a page's sources, the toggle's and the card's: its distinct entries.
  const count = sources?.entries.length ?? 0;
  return {
    ...base,
    sources: count === 0 ? null : count === 1 ? copy("calendar.card.sources.one") : copy("calendar.card.sources", { n: formatCount(count) }),
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
      why: page.hotLine == null ? null : page.whyLine,
      notes: [...[movedLine(page, cell.day)].filter((line) => line !== null), ...movedOut(page), ...(needsYou === null ? [] : [copy(needsYou)]), ...(held === null ? [] : [held])],
      next: waiting && time !== null ? copy("calendar.pane.written.next", { time, day: goesOn }) : null,
      unread: page.draftId !== null && a.bodies?.has(page.draftId) === true ? null : copy("calendar.pane.body.unread"),
      sources,
    },
  };
}

/** A page a hot page moved, on its new day; `null` on any other. */
function movedLine(page: PageOnDay, day: DayKey): string | null {
  const short = (on: string) => `${weekdayShort(on as DayKey)} ${dayNumber(on as DayKey)}`;
  return page.moved === undefined ? null : copy("calendar.day.moved.line", { from: short(page.moved.from), to: short(day), search: page.moved.search });
}

/** The pages a hot page pushed out of the week, each waiting for the next Monday's check. */
function movedOut(page: PageOnDay): string[] {
  const monday = (day: string) => writtenDay(addDays(day as DayKey, 7 - ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7)), true);
  return (page.movedOut ?? []).map((out) => copy("calendar.pane.moved-out", { search: out.search, day: `${weekdayShort(out.day as DayKey)} ${dayNumber(out.day as DayKey)}`, date: monday(out.day) }));
}

/** A written page still to go out, whose day is to come: the one day a go-live time is promised, on This Week and Overview alike. */
export function waitsToGoLive(cell: DayCell, today: DayKey): boolean {
  return (cell.page?.stage === "your_review" || cell.page?.stage === "scheduled") && cell.day >= today;
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
export function weekScreen(a: {
  week: WeekModel;
  head: PlanHeadFacts;
  published: PublishedRead | null;
  bodies?: ReadonlySet<string> | null;
  /** Each written page's sources, by draft. */
  sources?: ReadonlyMap<string, PageCitations>;
}): WeekScreen {
  const { week } = a;
  const time = weekGoesLive(week, a.head.publishTime);
  const next = shortDay(checkDays(a.head, week.today).next);
  const firstSkip = week.cells.find((cell) => cell.day >= week.today && dayStateOf(cell) === "skipped")?.day ?? null;
  const published = new Map((a.published?.pages ?? []).flatMap((page) => (page.draftId === undefined ? [] : [[page.draftId, page] as const])));
  const bodies = a.bodies === undefined ? new Set(writtenDrafts(week)) : a.bodies;
  const cards = [...week.cells]
    .sort((x, y) => x.day.localeCompare(y.day))
    .map((cell) => cardOf(cell, { week, time, next, firstSkip: cell.day === firstSkip, published, bodies, sources: a.sources ?? new Map() }));
  const today = cards.find((card) => card.day === week.today);
  const written = cards.find((card) => card.day >= week.today && card.pane.kind === "page");
  const live = [...cards].reverse().find((card) => card.day < week.today && card.state === "live");
  return {
    head: headOf(a.head, week),
    cards,
    opensOn: (today?.cell.page != null ? today : (written ?? live))?.day ?? week.today,
  };
}
