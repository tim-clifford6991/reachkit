// Issue 1458 — the shapes of the pages Google still ranks from ReachKit's
// earlier versions: comparisons, teardowns and one answer page.
//
// They are editorial articles, like a customer's hosted page, so their words
// live here as data and the routes render them. The screen's own words — the
// section names, the controls, the one call to scan — are copy keys.
//
// Every title is at most six words, one idea and no dash (SPEC §0,
// 2026-10-15). A fact about another company carries the page it was read
// from and the date it was read.

/** A page another company publishes about itself, read on `checked`. */
export interface Source {
  readonly label: string;
  readonly href: string;
}

export interface Section {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

/** `true` the product does it, `false` it does not, a string where it does
 *  part of it, saying which part. */
export type Cell = boolean | string;

export interface ComparisonRow {
  readonly label: string;
  readonly reachkit: Cell;
  readonly them: Cell;
}

export type ComparisonGroup = "suite" | "checker" | "competitors" | "audience" | "ai" | "data";

/** The five jobs a page takes, in the order a tool page lists them. */
export type Job = "choose" | "facts" | "write" | "live" | "results";

export interface Comparison {
  /** The address segment, unchanged since the page was first published. */
  readonly slug: string;
  /** The other product, as it names itself. */
  readonly name: string;
  readonly group: ComparisonGroup;
  /** The card's heading and document title: at most six words, no dash. */
  readonly title: string;
  /** The page's own heading, where it says more than the card: at most six words. */
  readonly heading?: string;
  /** A word on the card the reader needs before clicking, e.g. the product closed. */
  readonly badge?: string;
  /** The meta description, at most 160 characters. */
  readonly description: string;
  /** One line on the index card, at most 20 words: theirs, then ". ReachKit …". */
  readonly summary: string;
  /** The opening paragraph: the answer to "which one do I need?". */
  readonly intro: string;
  /** What the other product does well. */
  readonly theirs: Section;
  /** A request the reader would type into the other product, where it is a chat. */
  readonly ask?: string;
  /** The jobs the other product does or helps with; the reader does the rest. */
  readonly does: readonly Job[];
  readonly rows: readonly ComparisonRow[];
  /** When the other product is the better pick. */
  readonly pickThem: readonly string[];
  /** When ReachKit is. */
  readonly pickUs: readonly string[];
  /** The day the facts about the other product were read, ISO `YYYY-MM-DD`. */
  readonly checked: string;
  readonly sources: readonly Source[];
}

/** One numbered place on a sketched page: what we read there, in our
 *  words, and the page's own words quoted. */
export interface SketchMark {
  readonly title: string;
  readonly line: string;
  readonly quotes: readonly string[];
}

export interface Teardown {
  readonly slug: string;
  readonly name: string;
  /** The site the teardown reads, e.g. `plausible.io`. */
  readonly domain: string;
  /** At most six words, no dash. */
  readonly title: string;
  readonly description: string;
  readonly summary: string;
  readonly intro: string;
  readonly sections: readonly Section[];
  readonly takeaways: readonly string[];
  /** First published, ISO date. */
  readonly written: string;
  /** Last read against the live site, ISO date. */
  readonly revised: string;
  /** Last read again with nothing to revise, ISO date, where later. */
  readonly checked?: string;
  /** A greyscale wireframe of the home page, never a screenshot or a logo. */
  readonly sketch?: readonly SketchMark[];
  readonly sources: readonly Source[];
}

export interface Answer {
  readonly slug: string;
  /** The question in the words people search it: the page's heading. */
  readonly title: string;
  readonly description: string;
  /** The answer, before any product is named. */
  readonly answer: readonly string[];
  readonly sections: readonly Section[];
  readonly faq: readonly { readonly q: string; readonly a: string }[];
  readonly checked: string;
  readonly sources: readonly Source[];
}
