// SPEC §7 *Two pools of facts*: every outside page read is dated from its own markup, a visible line, its address or
// the SERP that found it, at 0¢. A date is read, never guessed: a future date, and a modified date before the published
// one, are dropped, and the HTTP `Last-Modified` header is never read, because a CDN stamps it at render time.
import { parse } from "node-html-parser";
import { LANGUAGE_PACKS } from "@/lib/locale/language";
import { LANGUAGES } from "@/lib/locale/locales";
import { visibleText } from "@/lib/measure/parse";

/** Where a page's date was read, in the order the sources are tried. */
export type DatedBy = "jsonld" | "meta" | "visible" | "time" | "url" | "serp";

/** A page's own dates, as days (`YYYY-MM-DD`). */
export interface PageDates {
  publishedAt?: string;
  modifiedAt?: string;
  datedBy?: DatedBy;
}

/** A claim's dates: its page's, whether its date matters (`dated`) or not (`evergreen`), and the day or year it is aged by. */
export interface ClaimDates extends PageDates {
  timeliness?: "evergreen" | "dated";
  ageAt?: string;
}

const NODE_TYPES = new Set(["article", "blogposting", "newsarticle", "report", "webpage"]);
const PUBLISHED_NAMES = new Set(["article:published_time", "datepublished", "date", "pubdate", "publish-date", "og:published_time"]);
const MODIFIED_NAMES = new Set(["article:modified_time", "og:updated_time", "datemodified"]);

/** The day a stated date names: its own `YYYY-MM-DD` where it leads with one, so a time zone never moves the day. */
const day = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const lead = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (lead !== null) return iso(Number(lead[1]), Number(lead[2]), Number(lead[3]));
  const at = new Date(value.trim());
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString().slice(0, 10);
};

/** A real calendar day, or none: 31 February is no date. */
function iso(year: number, month: number, date: number): string | undefined {
  const at = new Date(Date.UTC(year, month - 1, date));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === date ? at.toISOString().slice(0, 10) : undefined;
}

/** The JSON-LD nodes of a page, `@graph` and arrays opened. */
function ldNodes(root: ReturnType<typeof parse>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === "object") {
      out.push(node as Record<string, unknown>);
      walk((node as { "@graph"?: unknown })["@graph"]);
    }
  };
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(script.textContent));
    } catch {
      // A broken block states nothing.
    }
  }
  return out;
}

const typed = (node: Record<string, unknown>): boolean => [node["@type"]].flat().some((type) => typeof type === "string" && NODE_TYPES.has(type.toLowerCase()));

/** Every supported language's month names, long and short, lower case, to the month's number. */
const MONTHS: ReadonlyMap<string, number> = new Map(
  Object.keys(LANGUAGES).flatMap((language) =>
    (["long", "short"] as const).flatMap((month) =>
      Array.from({ length: 12 }, (_, at) => [new Intl.DateTimeFormat(language, { month, timeZone: "UTC" }).format(Date.UTC(2000, at, 15)).toLowerCase().replace(/\.$/, ""), at + 1] as const)
    )
  )
);
const MONTH = [...MONTHS.keys()].sort((a, b) => b.length - a.length).join("|");
const DATE_TEXT = `(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{4}|(?:${MONTH})\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\.?\\s+(?:${MONTH})\\.?,?\\s+\\d{4})`;


/** A date as a line of text writes it: ISO, `22.07.2025`, `July 22, 2025` or `22 July 2025`. */
function textDay(text: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return day(text);
  const dotted = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/.exec(text);
  if (dotted !== null) return iso(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  const words = text.toLowerCase().replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
  const month = words.map((word) => MONTHS.get(word)).find((at) => at !== undefined);
  const [date, year] = words.filter((word) => /^\d+$/.test(word)).map(Number);
  return month === undefined || date === undefined || year === undefined ? undefined : iso(year, month, date);
}

/** A visible "Updated" or "Published" line in the first quarter of the page's text, in any supported language. */
function visibleDates(html: string): PageDates {
  const text = visibleText(html);
  const head = text.slice(0, Math.ceil(text.length / 4));
  const read = (words: string): string | undefined => {
    const found = new RegExp(`(?<![\\p{L}])(?:${words})(?![\\p{L}])\\s*(?:on|am|:)?\\s*:?\\s*${DATE_TEXT}`, "iu").exec(head);
    return found?.[1] === undefined ? undefined : textDay(found[1]);
  };
  return { publishedAt: read(LANGUAGE_PACKS.map((pack) => pack.datedLines.published).join("|")), modifiedAt: read(LANGUAGE_PACKS.map((pack) => pack.datedLines.updated).join("|")) };
}

/**
 * The page's dates: the first source that states a past date wins, and names itself in `datedBy`. JSON-LD on an article
 * or web page node, then the meta tags, then a visible line, then `<time datetime>`, then a `/2025/07/22/` address, then
 * the SERP's own date for the result.
 */
export function datedOf(html: string, a: { url: string; readAt: Date; serp?: string }): PageDates {
  const root = parse(html);
  const nodes = ldNodes(root).filter(typed);
  const named = (names: ReadonlySet<string>) =>
    root.querySelectorAll("meta[content]").find((meta) => names.has((meta.getAttribute("property") ?? meta.getAttribute("name") ?? meta.getAttribute("itemprop") ?? "").toLowerCase()))?.getAttribute("content");
  const path = /\/((?:19|20)\d{2})\/(\d{2})\/(\d{2})(?:\/|$)/.exec(new URL(a.url, "https://x.invalid").pathname);
  const sources: [DatedBy, () => PageDates][] = [
    ["jsonld", () => ({ publishedAt: day(nodes.find((node) => day(node.datePublished))?.datePublished), modifiedAt: day(nodes.find((node) => day(node.dateModified))?.dateModified) })],
    ["meta", () => ({ publishedAt: day(named(PUBLISHED_NAMES)), modifiedAt: day(named(MODIFIED_NAMES)) })],
    ["visible", () => visibleDates(html)],
    ["time", () => ({ publishedAt: day(root.querySelector("time[datetime]")?.getAttribute("datetime")) })],
    ["url", () => ({ publishedAt: path === null ? undefined : iso(Number(path[1]), Number(path[2]), Number(path[3])) })],
    ["serp", () => ({ publishedAt: day(a.serp) })],
  ];
  const latest = a.readAt.toISOString().slice(0, 10);
  for (const [by, read] of sources) {
    const { publishedAt, modifiedAt } = read();
    const published = publishedAt !== undefined && publishedAt <= latest ? publishedAt : undefined;
    const modified = modifiedAt !== undefined && modifiedAt <= latest && (published === undefined || modifiedAt >= published) ? modifiedAt : undefined;
    if (published !== undefined || modified !== undefined) return { ...(published === undefined ? {} : { publishedAt: published }), ...(modified === undefined ? {} : { modifiedAt: modified }), datedBy: by };
  }
  return {};
}

/** Only the date fields of a page or claim, none left `undefined`. */
export function datesOf(from: ClaimDates): ClaimDates {
  const out: ClaimDates = {};
  for (const key of ["publishedAt", "modifiedAt", "datedBy", "timeliness", "ageAt"] as const) if (from[key] !== undefined) Object.assign(out, { [key]: from[key] });
  return out;
}
