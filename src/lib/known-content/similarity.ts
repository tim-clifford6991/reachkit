// SPEC §7 (2026-09-20, #928) — "Known content": how close two topics are.
//
// One number, between a planned page's topic and a page the site already
// has. It decides whether the planned page is a repeat, so it is the one
// measure and it is recorded on the row that used it.
//
// **Trigram set similarity, as `pg_trgm` defines it.** A string is
// lower-cased, split on anything that is not a letter or a digit, and each
// word contributes the trigrams of `"  word "` — two leading spaces and one
// trailing — which is the padding the extension uses, so a short word still
// yields trigrams and a word boundary is part of what is compared. The
// score is `|A ∩ B| / |A ∪ B|`.
//
// **Why that definition and not another.** The shortlist this scores is
// read out of Postgres, where the index is `gin (title gin_trgm_ops)` and
// the narrowing operator is `%` — so narrowing and scoring measure the same
// thing, and a page the database offered cannot be scored by a rule the
// database never applied. It is also symmetric, order-independent, and
// stable under rewording that keeps the words: "Time tracking for agencies"
// and "Agency time tracking" share most of their trigrams.
//
// **It is not `rules/similarity.ts`.** That one is Jaccard over five-word
// shingles of a *rendered page* — the near-duplicate gate on the words a
// reader meets, after a draft is written (BUILD §8 hard rule 5). This one
// compares *topics* — a title, its headings and a target search — before a
// page is planned. Two measures because they answer two questions at two
// moments; neither is a setting and neither takes a threshold argument.

/** The trigrams of one string, `pg_trgm`'s own way. */
export function trigrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word === "") continue;
    const padded = `  ${word} `;
    for (let start = 0; start + 3 <= padded.length; start++) {
      out.add(padded.slice(start, start + 3));
    }
  }
  return out;
}

/**
 * How alike two topics are, 0 to 1.
 *
 * Two texts with no words are identical (1) — neither says anything, and
 * calling that a repeat of nothing is the answer a caller can act on. One
 * empty text shares nothing with a text that says something (0).
 */
export function topicSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared++;
  return shared / (left.size + right.size - shared);
}
