// src/lib/market/prompts/misstated-types.ts — the shapes of issue 1539's
// statements and findings, in a file that imports nothing, so a screen that
// names them reaches none of the reading code (`./misstated.ts`).

export type StatedKind = "price" | "count" | "place";

/** One thing an answer stated about the business. */
export interface AnswerStatement {
  kind: StatedKind;
  /** As the answer wrote it: "€29", "500 customers", "Canada". */
  raw: string;
  /** The answer's own words around it, Markdown taken out. */
  says: string;
  /** What it is compared on: a price's currency symbol, a count's noun
   *  stem, a place's region code. */
  key: string;
  /** Every value the figure may be read as; empty for a place. */
  values: string[];
}

/** A statement of the business's own: a knowledge-base item and the page
 *  it was read from, `null` where the founder said it. */
export interface SiteFact {
  text: string;
  url: string | null;
}

export interface SiteFacts {
  /** The prices of what it sells. */
  prices: readonly SiteFact[];
  /** Everything else it states of itself. */
  statements: readonly SiteFact[];
  /** Where it is and serves. */
  places: readonly SiteFact[];
}

/** What Overview says and the next page on the topic answers. */
export interface MisstatedFact {
  kind: StatedKind;
  /** What the answer gave, as it wrote it. */
  aiSays: string;
  /** The answer's words around it. */
  answer: string;
  /** The site's statement it contradicts, word for word. */
  siteSays: string;
  url: string | null;
}
