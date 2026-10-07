// SPEC §0 "Knowledge base" · §5 (2026-09-29, #1133) — the base as a reader
// sees it: every page's reading and the founder's answers, as one shape.
//
// Pure. No database, no clock, no model call.
//
// **The founder's answers come first in their list.** An answer the founder
// gives "is a fact with the founder as its source" (§5), and where they
// have said who buys from them, that outranks what a page was read to say.
import { KNOWLEDGE_BASE } from "@/lib/config/constants";
import { isBuyerQuestion, isSpecificAudience } from "./clean";
import { readFirstRank } from "./priority";
import {
  KNOWLEDGE_LISTS,
  type Differentiator,
  type FounderAnswers,
  type KnowledgeBase,
  type KnowledgeItem,
  type KnowledgeList,
  type Offering,
  type StoredKnowledge,
} from "./types";

const FOUNDER = { kind: "founder" } as const;

/** Which list each answer joins. The byline is not an item: it is §7's. */
const ANSWER_LIST = {
  buyers: "audience",
  asked: "questions",
  result: "proof",
} as const satisfies Partial<Record<keyof FounderAnswers, KnowledgeList>>;

/** What a list keeps of a page's reading (D65, `./clean.ts`), applied here
 *  too so a page read before the rule is cleaned without a new read. The
 *  founder's answer is never judged. */
const READ_KEEPS: Partial<Record<KnowledgeList, (text: string) => boolean>> = {
  audience: isSpecificAudience,
  questions: (text) => isBuyerQuestion(text),
};

function stated(value: string | undefined): string | null {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

function unique<T>(entries: readonly T[], keyOf: (entry: T) => string, max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of entries) {
    const key = keyOf(entry).toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length === max) break;
  }
  return out;
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return unique([...a, ...b], (text) => text, KNOWLEDGE_BASE.PAGE_ITEMS * 2);
}

export function knowledgeBase(a: { stored: StoredKnowledge; answers: FounderAnswers }): KnowledgeBase {
  // The pages in read-first order, so a list's first items are the pricing
  // and features pages' and not a changelog entry's.
  const pages = a.stored.pages
    .map((page, i) => ({ page, i, rank: readFirstRank(page.url) }))
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .map((entry) => entry.page);

  // One offering per name: the first page to name it is its address, and
  // what later pages add to it is added.
  const offerings = new Map<string, Offering>();
  for (const page of pages) {
    for (const read of page.reading.offerings) {
      const key = read.name.toLocaleLowerCase();
      const held = offerings.get(key);
      offerings.set(
        key,
        held === undefined
          ? { ...read, source: { kind: "page", url: page.url } }
          : {
              ...held,
              features: union(held.features, read.features),
              prices: union(held.prices, read.prices),
              uses: union(held.uses, read.uses),
            }
      );
    }
  }

  const list = (name: KnowledgeList): KnowledgeItem[] => {
    const answered = Object.entries(ANSWER_LIST).find(([, to]) => to === name)?.[0] as
      | keyof typeof ANSWER_LIST
      | undefined;
    const founder = answered === undefined ? null : stated(a.answers[answered]);
    return unique(
      [
        ...(founder === null ? [] : [{ text: founder, source: FOUNDER }]),
        ...pages.flatMap((page) =>
          page.reading[name]
            .filter(READ_KEEPS[name] ?? (() => true))
            .map((text): KnowledgeItem => ({ text, source: { kind: "page", url: page.url } }))
        ),
      ],
      (item) => item.text,
      KNOWLEDGE_BASE.ITEMS
    );
  };

  const edge = stated(a.answers.edge);
  const differentiators = unique<Differentiator>(
    [
      ...(edge === null ? [] : [{ text: edge, rival: null, source: FOUNDER }]),
      ...pages.flatMap((page) =>
        page.reading.differentiators.map((entry) => ({ ...entry, source: { kind: "page" as const, url: page.url } }))
      ),
    ],
    (entry) => entry.text,
    KNOWLEDGE_BASE.ITEMS
  );

  return {
    offerings: [...offerings.values()].slice(0, KNOWLEDGE_BASE.OFFERINGS),
    differentiators,
    ...(Object.fromEntries(KNOWLEDGE_LISTS.map((name) => [name, list(name)])) as Record<
      KnowledgeList,
      KnowledgeItem[]
    >),
    byline: stated(a.answers.byline),
    pagesRead: a.stored.pages.length,
    readAt: a.stored.readAt === null ? null : new Date(a.stored.readAt),
  };
}

/** Whether the base says anything at all. */
export function knowledgeIsEmpty(base: KnowledgeBase): boolean {
  return (
    base.offerings.length === 0 &&
    base.differentiators.length === 0 &&
    base.byline === null &&
    KNOWLEDGE_LISTS.every((name) => base[name].length === 0)
  );
}
