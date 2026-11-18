// SPEC §4 *The three totals* — times AI mentioned the site, Google searches a
// page ReachKit published has shown up for, and pages published, each counted
// "so far" from stored rows, so a total can only stay or rise. Overview and the
// Monday mail read the same function. Pure: rows in, totals out.
import { hidesOwnPage } from "@/lib/market/rivals/domains";
import { addressOf } from "./page-reading";

/** Google's first ten pages of results: the deepest place a search counts at. */
export const TOTALS_DEPTH = 100;

/** One weekly pass, as its stored report's members came back. */
export interface TotalsPass {
  weekStart: string;
  /** When the pass ran. */
  at: string;
  /** No health check failed on it (§6 *Every pass checks its own health*). */
  healthy: boolean;
  prompts: unknown;
  questions: unknown;
  serps: unknown;
  pageQuestions: unknown;
  ownRankedRows: unknown;
}

/** One publication, published at least once. */
export interface TotalsPage {
  id: string;
  liveUrl: string | null;
  publishedAt: string;
  unpublishedAt: string | null;
  /** The site-local Monday of `publishedAt`. */
  weekStart: string;
}

/** One total's figure and its one state line. */
export type Total =
  | { kind: "due" }
  | { kind: "first"; total: number; week: string }
  | { kind: "added"; total: number; n: number }
  | { kind: "flat"; total: number }
  | { kind: "unread"; total: number };

export interface Totals {
  ai: Total;
  google: Total;
  pages: Total;
}

type Row = Record<string, unknown>;
const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter((v): v is Row => typeof v === "object" && v !== null) : []);
const valueOf = (value: unknown): unknown => (value as Row | null)?.kind === "unmeasured" ? null : (value as Row | null)?.value;
const searchKey = (query: string): string => query.trim().toLowerCase().replace(/\s+/g, " ");

/** Unbranded answers that mention or link the site; `null` where the pass asked no prompts. */
export function aiMentionsOf(prompts: unknown): number | null {
  const section = prompts as Row | null;
  if (section === null || typeof section !== "object" || !Array.isArray(section.answers)) return null;
  const kinds = new Map(rowsOf(section.asked).map((prompt) => [prompt.id, prompt.kind]));
  return rowsOf(section.answers).filter((answer) => {
    const kind = kinds.get(answer.promptId);
    return kind !== undefined && kind !== "branded" && (answer.named === true || answer.linked === true);
  }).length;
}

/** The searches on which one of `addresses` was read at 1–100 in this pass. */
export function googleSearchesOf(pass: TotalsPass, addresses: ReadonlySet<string>): Set<string> {
  const found = new Set<string>();
  const add = (query: unknown, hits: unknown): void => {
    if (typeof query !== "string") return;
    for (const hit of rowsOf(hits)) {
      const at = hit.position;
      if (typeof hit.url === "string" && typeof at === "number" && at >= 1 && at <= TOTALS_DEPTH && addresses.has(addressOf(hit.url))) found.add(searchKey(query));
    }
  };
  const serps = Array.isArray(pass.serps) ? pass.serps : [];
  rowsOf(valueOf(pass.questions)).forEach((question, i) => add((question.search as Row | undefined)?.keyword, (valueOf(serps[i]) as Row | null)?.organic));
  for (const row of rowsOf((pass.pageQuestions as Row | null)?.rows)) add((row.question as Row | undefined)?.search, row.organic);
  for (const row of rowsOf(pass.ownRankedRows)) add(row.keyword, [row]);
  return found;
}

/** Whether a pass read a result behind a Google redirect that may be one of the site's pages: its week is not counted. */
function hidesOwn(pass: TotalsPass, own: string): boolean {
  const serps = (Array.isArray(pass.serps) ? pass.serps : []).map((serp) => (valueOf(serp) as Row | null)?.organic);
  return [...serps, ...rowsOf((pass.pageQuestions as Row | null)?.rows).map((row) => row.organic)].some((rows) => hidesOwnPage(rowsOf(rows), own));
}

function live(pages: readonly TotalsPage[], at: string): Set<string> {
  const t = Date.parse(at);
  return new Set(
    pages
      .filter((page) => page.liveUrl !== null && Date.parse(page.publishedAt) <= t && (page.unpublishedAt === null || Date.parse(page.unpublishedAt) > t))
      .map((page) => addressOf(page.liveUrl!))
  );
}

/** A running total over weeks, oldest first; `null` adds nothing that week. */
function stateOf(adds: readonly { week: string; n: number | null }[], unread: boolean): Total {
  const first = adds.findIndex((add) => add.n !== null);
  if (first === -1) return { kind: "due" };
  const total = adds.reduce((sum, add) => sum + (add.n ?? 0), 0);
  const last = adds.at(-1)!;
  if (first === adds.length - 1) return { kind: "first", total, week: last.week };
  if (last.n === null) return unread ? { kind: "unread", total } : { kind: "flat", total };
  return last.n > 0 ? { kind: "added", total, n: last.n } : { kind: "flat", total };
}

/** The three totals as they stood at the end of `week`, a site-local Monday. */
export function totalsOf(a: { passes: readonly TotalsPass[]; pages: readonly TotalsPage[]; week: string }): Totals {
  const passes = a.passes.filter((pass) => pass.weekStart <= a.week).sort((x, y) => x.weekStart.localeCompare(y.weekStart));

  const ai = passes.map((pass) => ({ week: pass.weekStart, n: pass.healthy ? aiMentionsOf(pass.prompts) : null }));

  const seen = new Set<string>();
  const google = passes.map((pass) => {
    const addresses = live(a.pages, pass.at);
    if (addresses.size === 0 || hidesOwn(pass, [...addresses][0]!)) return { week: pass.weekStart, n: null };
    const before = seen.size;
    for (const search of googleSearchesOf(pass, addresses)) seen.add(search);
    return { week: pass.weekStart, n: seen.size - before };
  });

  // Each address counts once, from the week it first went live.
  const firstWeek = new Map<string, string>();
  for (const page of a.pages) {
    if (page.weekStart > a.week) continue;
    const key = page.liveUrl === null ? `#${page.id}` : addressOf(page.liveUrl);
    const held = firstWeek.get(key);
    if (held === undefined || page.weekStart < held) firstWeek.set(key, page.weekStart);
  }
  const weeks = [...new Set(firstWeek.values())].sort();
  const pages = weeks.map((week) => ({ week, n: [...firstWeek.values()].filter((w) => w === week).length }));
  if (pages.length > 0 && weeks.at(-1) !== a.week) pages.push({ week: a.week, n: 0 });

  return { ai: stateOf(ai, true), google: stateOf(google, false), pages: stateOf(pages, false) };
}
