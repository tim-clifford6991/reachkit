// SPEC §7 (owner, D13, 2026-09-29; issue 1144) — no near-identical page
// across customers.
//
// Google's site reputation abuse policy names near-duplicate content placed
// on many hosts as what it acts on, and ReachKit writing for several
// businesses in one market is where two of them could be handed nearly the
// same page. So a page the rules passed is compared, before it can enter
// review, with every draft and live page written for **other** sites in the
// last twelve months.
//
// **The same measure and the same bar as the same-site check**
// (`../rules/similarity.ts`, `NEAR_DUPLICATE_MAX`): one notion of "nearly the
// same page" in the product, and no second threshold to drift from it.
//
// **Nothing of the other page leaves this file.** The store hands over text
// alone — no id, no title, no site — and what is returned is a number and
// this draft's *own* sentences that the other page also says. Those are what
// the one rewrite is told to keep away from, so the writer is never shown a
// sentence this site's page did not already hold, and the founder is told
// only that the page was held (`publish.needs-you.elsewhere`).
//
// Not a hard rule: a rule's failure is listed on the draft with the page it
// duplicated, and this one has no page it may name.
import { ELSEWHERE, NEAR_DUPLICATE_MAX } from "@/lib/config/constants";
import { similarity } from "../rules/similarity";
import { renderOf, sentencesOf } from "../rules/text";
import { generateStore } from "../store";

export interface CloseElsewhere {
  /** How close the nearest page at or above the bar is, 0 to 1. */
  similarity: number;
  /** This draft's own sentences that page also says, at most
   *  `ELSEWHERE.noteSentences`. */
  sentences: string[];
}

/** Letters and digits, lowercased — the words `similarity` compares. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * The nearest page written for another site, where it is as close as the
 * near-duplicate bar — or `null` where none is.
 */
export async function closeElsewhere(a: {
  siteId: string;
  markdown: string;
  now?: Date;
}): Promise<CloseElsewhere | null> {
  const since = new Date(a.now ?? new Date());
  since.setUTCMonth(since.getUTCMonth() - ELSEWHERE.months);
  const others = await generateStore().pagesElsewhere(a.siteId, since, ELSEWHERE.pagesMax);
  if (others.length >= ELSEWHERE.pagesMax) {
    console.warn(JSON.stringify({ event: "elsewhere_read_capped", siteId: a.siteId, pages: others.length }));
  }

  const rendered = renderOf(a.markdown);
  let nearest: { score: number; rendered: string } | null = null;
  for (const markdown of others) {
    const other = renderOf(markdown);
    const score = similarity(rendered, other);
    if (score >= NEAR_DUPLICATE_MAX && (nearest === null || score > nearest.score)) {
      nearest = { score, rendered: other };
    }
  }
  if (nearest === null) return null;

  const theirs = ` ${plain(nearest.rendered)} `;
  const shared = sentencesOf(a.markdown)
    .map((sentence) => sentence.text)
    .filter((text) => {
      const words = plain(text);
      return words !== "" && theirs.includes(` ${words} `);
    });
  return {
    similarity: nearest.score,
    sentences: [...new Set(shared)].slice(0, ELSEWHERE.noteSentences),
  };
}
