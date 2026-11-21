// Settings › Your Business, as one pure function: every line, count, label and date the tab draws, from stored reads.
// The cards render only from this, so a figure stated twice is computed once and cannot disagree with itself.
import { BATTERY } from "@/lib/config/constants";
import { COUNTRIES, LANGUAGES, localeFromKey } from "@/lib/locale/locales";
import { effectiveOn } from "@/lib/market/changes/pending";
import { copy } from "@/lib/presentation/copy";
import type { BusinessItem, BusinessList, BusinessProfile } from "@/lib/site-profile/business/types";
import type { KnowledgeBase } from "@/lib/site-profile/knowledge/types";
import { formatDayDate, formatShortDay, SHELL_LOCALE } from "../_shell/format";
import type { Half, MarketFigures } from "./market-figures";
import type { SettingsModel } from "./model";
import { WRITING_VOICE_OPTIONS } from "./voice-state";

/** A line's value: words, an address, a list's first two and how many more, or the quiet unread line. */
export type LineValue =
  | { kind: "text"; text: string; full: string }
  | { kind: "address"; text: string }
  | { kind: "list"; text: string; full: string; more: string | null }
  | { kind: "empty"; text: string };

export type LineId =
  | "job" | "offering" | "products" | "audienceTerms" | "claims" | "asks"
  | "writing" | "vocabulary" | "note" | "never"
  | "domain" | "category" | "locale";

export interface Line {
  id: LineId;
  label: string;
  value: LineValue;
  /** Whether the line opens a dialog; a value ReachKit concludes alone has no Change. */
  change: boolean;
}

export interface CompetitorRow {
  domain: string;
  /** "n of m", or the not-checked word; `null` with `pending` while no scan has measured it. */
  google: string | null;
  ai: string | null;
  pending: string | null;
  /** The row's figures as one line, for the competitors dialog. */
  detail: string;
  addedByYou: boolean;
}

export interface BusinessScreen {
  read: { lines: Line[]; lastRead: string; readAt: Date | null } | null;
  voice: { lines: Line[] } | null;
  market: {
    lines: Line[];
    checked: string | null;
    next: string;
    nextAt: Date;
    /** What a website change does, dated, said before the Save. */
    domainLead: string;
    /** A saved change no pass has adopted yet, or `null`. */
    standing: string | null;
  } | null;
  competitors: {
    count: string;
    taken: number;
    full: boolean;
    rows: CompetitorRow[];
    you: { google: string; ai: string; line: string };
    foot: string;
    none: string | null;
    leaders: string | null;
  } | null;
}

export interface BusinessScreenInput {
  now: Date;
  timeZone: string;
  business: { profile: BusinessProfile; knowledge: KnowledgeBase; empty: boolean } | null;
  /** The market conclusion's kind of business, in the report's word. */
  kind: string | null;
  market: {
    settings: SettingsModel;
    searches: number | null;
    questions: number | null;
    figures: MarketFigures;
    leaders: readonly string[];
  } | null;
  voice: SettingsModel | null;
}

/** Longest a line's words run before they end on "…"; the whole text stays on the value's `title`. */
const LINE_CHARS = 28;
const SEP = " · ";

function clipped(text: string): string {
  if (text.length <= LINE_CHARS) return text;
  const cut = text.slice(0, LINE_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${(space > LINE_CHARS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const EMPTY: LineValue = { kind: "empty", text: copy("settings.line.empty") };

function textValue(text: string | null | undefined): LineValue {
  return text == null || text.trim() === "" ? EMPTY : { kind: "text", text: clipped(text), full: text };
}

function listValue(items: readonly { text: string }[] | readonly string[]): LineValue {
  const texts = items.map((item) => (typeof item === "string" ? item : item.text));
  if (texts.length === 0) return EMPTY;
  const first = texts.slice(0, 2).join(SEP);
  return {
    kind: "list",
    text: clipped(first),
    full: texts.join(SEP),
    more: texts.length > 2 ? copy("settings.line.more", { n: String(texts.length - 2) }) : null,
  };
}

const READ_LISTS: readonly { id: LineId & BusinessList; key: "settings.business.products" | "settings.business.audienceTerms" | "settings.business.claims" }[] = [
  { id: "products", key: "settings.business.products" },
  { id: "audienceTerms", key: "settings.business.audienceTerms" },
  { id: "claims", key: "settings.business.claims" },
];

function readCard(input: BusinessScreenInput): BusinessScreen["read"] {
  const business = input.business;
  if (business === null) return null;
  const { profile, knowledge } = business;
  const asked = knowledge.questions.length;
  const lines: Line[] = [
    { id: "job", label: copy("settings.business.job"), value: business.empty ? EMPTY : textValue(profile.job?.text), change: true },
    { id: "offering", label: copy("settings.business.offering"), value: textValue(input.kind ?? profile.offeringType), change: false },
    ...READ_LISTS.map(({ id, key }) => ({ id, label: copy(key), value: listValue(profile.lists[id]), change: true })),
    {
      id: "asks",
      label: copy("settings.knowledge.questions"),
      value: asked === 0 ? EMPTY : { kind: "text" as const, text: copy(asked === 1 ? "settings.business.asks.one" : "settings.business.asks.value", { n: String(asked) }), full: knowledge.questions.map((q) => q.text).join(SEP) },
      change: true,
    },
  ];
  const on = profile.readAt === null ? null : formatDayDate(profile.readAt, input.timeZone);
  const lastRead =
    on === null
      ? copy("settings.business.read-never")
      : profile.pagesRead === null
        ? copy("settings.business.read-at", { on })
        : copy("settings.business.read-line", { on, count: String(profile.pagesRead) });
  return { lines, lastRead, readAt: profile.readAt };
}

function voiceCard(input: BusinessScreenInput): BusinessScreen["voice"] {
  const settings = input.voice;
  if (settings === null) return null;
  const chosen = WRITING_VOICE_OPTIONS.find((option) => option.voice === settings.voice.writing);
  const words: readonly BusinessItem[] = input.business?.profile.lists.vocabulary ?? [];
  return {
    lines: [
      {
        id: "writing",
        label: copy("settings.voice.writing.label"),
        value: { kind: "text", text: copy(chosen?.key ?? "settings.voice.writing.unset"), full: copy(chosen?.key ?? "settings.voice.writing.unset") },
        change: true,
      },
      // Words you use is a business list; where that read failed the line says nothing was read rather than "none".
      { id: "vocabulary", label: copy("settings.business.vocabulary"), value: listValue(words), change: input.business !== null },
      { id: "note", label: copy("settings.content.voice"), value: textValue(settings.voice.text), change: true },
      { id: "never", label: copy("settings.voice.never-claim"), value: listValue(settings.doNotClaim), change: true },
    ],
  };
}

function figure(half: Half): string {
  return half === null ? copy("settings.competitors.not-measured") : copy("settings.competitors.figure", { n: String(half.n), of: String(half.of) });
}

function you(figures: MarketFigures): { google: string; ai: string; line: string } {
  const google = figure(figures.you.google);
  const ai = figure(figures.you.ai);
  return { google, ai, line: copy("settings.competitors.you.line", { google, ai }) };
}

function marketCards(input: BusinessScreenInput, nextAt: Date, nextDay: string): Pick<BusinessScreen, "market" | "competitors"> {
  const market = input.market;
  if (market === null) return { market: null, competitors: null };
  const { settings } = market;
  const taken = settings.competitors.length;
  const weekday = new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: input.timeZone, weekday: "long" }).format(nextAt);
  const change = settings.market.change;
  const standing =
    change === null || !change.saved
      ? null
      : change.kind === "category"
        ? copy("settings.market.category.not-measured-yet", { date: nextDay })
        : copy("settings.market.effectiveOn", { date: nextDay });
  const lines: Line[] = [
    { id: "domain", label: copy("settings.market.domain"), value: { kind: "address", text: settings.domain }, change: true },
    { id: "category", label: copy("settings.market.your-market"), value: textValue(settings.market.category), change: true },
  ];
  const pair = localeFromKey(settings.locale.current);
  const locale =
    pair === null
      ? null
      : copy("setup.locale.option", { country: COUNTRIES[pair.country].location, language: LANGUAGES[pair.language].name });
  lines.push({ id: "locale", label: copy("setup.locale.label"), value: textValue(locale), change: true });
  const concluded = settings.concluded;
  return {
    market: {
      lines,
      checked:
        market.searches === null || market.questions === null
          ? null
          : copy("settings.market.checked", {
              day: weekday,
              searches: String(market.searches),
              questions: String(market.questions),
              competitors: String(taken),
            }),
      next: copy("settings.market.next", { date: nextDay }),
      nextAt,
      domainLead: copy("settings.market.pending", { date: nextDay, change: copy("settings.market.change.domain") }),
      standing,
    },
    competitors: {
      count: copy("settings.competitors.count", { taken: String(taken), max: String(BATTERY.COMPETITORS_MAX) }),
      taken,
      full: taken >= BATTERY.COMPETITORS_MAX,
      rows: settings.competitors.map((domain) => {
        const figures = market.figures.cards[domain] ?? null;
        const pending = figures === null ? copy("settings.competitors.measured-from", { date: nextDay }) : null;
        const google = figures === null ? null : figure(figures.google);
        const ai = figures === null ? null : figure(figures.ai);
        return {
          domain,
          google,
          ai,
          pending,
          detail: pending ?? copy("settings.competitors.row", { google: google!, ai: ai! }),
          addedByYou: concluded === null || concluded.reasons[domain] === undefined,
        };
      }),
      you: you(market.figures),
      foot: copy(concluded?.rivalsOverridden === true ? "settings.competitors.overridden" : "settings.competitors.concluded"),
      none: taken === 0 ? copy("settings.competitors.none-yet") : null,
      leaders: market.leaders.length === 0 ? null : copy("settings.competitors.leaders", { names: market.leaders.join(", ") }),
    },
  };
}

export function businessScreen(input: BusinessScreenInput): BusinessScreen {
  // The one next check every dated line on the tab names: the product's own weekly pass, in the site's zone.
  const nextAt = effectiveOn({ savedAt: input.now, timezone: input.timeZone });
  const nextDay = formatShortDay(nextAt, input.timeZone);
  return { read: readCard(input), voice: voiceCard(input), ...marketCards(input, nextAt, nextDay) };
}
