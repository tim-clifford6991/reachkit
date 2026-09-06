// src/lib/market/views.ts — BUILD §6.6
//
// The narrow structural reads the pure market leaves take from shapes
// another leaf owns. Nothing here is a second declaration of one of those
// shapes (rule 2.4): each interface below is a *subset* of the fields the
// owning leaf declares, so the owner's real value satisfies it
// structurally, with no import and no conversion at the call site.
//
// Why the subsets exist at all. `deriveRivals`, `buildPresenceCard`,
// `buildAiAnswersCard` and `checkCoherence` count over SERPs the scan has
// already bought — §6.6's "Zero extra cost". That promise is held
// structurally: none of those modules resolves an import into
// `src/lib/vendors/`, `src/lib/costs/` or `src/lib/llm/`, so none of them
// has a function to call that could spend anything, and their tests assert
// exactly that over the module source. A type-only import of the vendor's
// `SerpResult` would be erased before the bundle exists and could not
// itself buy anything, but it would put the import path back into the
// files whose absence is the proof — so the shape is restated here, once,
// rather than four times inside four leaves.
//
// `src/lib/market/coherence/check.ts` declared its own copy of the
// organic-only view and flagged the duplication for the architect to
// resolve here; `MarketSerpOrganic` is that resolution, and that file now
// reads this one.
//
// `SelectedSearchView` and `QuestionView` are the same arrangement for the
// two shapes `src/lib/market/questions/{select,phrase}.ts` will declare
// (ADR-095, BP-025's `SelectedSearch` and `Question`, issue #26): the card
// builders here read a search's keyword and volume and a question's
// wording, id and phrasing, and nothing else of either. When those files
// land, their values satisfy these views unchanged.

/** The organic-only read: `checkCoherence` counts appearances of a domain
 *  across top tens and never touches an AI Overview. Position is not part
 *  of it — a SERP is bought at depth 10 and fixed there
 *  (`src/lib/vendors/dataforseo/transport.ts`), so every organic row on it
 *  is a top-ten row. */
export interface MarketSerpOrganic {
  organic: readonly { domain: string }[];
}

/** One organic row, as the leaves that need a *rank* read it — the
 *  presence card's `topHolder` is "the domain at position 1". */
export interface MarketOrganicRow {
  position: number;
  domain: string;
}

/** The AI Overview of one SERP as the market leaves read it: whether
 *  Google served one at all, and which domains it cited. The vendor's own
 *  `asynchronousAiOverview` flag is deliberately absent — it prices the
 *  call (ADR-094 d3) and says nothing about the answer, and no card here
 *  may branch on it. Which AI answers a card could see at all is its
 *  `coverage`, decided by the caller. */
export interface MarketAiOverview {
  present: boolean;
  referenceDomains: readonly string[];
}

/** One battery engine's answer, as the AI-answers card reads it (§6.2's
 *  ChatGPT std and AI Mode std): whether the engine answered at all and
 *  which domains it cited. The vendor's `AiAnswer` satisfies this
 *  structurally, exactly as `MarketSerp` is satisfied by `SerpResult`.
 *
 *  **`text` is deliberately absent, and its absence is the point.** The
 *  engine's own prose is generated text; a card with a field to carry it
 *  is a card a surface could render it from unlabelled, which `CLAUDE.md`
 *  forbids ("No generated prose anywhere except draft page content,
 *  always labelled"). What the product measures about an AI answer is
 *  whether it appeared and whom it named — both of which are here. */
export interface MarketAiAnswer {
  answered: boolean;
  citedDomains: readonly string[];
}

/** A bought SERP, as the rival derivation and the two cards read it. */
export interface MarketSerp extends MarketSerpOrganic {
  organic: readonly MarketOrganicRow[];
  aiOverview: MarketAiOverview;
}

/** One of the searches the market set selected — the keyword the SERP was
 *  bought for and its monthly volume. Volume is read to *order* and to
 *  *label* the presence card's absent-from list and is never summed: the
 *  market-total footnote was removed by the owner on 2026-09-03
 *  (DECISIONS, both halves). */
export interface SelectedSearchView {
  keyword: string;
  volume: number;
}

/** One of the twelve questions, as the AI-answers matrix reads it. The
 *  matrix keys its rows on `id` and carries `text`, `phrasing` and the
 *  search's `keyword` — never the volume, which has no field to travel in
 *  on that card (per-question `{vol}/mo` was removed by the owner on
 *  2026-09-03). */
export interface QuestionView {
  id: string;
  text: string;
  phrasing: "template" | "model";
  search: SelectedSearchView;
}
