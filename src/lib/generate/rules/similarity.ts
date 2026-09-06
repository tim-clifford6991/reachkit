// BUILD §8 hard rule 5 — the one recorded similarity measure.
//
// Jaccard over the set of 5-word shingles of the rendered text, lowercased
// with punctuation stripped and stop-words kept. Set-based, so it is
// symmetric and order-independent; five words because a shorter window
// makes two pages about one subject look alike on shared terminology, and a
// longer one misses a rewritten near-copy.
//
// **Two strings in, one number out.** There is no options parameter, no
// threshold argument and no configuration — so there is no argument through
// which a per-customer threshold could arrive, and §8's 85% cannot become a
// setting by accident. `SHINGLE_SIZE` is a pin, read here and nowhere else
// in this directory.
//
// Nothing is stored: no shingle table, no cached score. At one page a day
// this is a few hundred comparisons of in-memory sets once per draft, and
// recomputing costs less than the rows a cache would need. Changing
// `SHINGLE_SIZE` therefore changes future verdicts and rewrites no history.
import { SHINGLE_SIZE } from "@/lib/config/constants";

/** Lowercase, punctuation to spaces, runs of whitespace collapsed. Stop
 *  words are kept: they are what make a rewritten near-copy still read as
 *  the same sentences. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word.length > 0);
}

/** The set of `SHINGLE_SIZE`-word windows. A text shorter than the window
 *  is one shingle of itself, so two identical short texts still measure 1
 *  rather than 0/0. */
function shingles(text: string): Set<string> {
  const tokens = words(text);
  const out = new Set<string>();
  if (tokens.length === 0) return out;
  if (tokens.length <= SHINGLE_SIZE) {
    out.add(tokens.join(" "));
    return out;
  }
  for (let start = 0; start + SHINGLE_SIZE <= tokens.length; start++) {
    out.add(tokens.slice(start, start + SHINGLE_SIZE).join(" "));
  }
  return out;
}

/** Exact Jaccard: |A ∩ B| / |A ∪ B|. Two empty texts are identical (1);
 *  one empty text shares nothing with a non-empty one (0). */
export function similarity(a: string, b: string): number {
  const left = shingles(a);
  const right = shingles(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const shingle of left) {
    if (right.has(shingle)) intersection++;
  }
  return intersection / (left.size + right.size - intersection);
}
