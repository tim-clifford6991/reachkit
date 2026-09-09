// BUILD §8 hard rule 1 — the recorded fact, in one shape.
//
// "≥1 verifiable fact from the customer's own live pages, carried with its
// source URL + read date, rendered as the highlight in the draft view."
// Three places touch that record and all three have to agree about it: the
// pipeline writes it when it writes the page, the draft view states it to
// the customer before they approve, and the hosted page marks it in the
// body a stranger reads.
//
// **They did not agree, which is issue #415.** The pipeline wrote
// `drafts.grounded_fact` — the column the migration's trigger freezes — as
// `{passage, url, readAt}`; the draft store read `drafts.meta.grounded_fact`
// as `{fact, url, read_at}`, a key nothing in `src/` has ever written. Every
// generated draft therefore reached the customer with no highlight and no
// source line, and only the fixture account's draft — whose facts are typed
// in by hand — showed one. A shape agreed by comment is a shape that drifts;
// this module is the shape, and the writer and both readers call it.
//
// **The passage is the record.** A stored value without one grounds
// nothing, so it reads as no grounding at all rather than as a grounding
// with nothing to mark. The address and the date are each allowed to be
// missing on their own: a source read but not recorded still marks its
// passage, and the line simply states less. Nothing here invents a date —
// an unparseable one is `null`, never epoch zero, which is the whole of
// issue #268's finding.
import type { GroundedFact } from "./rules/types";

/**
 * The recorded fact as anything reading `drafts.grounded_fact` gets it.
 *
 * The same three members `GroundedFact` carries, with `readAt` nullable:
 * generation always knows the day it read the source, and a row read back
 * out of jsonb may not — the column is jsonb and nothing in the database
 * constrains its shape.
 */
export interface RecordedFact {
  passage: string;
  url: string;
  readAt: Date | null;
}

/**
 * What the pipeline stores. One function, so the written keys and the read
 * keys cannot be spelled differently again.
 *
 * `readAt` is an ISO string because the value is jsonb: a `Date` would be
 * serialised by whatever the driver happened to do with it.
 */
export function recordedFactValue(fact: GroundedFact): {
  passage: string;
  url: string;
  readAt: string;
} {
  return { passage: fact.passage, url: fact.url, readAt: fact.readAt.toISOString() };
}

/**
 * `drafts.grounded_fact`, read defensively — jsonb, so every member is
 * checked rather than trusted, and a value that is not an object at all is
 * simply no grounding.
 */
export function readRecordedFact(value: unknown): RecordedFact | null {
  if (typeof value !== "object" || value === null) return null;
  const { passage, url, readAt } = value as {
    passage?: unknown;
    url?: unknown;
    readAt?: unknown;
  };
  if (typeof passage !== "string" || passage.trim() === "") return null;
  const read = typeof readAt === "string" ? new Date(readAt) : null;
  return {
    passage,
    url: typeof url === "string" ? url : "",
    readAt: read === null || Number.isNaN(read.getTime()) ? null : read,
  };
}
