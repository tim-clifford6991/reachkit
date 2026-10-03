// SPEC §0 "Knowledge base" (#1133) — the base for one site, read whole: what
// the pages were read to say, with the founder's answers over it.
import { knowledgeBase, knowledgeIsEmpty } from "./merge";
import type { KnowledgeBase } from "./types";

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
 *  sells, to whom, for which problems, and how it differs — texts only. */
export interface KnowledgeDigest {
  readonly offerings: readonly { readonly name: string; readonly uses: readonly string[] }[];
  readonly audience: readonly string[];
  readonly problems: readonly string[];
  readonly differentiators: readonly string[];
}

export function knowledgeDigest(base: KnowledgeBase): KnowledgeDigest {
  const texts = (items: readonly { text: string }[]): string[] =>
    items.slice(0, DIGEST_ITEMS).map((item) => item.text);
  return {
    offerings: base.offerings
      .slice(0, DIGEST_ITEMS)
      .map((offering) => ({ name: offering.name, uses: offering.uses.slice(0, 3) })),
    audience: texts(base.audience),
    problems: texts(base.problems),
    differentiators: texts(base.differentiators),
  };
}
