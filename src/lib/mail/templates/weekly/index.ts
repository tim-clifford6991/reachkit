// SPEC §8 — the Monday mail tells one story in a fixed shape: the greeting, then the calm line or the critical needs-you and
// connect notices, what we did, the results, this week's pages, the pace line and one button.
// A block list only (ADR-040). The results are Overview's own tiles in their own words, a fall in words and muted ink
// like any change; the standing line sends the reader to Overview. Footer links are the caller's: each carries a token only it can sign.
// A page and an opportunity are named by their search: titles are model text, which REQ-093 keeps out (§8, ADR-012).
import { env } from "@/lib/config/env";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { Tile } from "@/lib/measure/results";
import { changeWords, ofWords, TILE_NAME, type TileFormat } from "@/lib/measure/results-words";
import type { CopyKey } from "@/lib/presentation/copy";
import { localDay } from "@/lib/scan/weekly/week";
import { formatMailDayMonth, formatMailWeekday } from "../../blocks/format";
import type { CopyVars, ListRow, MailBlock, StatRow } from "../../blocks/types";

const ACTION = "mail.weekly.action" satisfies CopyKey;
const REASON = "mail.reason.weekly" satisfies CopyKey;
const HI = "mail.weekly.hi" satisfies CopyKey;
const HI_UNNAMED = "mail.weekly.hi.unnamed" satisfies CopyKey;
const CALM = "mail.weekly.calm" satisfies CopyKey;
const NEEDS_YOU_ACTION = "mail.weekly.needsYou.action" satisfies CopyKey;
const CONNECT = "mail.weekly.connect" satisfies CopyKey;
const CONNECT_ACTION = "mail.weekly.connect.action" satisfies CopyKey;
const DID = "mail.weekly.did" satisfies CopyKey;
const DID_ITEM = { new: "mail.weekly.did.item.new", update: "mail.weekly.did.item.update" } as const satisfies Record<string, CopyKey>;
const DID_CHECKED = "mail.weekly.did.checked" satisfies CopyKey;
const SET_ASIDE = {
  replaced: { one: "mail.weekly.setAside.one", many: "mail.weekly.setAside.many" },
  unreplaced: { one: "mail.weekly.setAside.one.unreplaced", many: "mail.weekly.setAside.many.unreplaced" },
  updated: { one: "mail.weekly.setAside.one.updated", many: "mail.weekly.setAside.many.updated" },
} as const satisfies Record<string, Record<string, CopyKey>>;
const RESULTS = "mail.weekly.results" satisfies CopyKey;
const STANDING = "mail.weekly.standing" satisfies CopyKey;
const NEXT = "mail.weekly.next" satisfies CopyKey;
const NEXT_NONE = "mail.weekly.next.none" satisfies CopyKey;
const NEXT_ITEM = "mail.weekly.next.item" satisfies CopyKey;
const NEXT_WHY = "mail.weekly.next.why" satisfies CopyKey;
const NEXT_STOP = "mail.weekly.next.stop" satisfies CopyKey;
const NEXT_EDIT = "mail.weekly.next.edit" satisfies CopyKey;
const NEXT_ALL = "mail.weekly.next.all" satisfies CopyKey;
const NEXT_FEW = { one: "mail.weekly.next.few.one", many: "mail.weekly.next.few" } as const satisfies Record<string, CopyKey>;
const PACE = "mail.weekly.pace" satisfies CopyKey;
/** Visits' clicks line, in the tile's own words. */
const CLICKS = { none: "overview.tile.visits.clicks.none", one: "overview.tile.visits.clicks.one", many: "overview.tile.visits.clicks" } as const satisfies Record<string, CopyKey>;

/** The subject is the first of these that applies (owner E). */
const SUBJECT = {
  blocked: "mail.weekly.blocked.subject",
  firstPage: "mail.weekly.first-page.subject",
  firstVisit: "mail.weekly.first-visit.subject",
  firstClick: "mail.weekly.first-click.subject",
  pages: { one: "mail.weekly.pages.one.subject", many: "mail.weekly.pages.subject" },
  week: "mail.weekly.week.subject",
} as const;
const PREHEADER = {
  blocked: "mail.weekly.preheader.blocked",
  firstPage: "mail.weekly.first-page.preheader",
  firstVisit: "mail.weekly.first-visit.preheader",
  firstClick: "mail.weekly.first-click.preheader",
  week: "mail.weekly.preheader",
} as const satisfies Record<string, CopyKey>;
/** The first-ever events, in the order a subject takes them. */
const FIRSTS = ["firstPage", "firstVisit", "firstClick"] as const;

/** A page's day line, by whether it updates a page and whether it goes live today. */
const DAY_LINE = {
  new: { today: "mail.weekly.next.day.new.today", later: "mail.weekly.next.day.new" },
  update: { today: "mail.weekly.next.day.update.today", later: "mail.weekly.next.day.update" },
} as const satisfies Record<string, Record<string, CopyKey>>;

/** Each list writes out the first three and links the rest to Plan. */
const WRITTEN_OUT = 3;

/** A week planned in full: fewer is said as the pages the business can answer well, never as days without one. */
const FULL_WEEK = 7;

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

/** The mail's own date, the site's publish time as the clock writes it, and Plan's address. */
export interface WeeklyCalendar {
  readonly today: string;
  readonly time: string;
  readonly planHref: string;
}

export interface WeeklyMail {
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly subject: CopyKey;
  readonly subjectVars?: CopyVars;
  readonly preheader: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/** SPEC §8: the one critical item needing the customer this week; absent, the calm line stands instead. */
export interface WeeklyNeedsYou {
  readonly line: CopyKey;
  readonly vars?: CopyVars;
  readonly href: string;
}

/** A page that went live last week, by its search, at its live address. */
export interface WeeklyDidPage {
  readonly search: string;
  readonly liveUrl: string;
  readonly update: boolean;
}

/** What ReachKit did last week, from publication, draft and scan rows. */
export interface WeeklyDid {
  /** When the rows were read. */
  readonly at: Date;
  readonly pages: readonly WeeklyDidPage[];
  /** Pages the daily re-check set aside, and what the week's stored days say filled them; absent or 0, no line. */
  readonly setAside?: { readonly n: number; readonly arm: "updated" | "replaced" | "unreplaced" };
  /** A competitor or category ReachKit itself changed (owner G), each with its reason. */
  readonly market?: readonly { readonly line: CopyKey; readonly vars: CopyVars }[];
  /** This week's pass: Google searches read and AI questions asked; said only when no page went live. */
  readonly checked?: { readonly searches: number; readonly questions: number };
}

/** Overview's four tiles at send time, and the days their lines name. */
export interface WeeklyResults {
  readonly tiles: readonly Tile[];
  /** When the rows were read: the send. */
  readonly at: Date;
  /** `YYYY-MM-DD`: the next pass. */
  readonly due: string;
  /** `YYYY-MM-DD`: the first planned page's day; `null` where none is planned. */
  readonly goLive: string | null;
  readonly zone: string;
  /** This week's pass read the site's first page on Google's first page, ever. */
  readonly firstPage: boolean;
  /** Last week counted the site's first visit from Google, an AI app or another site, ever. */
  readonly firstVisit?: boolean;
  /** Last week counted the site's first click through to the business, ever; never while clicks are off. */
  readonly firstClick?: boolean;
}

export function buildWeekly(a: {
  /** Who the mail greets and which week of service it is. */
  greeting: { readonly name: string | null; readonly week: number; readonly business: string };
  /** The address waiting to be connected, and its line where it is not the hosted one; absent once live. */
  connect?: { readonly host: string; readonly href: string; readonly text?: CopyKey };
  /** The one critical thing waiting on the customer, where there is one. */
  needsYou?: WeeklyNeedsYou;
  /** Absent on a week that measured nothing: the whole-mail line says so once, and no number is stated. */
  did?: WeeklyDid;
  /** Absent where the week measured nothing or the tiles' rows could not be read. */
  results?: WeeklyResults;
  /** In date order. `unmeasured` omits the section; measured-empty states the supply's empty line, never padded. */
  next: Measured<readonly WeeklyNext[]>;
  /** The week's dates and publish time; absent, no calm line. */
  calendar?: WeeklyCalendar;
}): WeeklyMail {
  const g = a.greeting;
  const blocked = a.needsYou !== undefined || a.connect !== undefined;
  const first = FIRSTS.find((event) => a.results?.[event] === true);
  const subject = subjectOf(blocked, first, a.did, g);
  const measuredWeek = a.did !== undefined;
  return {
    ...subject,
    preheader: blocked ? PREHEADER.blocked : first !== undefined ? PREHEADER[first] : PREHEADER.week,
    reason: REASON,
    blocks: [
      g.name === null || g.name.trim() === ""
        ? { block: "heading", level: 1, text: HI_UNNAMED, vars: { week: String(g.week), business: g.business } }
        : { block: "heading", level: 1, text: HI, vars: { name: g.name.trim(), week: String(g.week), business: g.business } },
      // A critical week leads with why nothing goes live (owner F); otherwise the calm line.
      ...(blocked || a.calendar === undefined ? [] : [{ block: "paragraph", text: CALM, vars: { time: a.calendar.time } } as const]),
      ...(a.connect === undefined
        ? []
        : ([
            { block: "notice", text: a.connect.text ?? CONNECT, vars: { host: a.connect.host } },
            { block: "action", label: CONNECT_ACTION, href: a.connect.href, variant: "secondary" },
          ] as const)),
      ...(a.needsYou === undefined
        ? []
        : ([
            { block: "notice", text: a.needsYou.line, ...(a.needsYou.vars === undefined ? {} : { vars: a.needsYou.vars }) },
            { block: "action", label: NEEDS_YOU_ACTION, href: a.needsYou.href, variant: "secondary" },
          ] as const)),
      ...(a.did === undefined ? [] : didBlocks(a.did, a.calendar)),
      ...(a.results === undefined ? [] : resultBlocks(a.results)),
      ...(measuredWeek ? [{ block: "paragraph", text: STANDING, tone: "quiet" } as const] : []),
      ...weekBlocks(a.next, a.calendar),
      ...(measuredWeek ? [{ block: "paragraph", text: PACE, tone: "quiet" } as const] : []),
      // S20's one solid button, absolute: an inbox resolves no relative path.
      { block: "action", label: ACTION, href: new URL("/app", env.NEXT_PUBLIC_APP_URL).toString() },
      // A week that measured nothing: the standing line sits under the whole-mail line, which stands above the actions.
      ...(measuredWeek ? [] : [{ block: "paragraph", text: STANDING, tone: "quiet" } as const]),
    ],
  };
}

/** Blocked, then a first-ever event, then pages that went live last week, else the week. */
function subjectOf(blocked: boolean, first: (typeof FIRSTS)[number] | undefined, did: WeeklyDid | undefined, g: { week: number; business: string }): { subject: CopyKey; subjectVars?: CopyVars } {
  if (blocked) return { subject: SUBJECT.blocked };
  if (first !== undefined) return { subject: SUBJECT[first] };
  const live = did?.pages.filter((page) => !page.update).length ?? 0;
  if (live > 0) return live === 1 ? { subject: SUBJECT.pages.one } : { subject: SUBJECT.pages.many, subjectVars: { n: String(live) } };
  return { subject: SUBJECT.week, subjectVars: { week: String(g.week), business: g.business } };
}

/** What we did: up to three live pages and a link to the rest, the set-aside line, ReachKit's own market change, or what was checked. */
function didBlocks(did: WeeklyDid, calendar: WeeklyCalendar | undefined): readonly MailBlock[] {
  const rows: ListRow[] = did.pages.slice(0, WRITTEN_OUT).map((page) => ({
    label: DID_ITEM[page.update ? "update" : "new"],
    vars: { search: page.search },
    href: page.liveUrl,
  }));
  if (did.pages.length > WRITTEN_OUT && calendar !== undefined) {
    rows.push({ links: [{ label: NEXT_ALL, vars: { n: String(did.pages.length) }, href: calendar.planHref }] });
  }
  const lines: MailBlock[] = [];
  // Told once, with nothing asked: no link and no button follow it (owner O7).
  const aside = did.setAside;
  if (aside?.n === 1) lines.push({ block: "paragraph", text: SET_ASIDE[aside.arm].one });
  else if (aside !== undefined && aside.n > 1) lines.push({ block: "paragraph", text: SET_ASIDE[aside.arm].many, vars: { n: String(aside.n) } });
  for (const change of did.market ?? []) lines.push({ block: "paragraph", text: change.line, vars: change.vars });
  if (rows.length === 0 && did.checked !== undefined) {
    lines.push({ block: "paragraph", text: DID_CHECKED, vars: { searches: String(did.checked.searches), questions: String(did.checked.questions) } });
  }
  if (rows.length === 0 && lines.length === 0) return [];
  return [
    { block: "heading", level: 2, text: DID },
    ...(rows.length === 0 ? [] : [{ block: "list", items: measured(rows, did.at), emptyLine: DID } as const]),
    ...lines,
  ];
}

/** Overview's four tiles, each with its figure, of line and change line, and Visits' clicks through beneath. */
function resultBlocks(r: WeeklyResults): readonly MailBlock[] {
  // A change's date is an instant, read in the site's zone; the due and go-live days are already its days, held at noon UTC.
  const f: TileFormat = { count: String, date: (at) => formatMailDayMonth(localDay(at, r.zone)), day: (at) => formatMailDayMonth(at.toISOString().slice(0, 10)) };
  const dates = { due: new Date(`${r.due}T12:00:00Z`), goLive: r.goLive === null ? null : new Date(`${r.goLive}T12:00:00Z`) };
  const row = (tile: Tile): StatRow => {
    const of = ofWords(tile, f);
    const change = tile.change === null ? null : changeWords(tile.key, tile.change, dates, f);
    const lines = [change, clicksWords(tile)].filter((line) => line !== null);
    const detail = lines.length === 0 ? {} : { detail: lines };
    // Not counted yet is the tile's dash: its of line stands where the figure would.
    if (tile.n === null) return { label: TILE_NAME[tile.key], value: unmeasured("not_attempted", r.at), format: "integer", unmeasuredLine: of.text, ...(of.vars === undefined ? {} : { unmeasuredVars: of.vars }), ...detail };
    return { label: TILE_NAME[tile.key], value: measured(tile.n, r.at), format: "integer", note: of, ...detail };
  };
  const items = r.tiles.map(row);
  return items.length === 0 ? [] : [{ block: "heading", level: 2, text: RESULTS }, { block: "stats", shape: "tiles", items }];
}

/** Visits' clicks through, as Overview's tile says them: none while clicks are off or no visit was counted. */
function clicksWords(tile: Tile): { text: CopyKey; vars?: CopyVars } | null {
  const c = tile.clicks;
  if (c == null || !tile.n) return null;
  return c === 0 ? { text: CLICKS.none } : c === 1 ? { text: CLICKS.one } : { text: CLICKS.many, vars: { c: String(c) } };
}

/** "This week's pages": title, the first pages with why and two links, a link to Plan, and a short week said as such. */
function weekBlocks(next: Measured<readonly WeeklyNext[]>, calendar: WeeklyCalendar | undefined): readonly MailBlock[] {
  if (next.kind === "unmeasured") return [];
  const n = next.value.length;
  return [
    { block: "heading", level: 2, text: NEXT },
    { block: "list", items: { ...next, value: nextRows(next.value, calendar) }, emptyLine: NEXT_NONE },
    ...(n === 0 || n >= FULL_WEEK ? [] : [{ block: "paragraph", text: n === 1 ? NEXT_FEW.one : NEXT_FEW.many, vars: { n: String(n) } } as const]),
  ];
}

/** The first pages written out, each as its day, its search, why, and Stop and Edit; then one link to Plan for the rest. */
function nextRows(next: readonly WeeklyNext[], calendar: WeeklyCalendar | undefined): readonly ListRow[] {
  const shown = calendar === undefined ? next : next.slice(0, WRITTEN_OUT);
  const rows = shown.map((page): ListRow => {
    if (page.day === undefined || calendar === undefined) return { label: NEXT_ITEM, vars: { search: page.targetQuery } };
    const kind = DAY_LINE[page.update === true ? "update" : "new"];
    const today = page.day === calendar.today;
    return {
      lead: {
        text: today ? kind.today : kind.later,
        vars: { day: formatMailWeekday(page.day), time: calendar.time, ...(today ? {} : { date: formatMailDayMonth(page.day) }) },
      },
      label: NEXT_ITEM,
      vars: { search: page.targetQuery },
      ...(page.why === undefined ? {} : { detail: [{ text: NEXT_WHY, vars: { reason: page.why } }] }),
      links: [
        ...(page.stopHref === undefined ? [] : [{ label: NEXT_STOP as CopyKey, href: page.stopHref }]),
        ...(page.editHref === undefined ? [] : [{ label: NEXT_EDIT as CopyKey, href: page.editHref }]),
      ],
    };
  });
  if (shown.length === next.length || calendar === undefined) return rows;
  return [...rows, { links: [{ label: NEXT_ALL, vars: { n: String(next.length) }, href: calendar.planHref }] }];
}

/** A page by its search; with none stored, its address's last path words, never the raw URL. */
export function nameOf(search: string | null | undefined, liveUrl: string): string {
  if (search !== null && search !== undefined && search.trim() !== "") return search.trim();
  let path: string;
  try {
    path = new URL(liveUrl).pathname;
  } catch {
    return liveUrl;
  }
  const last = path.split("/").filter((part) => part !== "").at(-1);
  return last === undefined ? new URL(liveUrl).hostname : decodeURIComponent(last).replace(/[-_]+/g, " ");
}
