// SPEC §7 (owner, D47, 2026-10-04; issue 1258) — the listicle's comparison
// table, built in code from the context pack.
//
// The model does not write this table. A writer handed a rival whose pricing
// page states no price wrote "not stated", the page pass (`./sources.ts`)
// then took that rival's column out, and the page was left comparing the
// business with nobody (issue 1252's proof). So the table is laid out here,
// from what the pack holds, before a word is written:
//
//   * **rows are the options** — the business first, then each rival whose
//     own pricing or feature page yielded a claim;
//   * **columns are the criteria** — what each option's own page says of its
//     pricing and of what it does. A cell is a fact, word for word, linked to
//     the page it was read from;
//   * a criterion **most** options lack leaves the table. One only a few
//     lack stays, and the option that lacks it **keeps its row**: the table
//     is then laid out with one cell an option, each naming the criteria that
//     option's page does state — so no cell is empty and none says a value is
//     missing (owner, 2026-10-02: "a table never ships with an empty or 'not
//     stated' cell");
//   * prices in more than one currency take pricing out of the table, since
//     nothing converts (`./sources.ts`); each option's own section states it;
//   * **two rivals are always kept.** Fewer than two with a fact to set
//     beside the business is no comparison: `null`, and the page is written
//     as a Q&A (`./pack.ts`).
//
// Pure: the same pack gives the same table, so the pack's check, the writer's
// prompt and the laid-out page all read one table.
import { copy } from "@/lib/presentation/copy";
import { isPlaceholderCell } from "../rules/cells";
import type { ContextPack, PackClaim } from "./pack";
import { completeTables, currenciesOf } from "./sources";

type Criterion = "pricing" | "does";
const CRITERIA: readonly Criterion[] = ["pricing", "does"];
const CLAIM_KIND = { pricing: "rival_pricing", does: "rival_features" } as const;
const HEADER = { pricing: "body.table.pricing", does: "body.table.does" } as const;

interface Cell {
  text: string;
  url: string | null;
}

interface Option {
  name: string;
  own: boolean;
  cells: Partial<Record<Criterion, Cell>>;
}

export interface ComparisonTable {
  markdown: string;
  /** The options' names, the business first. */
  options: string[];
}

type TablePack = Pick<ContextPack, "business" | "profile" | "facts" | "claims" | "products">;

const PRICED_RE = /[$€£¥]\s?\d|\d\s?(?:usd|eur|gbp|[$€£¥])/i;
const PRICE_RE = /[$€£¥]\s?\d|\d\s?(?:usd|eur|gbp|[$€£¥])|\bfree\b/i;
const isUrl = (text: string): boolean => /^https?:\/\//.test(text);

/** A value a table can hold: said in words, and not words that say a value
 *  is missing. */
function cell(text: string | undefined, url: string | null): Cell | undefined {
  const words = (text ?? "").replace(/\s+/g, " ").trim();
  return words === "" || isPlaceholderCell(words) ? undefined : { text: words, url };
}

/** The business's own row, from its knowledge base and its own passages. */
function ownOption(pack: TablePack): Option {
  const offerings = pack.profile?.knowledge?.offerings ?? [];
  const priced =
    offerings.find((offering) => offering.prices.some((price) => PRICED_RE.test(price))) ??
    offerings.find((offering) => offering.prices.length > 0);
  const price = priced?.prices.find((each) => PRICED_RE.test(each)) ?? priced?.prices[0];
  const stated = pack.facts.find((fact) => PRICE_RE.test(fact.passage));
  const described = priced !== undefined && priced.features.length > 0 ? priced : offerings.find((offering) => offering.features.length > 0);
  return {
    name: pack.business.name ?? pack.business.domain,
    own: true,
    cells: {
      pricing: cell(price, priced !== undefined && isUrl(priced.from) ? priced.from : null) ?? cell(stated?.passage, stated?.url ?? null),
      does:
        cell(described?.features[0], described !== undefined && isUrl(described.from) ? described.from : null) ??
        cell(pack.profile?.products[0] ?? pack.profile?.job ?? undefined, null),
    },
  };
}

/** How the site's market names a rival, else its domain. */
function rivalName(pack: TablePack, domain: string): string {
  const rivals = (pack.business.market as { rivals?: unknown } | null)?.rivals;
  const named = Array.isArray(rivals)
    ? (rivals as { name?: unknown; domain?: unknown }[]).find((rival) => rival?.domain === domain && typeof rival.name === "string")
    : undefined;
  return typeof named?.name === "string" && named.name.trim() !== "" ? named.name.trim() : domain;
}

function rivalOption(pack: TablePack, domain: string): Option {
  const claims = pack.claims.filter((claim) => claim.product === domain);
  const of = (kind: PackClaim["kind"], prefer?: RegExp): Cell | undefined => {
    const held = claims.filter((claim) => claim.kind === kind);
    const claim = (prefer === undefined ? undefined : held.find((each) => prefer.test(each.passage))) ?? held[0];
    return cell(claim?.passage, claim?.url ?? null);
  };
  return {
    name: rivalName(pack, domain),
    own: false,
    cells: { pricing: of(CLAIM_KIND.pricing, PRICED_RE), does: of(CLAIM_KIND.does) },
  };
}

/** A cell's words as one table cell: on one line, with no bar or bracket a
 *  parser would read as structure, linked to the page they were read from. */
function written(held: Cell): string {
  const text = held.text.replace(/[[\]]/g, "").replace(/\|/g, "/");
  return held.url === null ? text : `[${text}](${held.url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20")})`;
}

/**
 * The comparison table a listicle's pack gives, or `null` where it holds no
 * comparison: no fact for the business's own row, or fewer than `minRivals`
 * rivals with one.
 */
export function comparisonTable(pack: TablePack, minRivals: number): ComparisonTable | null {
  let options = [ownOption(pack), ...pack.products.map((product) => rivalOption(pack, product.domain))];
  let criteria = [...CRITERIA];
  // One currency a table: nothing here converts.
  const currencies = new Set(options.flatMap((option) => [...currenciesOf(option.cells.pricing?.text ?? "")]));
  if (currencies.size > 1) criteria = criteria.filter((criterion) => criterion !== "pricing");
  // A criterion most options lack goes; then an option left with nothing to
  // say goes; until neither changes.
  for (;;) {
    const kept = criteria.filter((criterion) => options.filter((option) => option.cells[criterion] === undefined).length * 2 <= options.length);
    const filled = options.filter((option) => kept.some((criterion) => option.cells[criterion] !== undefined));
    if (kept.length === criteria.length && filled.length === options.length) break;
    criteria = kept;
    options = filled;
  }
  if (criteria.length === 0 || options[0]?.own !== true || options.length - 1 < minRivals) return null;

  const whole = options.every((option) => criteria.every((criterion) => option.cells[criterion] !== undefined));
  const row = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  const header = whole ? criteria.map((criterion) => copy(HEADER[criterion])) : [copy("body.table.stated")];
  const rows = options.map((option) => {
    const held = criteria.flatMap((criterion) => {
      const value = option.cells[criterion];
      return value === undefined ? [] : [{ criterion, value }];
    });
    return row([
      option.name.replace(/\|/g, "/"),
      // Every criterion a column, or — where an option lacks one — one cell
      // an option, each saying which criteria it states.
      ...(whole ? held.map((each) => written(each.value)) : [held.map((each) => `${copy(HEADER[each.criterion])}: ${written(each.value)}`).join(" · ")]),
    ]);
  });
  const markdown = [row([copy("body.table.option"), ...header]), row(["---", ...header.map(() => "---")]), ...rows].join("\n");
  // What the page pass would take a row or a column out of is not a table
  // this page can stand on.
  if (completeTables(markdown) !== markdown) return null;
  return { markdown, options: options.map((option) => option.name) };
}

const ROW_RE = /^[ \t]*\|.*\|[ \t]*$/;

/**
 * The body with the built table in the section under `heading`, after that
 * section's opening paragraph — and without any table the writer put there.
 * A body with no such section is returned as it is, and the blocks check
 * stops it.
 */
export function withTable(markdown: string, heading: string | undefined, table: string): string {
  const lines = markdown.split("\n");
  const at = heading === undefined ? -1 : lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (at === -1) return markdown;
  const next = lines.findIndex((line, index) => index > at && /^##[ \t]+/.test(line));
  const end = next === -1 ? lines.length : next;
  const section = lines.slice(at + 1, end).filter((line) => !ROW_RE.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const [opening, ...rest] = section.split(/\n{2,}/);
  const body = [opening ?? "", table, ...rest].filter((block) => block.trim() !== "").join("\n\n");
  return [...lines.slice(0, at + 1), "", body, "", ...lines.slice(end)].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
