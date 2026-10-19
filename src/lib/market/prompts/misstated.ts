// src/lib/market/prompts/misstated.ts — what an AI answer states about the
// business, and where it contradicts the business's own site (issue 1539).
//
// **What an answer states** (`statementsOf`) is read when the answer is read,
// and stored on its `PromptAnswer`: a price, a count or a country the answer
// gives in a line or clause that names the business and names none of its
// rivals. Never the answer's prose: the figure as written, and at most
// `SAYS_MAX` characters of the words around it, so the customer can see it
// was not made up.
//
// **Where it contradicts the site** (`misstatedFacts`) is judged where it is
// shown, against the knowledge base as it stands (#1454), so a fact the
// customer corrects in Settings is the fact compared:
// - a price in a currency the site states prices in, that none of the
//   site's statements gives;
// - a count of a thing the site gives exactly one count of, higher than it
//   (a lower figure may be an answer's "over 500" of the site's 1,200);
// - a country, where the site's own places name countries and never that one.
//
// Every rule reads the shape of a figure, `Intl`'s currencies and region
// names, and the language pack's stem — never a word list of one market.
// A line that cannot be attributed to the business says nothing here: the
// rule under-reports rather than tells a founder an answer is wrong when it
// is not.
//
// Pure: no I/O, no clock, no model call.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { namesSite, says } from "@/lib/measure/drivers";
import { figuresOf } from "@/lib/generate/rules/figures";
import type { AnswerStatement, MisstatedFact, SiteFact, SiteFacts } from "./misstated-types";

export type { AnswerStatement, MisstatedFact, SiteFact, SiteFacts, StatedKind } from "./misstated-types";

/** The longest excerpt of an answer kept with a statement. */
export const SAYS_MAX = 160;

/** Markdown taken out: links keep their words, citation marks and bare
 *  addresses go, emphasis and code marks go. */
function plain(text: string): string {
  return text
    .replace(/\[\[\d+\]\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`]+/g, "")
    .replace(/[ \t]+/g, " ");
}

/** Lines, sentences and clauses: the smallest stretch an answer says one
 *  thing of one product in. A clause ends at "; " or ", " — never at a
 *  comma inside a figure. */
function segmentsOf(text: string): string[] {
  return plain(text)
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .flatMap((sentence) => sentence.split(/[;,]\s+/))
    .map((segment) => segment.trim())
    .filter((segment) => /\d|\p{Lu}/u.test(segment));
}

// ── Currencies and regions, from `Intl` ─────────────────────────────────

const CURRENCY_CODES: ReadonlySet<string> = new Set(
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : []
);

/** A currency code as its symbol ("EUR" → "€"), so "49 EUR" and "€49" are
 *  one currency; a code with no symbol of its own stays the code. */
function currencyKey(mark: string): string {
  if (!/^[A-Z]{3}$/.test(mark)) return mark;
  try {
    const parts = new Intl.NumberFormat("en", { style: "currency", currency: mark, currencyDisplay: "narrowSymbol" }).formatToParts(1);
    return parts.find((part) => part.type === "currency")?.value ?? mark;
  } catch {
    return mark;
  }
}

const BEFORE_CURRENCY = /(\p{Sc}|\b[A-Z]{3})\s?$/u;
const AFTER_CURRENCY = /^\s?(\p{Sc}|[A-Z]{3}\b)/u;

function currencyAround(before: string, after: string): string | null {
  for (const match of [BEFORE_CURRENCY.exec(before), AFTER_CURRENCY.exec(after)]) {
    const mark = match?.[1];
    if (mark === undefined) continue;
    if (/^[A-Z]{3}$/.test(mark) && !CURRENCY_CODES.has(mark)) continue;
    return currencyKey(mark);
  }
  return null;
}

/** Codes that name no country. */
const NOT_A_COUNTRY = new Set(["EU", "EZ", "UN", "QO", "ZZ", "XA", "XB"]);

interface Region {
  code: string;
  name: string;
  /** The name as a name: its capital kept, never inside a longer word. */
  pattern: RegExp;
}

const regionsCache = new Map<Language, readonly Region[]>();

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every country by its name in English and in the site's language. */
function regionNames(language: Language): readonly Region[] {
  const held = regionsCache.get(language);
  if (held !== undefined) return held;
  const out: Region[] = [];
  for (const locale of [...new Set(["en", language])]) {
    const names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
    for (let a = 65; a <= 90; a += 1) {
      for (let b = 65; b <= 90; b += 1) {
        const code = String.fromCharCode(a, b);
        if (NOT_A_COUNTRY.has(code)) continue;
        const name = names.of(code);
        if (name === undefined || name === code || out.some((each) => each.name === name)) continue;
        out.push({ code, name, pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, "u") });
      }
    }
  }
  regionsCache.set(language, out);
  return out;
}

/** The countries a text names, each by the name it used. */
function countriesIn(text: string, language: Language, except: string | null): Region[] {
  const out: Region[] = [];
  for (const region of regionNames(language)) {
    if (except !== null && says(except, region.name)) continue;
    if (region.pattern.test(text) && !out.some((each) => each.code === region.code)) out.push(region);
  }
  return out;
}

// ── Figures ─────────────────────────────────────────────────────────────

interface Figure {
  kind: "price" | "count";
  raw: string;
  at: number;
  key: string;
  values: string[];
}

/** One end of a range: a dash, or a short word between spaces ("to",
 *  "bis", "à"), between two figures. */
const RANGE_END = /\d\p{Sc}?(?:\s*[-–—]\s*|\s+\p{L}{1,3}\s+)\p{Sc}?$/u;
const RANGE_START = /^\p{Sc}?(?:\s*[-–—]\s*|\s+\p{L}{1,3}\s+)\p{Sc}?\d/u;

/** A year is a date, not a figure of the business. */
const isYear = (raw: string): boolean => /^\d{4}$/.test(raw) && Number(raw) >= 1900 && Number(raw) <= 2100;

/**
 * The prices and counts a stretch of text gives. A figure is left out
 * where it is not one value the text asserts: one end of a range ("5 to
 * 13", "€10–20"), one with a bound before it ("<$100", "~40"), a share
 * ("40%"), a year, and a count with no noun after it.
 */
function figuresIn(text: string, language: Language): Figure[] {
  const stem = languagePack(language).stem;
  const out: Figure[] = [];
  for (const figure of figuresOf(text, language)) {
    const before = text.slice(Math.max(0, figure.at - 12), figure.at);
    const after = text.slice(figure.at + figure.raw.length, figure.at + figure.raw.length + 24);
    if (isYear(figure.raw) || /^\s?%/.test(after) || /[<>~≈≤≥]\s?\p{Sc}?\s?$/u.test(before)) continue;
    if (RANGE_END.test(before) || RANGE_START.test(after)) continue;
    const currency = currencyAround(before, after);
    if (currency !== null) {
      if (figure.values.every((value) => Number(value) === 0)) continue;
      const mark = BEFORE_CURRENCY.exec(before)?.[0] ?? "";
      const tail = AFTER_CURRENCY.exec(after)?.[0] ?? "";
      out.push({ kind: "price", raw: `${mark}${figure.raw}${tail}`.trim(), at: figure.at, key: currency, values: figure.values });
      continue;
    }
    // A count's noun is a word: "500M+" is a figure scaled, not 500 of "M".
    const noun = /^\+?[\s\u00a0-]?(\p{L}{3,}[\p{L}'\u2019-]*)/u.exec(after)?.[1];
    if (noun === undefined || figure.values.every((value) => Number(value) < 2)) continue;
    out.push({ kind: "count", raw: `${figure.raw} ${noun}`, at: figure.at, key: stem(noun.toLowerCase()), values: figure.values });
  }
  return out;
}

/** At most `SAYS_MAX` characters of a stretch, around `at`. */
function excerpt(segment: string, at: number): string {
  if (segment.length <= SAYS_MAX) return segment;
  const start = Math.max(0, Math.min(at - SAYS_MAX / 2, segment.length - SAYS_MAX));
  return `${start > 0 ? "…" : ""}${segment.slice(start, start + SAYS_MAX).trim()}${start + SAYS_MAX < segment.length ? "…" : ""}`;
}

/**
 * What one answer states about the business: each price, count and country
 * in a stretch that names it and names none of `rivals`. One statement per
 * kind, key and value.
 */
export function statementsOf(a: {
  text: string;
  siteName: string | null;
  ownDomain: string;
  rivals: readonly { name: string; domain: string }[];
  language: Language;
}): AnswerStatement[] {
  const out: AnswerStatement[] = [];
  const add = (statement: AnswerStatement): void => {
    const same = out.some(
      (held) => held.kind === statement.kind && held.key === statement.key && held.values.join() === statement.values.join()
    );
    if (!same) out.push(statement);
  };
  for (const segment of segmentsOf(a.text)) {
    if (!namesSite(segment, a.siteName, a.ownDomain)) continue;
    if (a.rivals.some((rival) => says(segment, rival.name) || says(segment, rival.domain))) continue;
    for (const figure of figuresIn(segment, a.language)) {
      add({ kind: figure.kind, raw: figure.raw, says: excerpt(segment, figure.at), key: figure.key, values: figure.values });
    }
    for (const region of countriesIn(segment, a.language, a.siteName)) {
      add({ kind: "place", raw: region.name, says: excerpt(segment, segment.indexOf(region.name)), key: region.code, values: [] });
    }
  }
  return out;
}

// ── Against the site ────────────────────────────────────────────────────

const overlaps = (a: readonly string[], b: readonly string[]): boolean => a.some((value) => b.includes(value));

/** Whether a stored statement is one this build reads. */
function isStatement(value: unknown): value is AnswerStatement {
  const s = value as Partial<AnswerStatement> | null;
  return (
    typeof s === "object" && s !== null &&
    (s.kind === "price" || s.kind === "count" || s.kind === "place") &&
    typeof s.raw === "string" && typeof s.says === "string" && typeof s.key === "string" && Array.isArray(s.values)
  );
}

/**
 * Where the answers' statements contradict the site's own (issue 1539). One
 * finding per thing the site states and figure an answer gave, the
 * answers' order kept.
 */
export function misstatedFacts(a: {
  answers: readonly { states?: readonly unknown[] }[];
  facts: SiteFacts;
  language: Language;
}): MisstatedFact[] {
  const all = [...a.facts.prices, ...a.facts.statements, ...a.facts.places];
  const figures = all.flatMap((fact) => figuresIn(fact.text, a.language).map((figure) => ({ fact, figure })));
  const priced = a.facts.prices.flatMap((fact) => figuresIn(fact.text, a.language).filter((f) => f.kind === "price").map((figure) => ({ fact, figure })));
  const placed = a.facts.places.filter((fact) => countriesIn(fact.text, a.language, null).length > 0);
  const named = new Set(all.flatMap((fact) => countriesIn(fact.text, a.language, null).map((region) => region.code)));

  const out: MisstatedFact[] = [];
  const add = (finding: MisstatedFact): void => {
    if (!out.some((held) => held.kind === finding.kind && held.aiSays === finding.aiSays && held.siteSays === finding.siteSays)) out.push(finding);
  };
  for (const statement of a.answers.flatMap((answer) => (answer.states ?? []).filter(isStatement))) {
    if (statement.kind === "price") {
      const own = priced.filter((each) => each.figure.key === statement.key);
      if (own.length === 0) continue;
      const stated = figures.filter((each) => each.figure.kind === "price" && each.figure.key === statement.key);
      if (stated.some((each) => overlaps(each.figure.values, statement.values))) continue;
      const lowest = [...own].sort((x, y) => Number(x.figure.values[0]) - Number(y.figure.values[0]))[0]!;
      add({ kind: "price", aiSays: statement.raw, answer: statement.says, siteSays: lowest.fact.text, url: lowest.fact.url });
    } else if (statement.kind === "count") {
      const own = figures.filter((each) => each.figure.kind === "count" && each.figure.key === statement.key);
      const values = new Set(own.map((each) => each.figure.values[0]));
      if (own.length === 0 || values.size !== 1) continue;
      const site = own[0]!;
      if (overlaps(site.figure.values, statement.values)) continue;
      if (Number(statement.values[0]) <= Number(site.figure.values[0])) continue;
      add({ kind: "count", aiSays: statement.raw, answer: statement.says, siteSays: site.fact.text, url: site.fact.url });
    } else {
      if (placed.length === 0 || named.has(statement.key)) continue;
      const site = placed[0]!;
      add({ kind: "place", aiSays: statement.raw, answer: statement.says, siteSays: site.text, url: site.url });
    }
  }
  return out;
}

/** The site's facts from the knowledge base, in either of the shapes it is
 *  read in: whole (`KnowledgeBase`, each item with its source) or bounded
 *  for a prompt (`PromptKnowledge`, each with `from`). */
export function siteFactsOf(knowledge: {
  offerings: readonly { prices: readonly string[]; features: readonly string[]; uses: readonly string[]; source?: unknown; from?: string }[];
  differentiators: readonly { text: string; source?: unknown; from?: string }[];
  proof: readonly { text: string; source?: unknown; from?: string }[];
  audience: readonly { text: string; source?: unknown; from?: string }[];
  problems: readonly { text: string; source?: unknown; from?: string }[];
  integrations: readonly { text: string; source?: unknown; from?: string }[];
  places: readonly { text: string; source?: unknown; from?: string }[];
}): SiteFacts {
  const urlOf = (item: { source?: unknown; from?: string }): string | null => {
    if (typeof item.from === "string") return item.from === "founder" ? null : item.from;
    const source = item.source as { kind?: string; url?: string } | undefined;
    return source?.kind === "page" && typeof source.url === "string" ? source.url : null;
  };
  const items = (list: readonly { text: string; source?: unknown; from?: string }[]): SiteFact[] =>
    list.map((item) => ({ text: item.text, url: urlOf(item) }));
  return {
    prices: knowledge.offerings.flatMap((offering) => offering.prices.map((text) => ({ text, url: urlOf(offering) }))),
    statements: [
      ...knowledge.offerings.flatMap((offering) => [...offering.features, ...offering.uses].map((text) => ({ text, url: urlOf(offering) }))),
      ...items(knowledge.differentiators),
      ...items(knowledge.proof),
      ...items(knowledge.audience),
      ...items(knowledge.problems),
      ...items(knowledge.integrations),
    ],
    places: items(knowledge.places),
  };
}
