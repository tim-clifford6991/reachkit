// SPEC §7 (2026-09-29, *Two pools of facts*; issue 1135) — what code holds a
// finished body to once the market pool exists.
//
// **The sources list is written by code, never by the model.** A market fact
// is cited inline, as a link beside the sentence that uses it; the page then
// ends with a *Sources* list naming every such page, with the date it was
// read. It is built from the links the body carries and the facts the brief
// chose, so it cannot name a page the body does not cite or miss one it does.
//
// **A table never ships with an empty cell** (owner, 2026-10-02, round 1:
// "we need a clear way to generate such tables ensuring all information is
// filled and not ignored"). The research step reads each product's own
// pricing and feature pages and retries once; what still cannot be read is
// left out here rather than printed as "not stated": the product, or the
// criterion, with the largest share of empty cells is taken out until none
// is left. A price line that mixes currencies with no conversion stated
// anywhere on the page is taken out the same way — nothing here converts,
// because no rate is a fact in either pool.
//
// Both are pure passes over the body's Markdown, in the grammar the one
// renderer parses.
import { copy } from "@/lib/presentation/copy";
import { urlKey } from "../links/select";
import { linksOf, renderOf } from "../rules/text";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export interface CitedSource {
  url: string;
  title: string;
  readAt: Date;
}

function safeLabel(label: string): string {
  const text = label.replace(/[[\]|]/g, "").replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
}

function safeHref(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");
}

const HEADING_RE = /^[ \t]*#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/;

/** The body without a sources section — the model's, or an earlier call's. */
function withoutSources(markdown: string): string {
  const heading = copy("body.sources.heading").toLowerCase();
  const lines = markdown.split("\n");
  const at = lines.findIndex((line) => HEADING_RE.exec(line)?.[1]?.trim().toLowerCase() === heading);
  if (at === -1) return markdown;
  const next = lines.findIndex((line, index) => index > at && HEADING_RE.test(line));
  return [...lines.slice(0, at), ...(next === -1 ? [] : lines.slice(next))].join("\n");
}

/**
 * The body, ending with the list of the market pages it cites. Idempotent:
 * a body that already ends with the list is given the same one again, so it
 * can be re-run after a repair moved a citation. A body that cites no market
 * page gets no list.
 */
export function withSources(markdown: string, sources: readonly CitedSource[]): string {
  const body = withoutSources(markdown).replace(/\s+$/, "");
  const linked = new Set(linksOf(body).map(urlKey));
  const cited: CitedSource[] = [];
  for (const source of sources) {
    const key = urlKey(source.url);
    if (key === null || !linked.has(key) || cited.some((held) => urlKey(held.url) === key)) continue;
    cited.push(source);
  }
  if (cited.length === 0) return body === markdown.replace(/\s+$/, "") ? markdown : `${body}\n`;
  const items = cited.map(
    (source) =>
      `- [${safeLabel(source.title)}](${safeHref(source.url)}), ${copy("body.sources.read", { date: DAY.format(source.readAt) })}`
  );
  return `${body}\n\n## ${copy("body.sources.heading")}\n\n${items.join("\n")}\n`;
}

// ── Tables ──────────────────────────────────────────────────────────────

const ROW_RE = /^[ \t]*\|.*\|[ \t]*$/;
const DELIMITER_RE = /^[ \t]*\|(?:[ \t]*:?-{1,}:?[ \t]*\|)+[ \t]*$/;

/** What a writer says of a value it was not handed: that no fact states,
 *  lists, links or carries it. Round 2 (issue 1250) met the owner's round-1
 *  "not stated" again as "not linked to a stated figure" and "not carried by
 *  a linked market fact here", so the words are held as a family, with or
 *  without one word between ("not publicly listed"). */
const MISSING =
  "stated|listed|specified|disclosed|available|published|mentioned|provided|given|linked|carried|found|known|shown|sourced|cited|confirmed|verified|reported|documented|public|clear";
const MISSING_NOUN = "figures?|prices?|pricing|costs?|rates?|numbers?|data|information|details?|sources?|facts?";

/** What a writer puts in a cell it has nothing for. */
const EMPTY_CELL_RE = new RegExp(
  [
    String.raw`^(?:|[-–—?]+|none stated|tbd|tbc|varies(?: by plan)?)\.?$`,
    String.raw`\b(?:n\/a|unknown|unclear|un(?:stated|disclosed|specified|published|listed|verified|confirmed))\b`,
    String.raw`^na\.?$`,
    String.raw`\bnot (?:\w+ )?(?:${MISSING})\b`,
    String.raw`\bno (?:${MISSING}) (?:${MISSING_NOUN})\b`,
    String.raw`\bno (?:${MISSING_NOUN}) (?:(?:is|are|was|were) )?(?:${MISSING})\b`,
  ].join("|"),
  "i"
);

/** Whether a table cell's words, as a reader meets them, say nothing: a
 *  blank, a dash, or a phrase that stands in for a value nobody read. The
 *  grader counts with this same test (`scripts/eval-content/grade.ts`), so
 *  what the page pass takes out and what the count calls empty cannot part. */
export function isPlaceholderCell(rendered: string): boolean {
  return EMPTY_CELL_RE.test(rendered.trim());
}

const CURRENCY_RE = /[$€£¥]|\b(?:USD|EUR|GBP|CAD|AUD)\b/g;
const CURRENCY_NAME: Readonly<Record<string, string>> = { USD: "$", EUR: "€", GBP: "£" };
const CONVERSION_RE = /\bconvert(?:ed|s|ing)?\b|\bexchange rate\b/i;

function cellsOf(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

const isEmpty = (cell: string): boolean => isPlaceholderCell(renderOf(cell));

function currenciesOf(cell: string): Set<string> {
  return new Set([...renderOf(cell).matchAll(CURRENCY_RE)].map((match) => CURRENCY_NAME[match[0]] ?? match[0]));
}

/** One table, complete, or `null` where nothing worth a table is left.
 *
 *  A table may list its products down the side or across the top, so the
 *  pass does not assume which: while a cell is empty, the row or column with
 *  the largest share of empty cells is taken out — a product nothing is
 *  known about, or a criterion most products do not state — and on a tie the
 *  one that costs fewer filled cells. Then any row or column that mixes
 *  currencies goes, unless the page states a conversion. */
function completeTable(lines: readonly string[], conversionStated: boolean): string[] | null {
  const header = cellsOf(lines[0]!);
  const delimiter = cellsOf(lines[1]!);
  const body = lines.slice(2).map(cellsOf).filter((row) => row.length === header.length);
  const rows = new Set(body.keys());
  const columns = new Set(header.keys());
  const cell = (row: number, column: number): string => body[row]![column]!;
  const dataColumns = (): number[] => [...columns].filter((column) => column > 0);

  const drop = (pick: (cells: string[]) => number): boolean => {
    const lines_ = [
      ...[...rows].map((row) => ({ row, column: -1, cells: dataColumns().map((column) => cell(row, column)) })),
      ...dataColumns().map((column) => ({ row: -1, column, cells: [...rows].map((row) => cell(row, column)) })),
    ]
      .map((line) => ({ ...line, bad: pick(line.cells) }))
      .filter((line) => line.bad > 0 && line.cells.length > 0)
      .sort(
        (x, y) =>
          y.bad / y.cells.length - x.bad / x.cells.length ||
          x.cells.length - x.bad - (y.cells.length - y.bad) ||
          y.column - x.column
      );
    const worst = lines_[0];
    if (worst === undefined) return false;
    if (worst.row === -1) columns.delete(worst.column);
    else rows.delete(worst.row);
    return true;
  };

  while (drop((cells) => cells.filter(isEmpty).length)) {
    // Until no cell is empty.
  }
  if (!conversionStated) {
    while (drop((cells) => (new Set(cells.flatMap((held) => [...currenciesOf(held)])).size > 1 ? cells.length : 0))) {
      // Until no row or column mixes currencies.
    }
  }

  if (rows.size === 0 || columns.size < 2) return null;
  // A table with nothing to take out stands exactly as written.
  if (rows.size === lines.length - 2 && columns.size === header.length) return [...lines];
  const line = (cells: readonly string[]): string => `| ${cells.filter((_, column) => columns.has(column)).join(" | ")} |`;
  return [line(header), line(delimiter), ...[...rows].map((row) => line(body[row]!))];
}

/** Every table of the body, with no empty cell and one currency a column. */
export function completeTables(markdown: string): string {
  const conversionStated = CONVERSION_RE.test(markdown);
  const lines = markdown.split("\n");
  const out: string[] = [];
  for (let at = 0; at < lines.length; ) {
    if (ROW_RE.test(lines[at]!) && DELIMITER_RE.test(lines[at + 1] ?? "")) {
      let end = at + 2;
      while (end < lines.length && ROW_RE.test(lines[end]!)) end++;
      const table = lines.slice(at, end);
      const done = completeTable(table, conversionStated);
      if (done !== null) out.push(...done);
      at = end;
      continue;
    }
    out.push(lines[at]!);
    at++;
  }
  return out.join("\n");
}
