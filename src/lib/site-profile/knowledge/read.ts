// SPEC §0 "Knowledge base" (#1133) — the base for one site, read whole: what
// the pages were read to say, with the founder's answers over it.
import { knowledgeBase, knowledgeIsEmpty } from "./merge";
import type { KnowledgeBase, KnowledgeItem, KnowledgeSource } from "./types";

/** The site's knowledge base, or `null` where nothing has been read or
 *  said — or where it could not be read, which a caller treats the same. */
export async function readKnowledgeBase(a: { siteId: string; domain: string }): Promise<KnowledgeBase | null> {
  try {
    const { readStoredKnowledge } = await import("./store");
    const { readBusinessEdits } = await import("../business/edits");
    const [stored, edits] = await Promise.all([readStoredKnowledge(a.domain), readBusinessEdits(a.siteId)]);
    const base = knowledgeBase({ stored, answers: edits.answers });
    return knowledgeIsEmpty(base) ? null : base;
  } catch {
    return null;
  }
}

/** How many items of each list the fit judgement is shown. */
const DIGEST_ITEMS = 8;

/** What fit is judged against (SPEC §6, 2026-09-29): what the business
 *  sells, to whom, for which problems, and how it differs, one passage each,
 *  with the address it was read from so a judgement can name it. */
export interface KnowledgePassage {
  readonly about: "offering" | "audience" | "problem" | "differentiator";
  readonly text: string;
  readonly source: KnowledgeSource;
  /** A page's passage its stored read does not say word for word: fit may be judged on it, but no page or brief quotes it. */
  readonly unquoted?: true;
}

export type KnowledgeDigest = readonly KnowledgePassage[];

/** The passage a new topic's fit was judged on (SPEC §6), with its address. */
export type FitFact = Pick<KnowledgePassage, "text" | "source">;

export function knowledgeDigest(base: KnowledgeBase): KnowledgeDigest {
  const items = (about: KnowledgePassage["about"], list: readonly KnowledgeItem[]): KnowledgePassage[] =>
    list.slice(0, DIGEST_ITEMS).map((item) => ({ about, text: item.text, source: item.source }));
  return [
    ...base.offerings.slice(0, DIGEST_ITEMS).map((offering) => ({
      about: "offering" as const,
      text: [offering.name, ...offering.uses.slice(0, 3)].join("; "),
      source: offering.source,
    })),
    ...items("audience", base.audience),
    ...items("problem", base.problems),
    ...items("differentiator", base.differentiators),
  ];
}

/** Keeps a fit fact only where its page's stored read says it (hard rule 1's check, once, where a fit fact is stored). */
export async function fitFactsQuoted(siteId: string): Promise<(fit: FitFact | null | undefined) => FitFact | null> {
  const { readAllFacts, fitFactRead } = await import("@/lib/generate/pipeline/grounding");
  const facts = await readAllFacts({ siteId });
  return (fit) => fitFactRead(fit, facts);
}

/** The digest with each page passage its read does not say marked `unquoted`; where the reads fail, every page passage is. */
export async function quotedDigest(siteId: string, digest: KnowledgeDigest): Promise<KnowledgeDigest> {
  const quoted = await fitFactsQuoted(siteId).catch(() => null);
  return digest.map((passage) => (passage.source.kind === "page" && quoted?.(passage) == null ? { ...passage, unquoted: true as const } : passage));
}
