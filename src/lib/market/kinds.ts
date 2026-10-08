// src/lib/market/kinds.ts — the kinds of business a market conclusion
// records (SPEC §6, owner D69 of 2026-10-07, issue 1318).
//
// Data, not code: a kind is one row. The market call chooses one by its
// `is` line, the tracked buyer prompts are worded per kind and language
// (`src/lib/locale/language/prompts/`), and no stage names a kind itself.
//
// Pure: no I/O, no clock. Safe to import from anywhere.

export const BUSINESS_KINDS = Object.freeze({
  "local-service": Object.freeze({
    is: "a service carried out for the customer in person: a trade, a clinic or practice, a salon, a repair shop, a gym",
    placed: true,
  }),
  shop: Object.freeze({
    is: "sells physical goods: an online shop, or a shop, bakery or maker with premises",
    placed: true,
  }),
  hospitality: Object.freeze({
    is: "a restaurant, café, bar, hotel or venue",
    placed: true,
  }),
  "professional-services": Object.freeze({
    is: "sells expertise by the engagement: a legal, accounting, consulting, design or marketing firm, or an agency",
    placed: true,
  }),
  software: Object.freeze({
    is: "a software product, platform or app",
    placed: false,
  }),
  creator: Object.freeze({
    is: "a person or small team selling courses, lessons, books, a newsletter or other teaching",
    placed: false,
  }),
} as const satisfies Record<string, KindRow>);

interface KindRow {
  /** What the market call is told this kind is. */
  is: string;
  /** Whether a business of this kind can be one that serves one place, so
   *  its prompts name the place (D67). Software and teaching are bought
   *  from anywhere. */
  placed: boolean;
}

export type BusinessKind = keyof typeof BUSINESS_KINDS;

export const BUSINESS_KIND_NAMES = Object.freeze(Object.keys(BUSINESS_KINDS) as BusinessKind[]);

/** The kind every site was read as before D69: its prompts are the ones
 *  written for a software product. */
export const DEFAULT_KIND: BusinessKind = "software";

export function isBusinessKind(value: unknown): value is BusinessKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BUSINESS_KINDS, value);
}
