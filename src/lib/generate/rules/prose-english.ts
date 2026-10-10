// SPEC §7 (owner, 2026-10-10, issue 1390) — what the prose check reads on an
// English page beside its counts: the turns of phrase a model reaches for.
//
// Two sources, counted together as the page's tell phrases:
//
//   * the five constructions the owner named that no library rule reads
//     (`OWN_TELLS`), each one row of data;
//   * what `slopless` flags (`./prose-lint.ts`): the "not X, it's Y" reframe,
//     the summary ending, signposting, a model's stock vocabulary.
//
// `proseFaults` stops a page for one construction used
// `PROSE.tellPhrases.samePattern` times, or for `PROSE.tellPhrases.most` of
// them together — so one "looking ahead" a founder would also write stops
// nothing.
//
// `AVOID_LIST` is the same habits as the writer is told them: the page is
// asked not to write what it would be stopped for.

/** One turn of phrase as the page has it. */
export interface Tell {
  /** Which habit: a row of `OWN_TELLS` or a `slopless` rule, by its id. */
  pattern: string;
  /** The page's own words. */
  text: string;
  count: number;
  /** A single word of a model's stock vocabulary, which is counted with the
   *  rest and is not a construction a page can be stopped for repeating. */
  word?: true;
}

const OWN_TELLS: readonly { pattern: string; re: RegExp }[] = Object.freeze([
  { pattern: "this-matters", re: /\b(?:(?:why|here(?:'|’)s why) (?:this|it|that) matters|this matters|that matters because)\b/gi },
  { pattern: "more-than", re: /\b(?:is|are|was) (?:far |much |so much )?more than (?:just )?(?:an? |the )?[^.!?;]{2,60}?[,;—–-]+\s*(?:it|they|this)(?:'|’)?(?: is|s| are|re)\b/gi },
  { pattern: "less-more", re: /\bless (?:like |of |about )?[^.!?,;]{2,40}(?:,| and| —| –) (?:and )?more (?:like |of |about )?\b/gi },
  { pattern: "looking-ahead", re: /\b(?:looking ahead|moving forward|going forward|in the years to come)\b/gi },
  { pattern: "serves-as", re: /\b(?:serves?|stands?) as (?:an? |the )|\ba testament to\b/gi },
]);

/** The habits the check counts, as the writer is told them. */
export const AVOID_LIST: readonly string[] = Object.freeze([
  '"this matters", "why it matters", "here\'s why"',
  '"is more than a …, it is …"',
  '"less X, more Y"',
  '"not X, it\'s Y", "isn\'t just X — it\'s Y", "not only … but also"',
  '"looking ahead", "moving forward"',
  '"serves as", "stands as", "a testament to"',
  'an ending that sums up: "in summary", "in conclusion", "ultimately", "the bottom line", "at the end of the day"',
  'signposting: "let\'s dive in", "here\'s what you need to know", "in this guide", "it\'s worth noting", "when it comes to"',
  '"delve", "tapestry", "landscape", "realm", "leverage", "seamless", "robust", "pivotal", "crucial", "elevate", "unlock", "empower", "harness", "streamline", "game-changer", "cutting-edge"',
  "three items in a row where one or two would do",
  "a label repeated down a list (\"— result:\", \"Why it matters:\")",
]);

/** The owner-named constructions an English text carries. */
export function ownTells(text: string): Tell[] {
  const counts = new Map<string, Tell>();
  for (const tell of OWN_TELLS) {
    tell.re.lastIndex = 0;
    for (const match of text.matchAll(tell.re)) {
      const found = match[0].replace(/\s+/g, " ").trim().toLowerCase();
      const key = `${tell.pattern}\n${found}`;
      const held = counts.get(key);
      if (held === undefined) counts.set(key, { pattern: tell.pattern, text: found, count: 1 });
      else held.count++;
    }
  }
  return [...counts.values()];
}
