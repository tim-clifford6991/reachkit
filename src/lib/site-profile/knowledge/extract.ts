// SPEC §5 (2026-09-29, #1133) — "One small-tier call per page produces the
// structure in §0 … Every item keeps the address it was read from."
//
// **What a call reads.** One page's prose, already cleaned by §5's rules
// (`@/lib/measure/prose`: navigation, buttons, footers and example widgets
// are gone before this file sees it), with every line the site repeats on
// three or more of its pages dropped here — the repetition half of the same
// rule, applied to lines rather than sentences because a price is rarely a
// sentence.
//
// **What a call may answer.** Only what the page says. A number an item
// carries that the page does not is the model's, not the site's, and the
// item is dropped: a price nobody published is the one invention this
// product cannot afford (§7, "every number on a page traces to a fact").
//
// **Money and time.** Every call goes through `llm()` under the pass's own
// cap. The read stops when its budget (`KNOWLEDGE_BASE.BUDGET_C`), its
// clock or the pass's cap is spent, and what it read by then is the base:
// pages are asked in `readFirstRank` order, so what is left out is what
// mattered least. A page whose text has not changed keeps its stored
// reading and costs nothing.
import type { Locale } from "@/lib/locale/locales";
import { createHash } from "node:crypto";
import { z } from "zod";
import { INFERENCE_MAX_OUTPUT_TOKENS, KNOWLEDGE_BASE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { isBuyerQuestion, isSpecificAudience } from "./clean";
import { isReadForFacts, readFirstRank } from "./priority";
import type { PageReading, StoredKnowledge, StoredPage } from "./types";

export const KNOWLEDGE_CALL_SITE = "site-knowledge" as const;

/** A line on this many of the site's pages, and on more than this share of
 *  them, is the site's chrome (§5, 2026-10-03 — the passages' own rule,
 *  `@/lib/generate/pipeline/grounding`). */
const REPEATED_ON_PAGES = 3;
const REPEATED_ON_SHARE = 0.5;

const items = z.array(z.string()).max(KNOWLEDGE_BASE.PAGE_ITEMS);
/** A page's own FAQ may hold more than a model is asked for. */
const questions = z.array(z.string()).max(KNOWLEDGE_BASE.PAGE_QUESTIONS);

export const PAGE_READING_SCHEMA = z.strictObject({
  offerings: z
    .array(z.strictObject({ name: z.string(), features: items, prices: items, uses: items }))
    .max(KNOWLEDGE_BASE.PAGE_ITEMS),
  audience: items,
  problems: items,
  differentiators: z
    .array(z.strictObject({ rival: z.string().nullable(), text: z.string() }))
    .max(KNOWLEDGE_BASE.PAGE_ITEMS),
  proof: items,
  questions,
  integrations: items,
  places: items,
});

const MAX = KNOWLEDGE_BASE.PAGE_ITEMS;

export const PAGE_READING_FIELDS: Readonly<Record<string, string>> = Object.freeze({
  offerings: `at most ${MAX} objects, one per product, plan or service this page describes: name as the page names it; features, what the page says it does; prices, each price with its unit exactly as written ("€49 a month"); uses, what the page says it is used for`,
  audience: `at most ${MAX} short strings: who the page says the business serves, each a kind of customer as specific as the page names it ("dental practices", "Shopify stores", "first-time home buyers"); never a word for anyone at all ("businesses", "companies", "customers", "users")`,
  problems: `at most ${MAX} short strings: problems the page says the business solves`,
  differentiators: `at most ${MAX} objects: text, one sentence on how the page says the business differs; rival, the competitor it names, or null where it names none`,
  proof: `at most ${MAX} strings: a customer result, a testimonial quoted word for word with who said it, or a named customer, as the page states it`,
  questions: `at most ${MAX} strings: questions a buyer would ask before buying that the page answers, each a full question ending in a question mark that makes sense read alone, as the page words them; never a section heading, a menu label or a button ("Why you should care", "What to do next", "How it works")`,
  integrations: `at most ${MAX} short strings: other products the page says this one works with`,
  places: `at most ${MAX} short strings: places the page says the business serves or is based in`,
});

export const PAGE_READING_TASK =
  "Read one page of a business's own website and record what it says about the business. " +
  "Answer with one JSON object and nothing else: no prose, no code fence. It has exactly the fields " +
  "listed under `fields` and no other. Use the page's own words and figures. Record only what this page " +
  "states: never a price, a number, a customer or a claim the page does not carry. Where the page does " +
  "not say, answer with an empty list. A page about something else — a blog post about the market, a " +
  "legal notice — answers with empty lists.";

/** One page as the read takes it: its address and its cleaned prose. */
export interface KnowledgePage {
  readonly url: string;
  readonly text: string;
  /** What the page shows inside an element marked as an example (§5). */
  readonly examples?: readonly string[];
  /** The questions the page's own markup asks: its FAQ schema, its FAQ
   *  section and its headings phrased as questions (`@/lib/measure/questions`). */
  readonly questions?: readonly string[];
}

function hashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function oneLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

/** The site's demo phrases (§5, 2026-10-04, issue 1249): what any page held
 *  now shows inside an example, then what earlier reads stored — a legal or
 *  gallery page's examples count, though the page is not read. Newest
 *  first, bounded. */
export function demoPhrasesOf(pages: readonly KnowledgePage[], stored: readonly string[] = []): string[] {
  const seen = pages.flatMap((page) => (page.examples ?? []).map(oneLine));
  return [...new Set([...seen, ...stored])].filter((line) => line !== "").slice(0, KNOWLEDGE_BASE.DEMO_PHRASES);
}

/** Each page's text without the lines the site repeats or shows as a demo,
 *  cut to what one call carries. A legal page is never read for facts (§5,
 *  2026-10-03), nor a gallery page (2026-10-04),
 *  and a page left with too little to read is not returned. */
export function readablePages(
  all: readonly KnowledgePage[],
  demoPhrases: readonly string[] = demoPhrasesOf(all)
): readonly KnowledgePage[] {
  const pages = all.filter((page) => isReadForFacts(page.url));
  const demo = new Set(demoPhrases);
  const repeated = (line: string): boolean => {
    const count = onPages.get(line) ?? 0;
    return count >= REPEATED_ON_PAGES && count > pages.length * REPEATED_ON_SHARE;
  };
  const onPages = new Map<string, number>();
  const lines = pages.map((page) => [...new Set(page.text.split("\n"))]);
  for (const own of lines) for (const line of own) onPages.set(line, (onPages.get(line) ?? 0) + 1);

  const out: KnowledgePage[] = [];
  pages.forEach((page, i) => {
    const text = (lines[i] ?? [])
      .filter((line) => !repeated(line) && !demo.has(line))
      .join("\n")
      .slice(0, KNOWLEDGE_BASE.PAGE_INPUT_CHARS);
    if (text.length >= KNOWLEDGE_BASE.PAGE_MIN_CHARS) {
      out.push({ url: page.url, text, ...(page.questions === undefined ? {} : { questions: page.questions }) });
    }
  });
  return out
    .map((page, i) => ({ page, i, rank: readFirstRank(page.url) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((entry) => entry.page)
    .slice(0, KNOWLEDGE_BASE.MAX_PAGES);
}

const NUMBER_RE = /\d+(?:[.,]\d+)*/g;

/** Whether every number `text` carries is on the page. */
function numbersOnPage(text: string, page: string): boolean {
  return (text.match(NUMBER_RE) ?? []).every((number) => page.includes(number));
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, KNOWLEDGE_BASE.ITEM_CHARS);
}

/** Entries with blanks, repeats and any whose numbers the page does not
 *  carry taken out. */
function kept<T>(values: readonly T[], textOf: (value: T) => string, page: string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const text = textOf(value);
    const key = text.toLocaleLowerCase();
    if (text === "" || seen.has(key) || !numbersOnPage(text, page)) return false;
    seen.add(key);
    return true;
  });
}

function keptStrings(values: readonly string[], page: string): string[] {
  return kept(values.map(tidy), (value) => value, page);
}

/** The answer as it is stored: tidied, and without anything the page does
 *  not bear out. */
export function checkedReading(answer: PageReading, pageText: string): PageReading {
  return {
    offerings: answer.offerings
      .map((offering) => ({
        name: tidy(offering.name),
        features: keptStrings(offering.features, pageText),
        prices: keptStrings(offering.prices, pageText),
        uses: keptStrings(offering.uses, pageText),
      }))
      .filter((offering) => offering.name !== ""),
    // D65: an audience names a kind of customer, and a question is one.
    audience: keptStrings(answer.audience, pageText).filter(isSpecificAudience),
    problems: keptStrings(answer.problems, pageText),
    differentiators: kept(
      answer.differentiators.map((entry) => ({ text: tidy(entry.text), rival: tidy(entry.rival ?? "") || null })),
      (entry) => entry.text,
      pageText
    ),
    proof: keptStrings(answer.proof, pageText),
    questions: keptStrings(answer.questions, pageText).filter((question) => isBuyerQuestion(question, pageText)),
    integrations: keptStrings(answer.integrations, pageText),
    places: keptStrings(answer.places, pageText),
  };
}

/**
 * A page's reading with the questions its own markup asks (SPEC §5,
 * 2026-10-07, issue 1314). They are the page's, so they come first and need
 * no model to find them; what the model read follows, once each. A demo
 * widget's question is not the business's.
 */
export function withPageQuestions(reading: PageReading, page: KnowledgePage, demoPhrases: readonly string[] = []): PageReading {
  const demo = new Set(demoPhrases.map((phrase) => phrase.toLocaleLowerCase()));
  const own = (page.questions ?? []).map(tidy).filter((question) => isBuyerQuestion(question) && !demo.has(question.toLocaleLowerCase()));
  if (own.length === 0) return reading;
  const seen = new Set<string>();
  const questions = [...own, ...reading.questions].filter((question) => {
    const key = question.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...reading, questions: questions.slice(0, KNOWLEDGE_BASE.PAGE_QUESTIONS) };
}

/** What the settled call roughly cost, from what went in and came out —
 *  the small tier's price, at ~4 characters a token. An estimate for the
 *  read's own budget; the ledger holds the real figure. */
function roughCents(input: string, output: unknown): number {
  return (input.length / 4) * 1e-4 + (JSON.stringify(output).length / 4) * 5e-4;
}

/** The most one page's call can cost: its text in, and the call site's
 *  whole output allowance back. */
function worstCents(input: string): number {
  return (input.length / 4) * 1e-4 + INFERENCE_MAX_OUTPUT_TOKENS[KNOWLEDGE_CALL_SITE] * 5e-4;
}

export interface KnowledgeRead {
  readonly knowledge: StoredKnowledge;
  /** Pages asked about in this read, and pages whose stored reading stood. */
  readonly asked: number;
  readonly reused: number;
  readonly stoppedBy: "complete" | "budget" | "time" | "cap";
}

/**
 * The site's pages, read into the stored shape. Never throws: a call that
 * did not come back leaves that page out, and an unchanged page keeps the
 * reading it had.
 */
export async function readKnowledge(
  c: CostContext,
  a: { domain: string; pages: readonly KnowledgePage[]; previous: StoredKnowledge; now?: Date; locale?: Locale }
): Promise<KnowledgeRead> {
  const deadline = Date.now() + KNOWLEDGE_BASE.STEP_MS;
  const before = new Map(a.previous.pages.map((page) => [`${page.url}\n${page.hash}`, page]));
  const demoPhrases = demoPhrasesOf(a.pages, a.previous.demoPhrases);
  const pages = readablePages(a.pages, demoPhrases);

  const read: (StoredPage | null)[] = pages.map(() => null);
  const queue: number[] = [];
  let reused = 0;
  pages.forEach((page, i) => {
    const stored = before.get(`${page.url}\n${hashOf(page.text)}`);
    if (stored === undefined) queue.push(i);
    else {
      // A page read before issue 1314 gains its own questions without a call.
      read[i] = { ...stored, reading: withPageQuestions(stored.reading, page, demoPhrases) };
      reused++;
    }
  });

  let spent = 0;
  // What the calls in flight may still cost (issue 1314): the budget is
  // checked against it, so six calls at once cannot run past the bound.
  let reserved = 0;
  let asked = 0;
  let stoppedBy: KnowledgeRead["stoppedBy"] = "complete";
  const worker = async (): Promise<void> => {
    for (;;) {
      const next = queue[0];
      if (next === undefined) return;
      const worst = worstCents(pages[next]!.text);
      if (spent + reserved + worst > KNOWLEDGE_BASE.BUDGET_C) stoppedBy = "budget";
      else if (Date.now() >= deadline) stoppedBy = "time";
      else if (c.capHit()) stoppedBy = "cap";
      if (stoppedBy !== "complete") return;

      const i = queue.shift()!;
      const page = pages[i]!;
      asked++;
      reserved += worst;
      const answer = await llm(c, {
        site: KNOWLEDGE_CALL_SITE,
        input: {
          task: PAGE_READING_TASK,
          fields: PAGE_READING_FIELDS,
          domain: a.domain,
          page: { url: page.url, text: page.text },
        },
        schema: PAGE_READING_SCHEMA,
        tier: "nano",
        ...(a.locale === undefined ? {} : { locale: a.locale }),
      });
      reserved -= worst;
      if (answer.kind === "unmeasured") {
        spent += roughCents(page.text, {});
        continue;
      }
      spent += roughCents(page.text, answer.value);
      read[i] = {
        url: page.url,
        hash: hashOf(page.text),
        reading: withPageQuestions(checkedReading(answer.value, page.text), page, demoPhrases),
      };
    }
  };
  await Promise.all(Array.from({ length: KNOWLEDGE_BASE.CONCURRENCY }, worker));

  console.log(
    JSON.stringify({
      event: "site_knowledge_read",
      pages: pages.length,
      asked,
      reused,
      stoppedBy,
      demoPhrases: demoPhrases.length,
    })
  );
  return {
    knowledge: {
      pages: read.filter((page): page is StoredPage => page !== null),
      readAt: (a.now ?? new Date()).toISOString(),
      demoPhrases,
    },
    asked,
    reused,
    stoppedBy,
  };
}
