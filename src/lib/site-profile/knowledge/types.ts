// SPEC §0 "Knowledge base" · §5 (2026-09-29, #1133).
//
// "What the business sells and how: each offering with its features, prices
// and uses; who it serves; the problems it solves; how it differs from each
// rival; its proof; its buyers' common questions; integrations and places.
// Every item carries the page it was read from, or says the founder gave it."
//
// **Two halves, two owners**, as the profile has (`../types.ts`). What a
// crawl read is derived and domain-keyed: `site_profiles.knowledge`, one
// reading per page, replaced by the next read. What the founder answered is
// theirs and site-keyed: `site_profile_edits.answers`, which no read
// touches. `./merge.ts` puts the two together and is the only shape a
// reader sees.
import { KNOWLEDGE_BASE } from "@/lib/config/constants";

/** §5's five optional questions, in the order the step asks them. */
export const FOUNDER_QUESTIONS = ["buyers", "edge", "asked", "result", "byline"] as const;

export type FounderQuestion = (typeof FOUNDER_QUESTIONS)[number];

/** The founder's answers. A question with no answer has no key. */
export type FounderAnswers = Readonly<Partial<Record<FounderQuestion, string>>>;

/** The five answers, each trimmed and bounded; a blank one is no answer,
 *  and a key that is not one of the five is ignored. */
export function founderAnswers(value: unknown): FounderAnswers {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const out: Partial<Record<FounderQuestion, string>> = {};
  for (const question of FOUNDER_QUESTIONS) {
    const answer = source[question];
    if (typeof answer !== "string") continue;
    const text = answer.trim().slice(0, KNOWLEDGE_BASE.ANSWER_CHARS);
    if (text !== "") out[question] = text;
  }
  return out;
}

/** Where an item came from: the page it was read on, or the founder. */
export type KnowledgeSource =
  | { readonly kind: "page"; readonly url: string }
  | { readonly kind: "founder" };

export interface KnowledgeItem {
  readonly text: string;
  readonly source: KnowledgeSource;
}

/** One thing the business sells, with what its page says of it. */
export interface Offering {
  readonly name: string;
  readonly features: readonly string[];
  readonly prices: readonly string[];
  readonly uses: readonly string[];
  readonly source: KnowledgeSource;
}

/** How the business differs — from a named rival, or from the rest. */
export interface Differentiator extends KnowledgeItem {
  readonly rival: string | null;
}

/** The lists that are plain items. */
export const KNOWLEDGE_LISTS = ["audience", "problems", "proof", "questions", "integrations", "places"] as const;

export type KnowledgeList = (typeof KNOWLEDGE_LISTS)[number];

export interface KnowledgeBase extends Readonly<Record<KnowledgeList, readonly KnowledgeItem[]>> {
  readonly offerings: readonly Offering[];
  readonly differentiators: readonly Differentiator[];
  /** The founder's name and line, for §7's byline. Theirs alone. */
  readonly byline: string | null;
  /** How many pages the base was read from, and when. */
  readonly pagesRead: number;
  readonly readAt: Date | null;
}

/** What one call read off one page, before any address is attached. */
export interface PageReading extends Readonly<Record<KnowledgeList, readonly string[]>> {
  readonly offerings: readonly {
    readonly name: string;
    readonly features: readonly string[];
    readonly prices: readonly string[];
    readonly uses: readonly string[];
  }[];
  readonly differentiators: readonly { readonly rival: string | null; readonly text: string }[];
}

/** One page of the stored reading. `hash` is of the text the call read, so
 *  a page that has not changed is not asked about again. */
export interface StoredPage {
  readonly url: string;
  readonly hash: string;
  readonly reading: PageReading;
}

/** `site_profiles.knowledge`, as stored. */
export interface StoredKnowledge {
  readonly pages: readonly StoredPage[];
  readonly readAt: string | null;
}

export const NO_KNOWLEDGE: StoredKnowledge = Object.freeze({ pages: Object.freeze([]), readAt: null });
