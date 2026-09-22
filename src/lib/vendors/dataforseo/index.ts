// BUILD §6.3 — the closed DataForSEO endpoint list, and nothing else (issue #23; WO-023 landed the shape)
//
// This file's exported set is exactly the **seven** functions the owner has
// approved — no generic `dataforseo(endpoint, params)`, no re-export of
// `transport.ts` or `envelope.ts`. `tests/vendors/never-list.test.ts`
// asserts the exported key set is exactly these seven names; adding an
// eighth export of any shape fails it by construction.
//
// **The seventh is `llmMentions`** (SPEC §6, 2026-09-22, #1004): DataForSEO
// LLM Mentions, bought weekly per site inside the Monday pass on the
// owner's ruling of that date, after the #920 pilot. The list is closed
// against endpoints the owner has not approved, not against the owner
// approving one: what it guarantees is that every DataForSEO call in the
// product passes one credential read, one ledger seam and one cap check,
// and an approved endpoint reached from anywhere else would break all
// three. `mentions.ts`'s header carries the decision in full.
//
// Everything BUILD §6.4's never-list forbids — SERP depth > 10, search operators, clickstream flags,
// Labs historical endpoints, a fourth engine, AI Keyword Data — has no
// function here to call. The never-list's one admitted exception,
// `load_async_ai_overview`, is `serpOrganic`'s required `loadAsyncAiOverview`
// argument (DECISIONS 2026-09-03 / ADR-094) and reaches the wire on no other
// function.
//
// Signatures are BP-008's `## Public interface` verbatim (archived), the
// row counts typed from the price-book pins so a count the book does not
// price is a compile error.
export { competitorsDomain, keywordSuggestions, rankedKeywords } from "./labs";
export { serpOrganic } from "./serp";
export { aiMode, llmScraper } from "./ai";
export { llmMentions } from "./mentions";
