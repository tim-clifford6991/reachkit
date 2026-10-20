// BUILD §6.3 — the closed DataForSEO endpoint list, and nothing else (issue #23; WO-023 landed the shape)
//
// This file's exported set is exactly the **ten** functions the owner has
// approved — no generic `dataforseo(endpoint, params)`, no re-export of
// `transport.ts` or `envelope.ts`. `tests/vendors/never-list.test.ts`
// asserts the exported key set is exactly these ten names; adding an
// eleventh export of any shape fails it by construction. LLM Mentions is
// not bought (SPEC §6 decision of 2026-10-19), so it has no function here.
//
// **The seventh is `serpNews`** (SPEC §7, owner D48, 2026-10-04, issue 1259):
// Google News, which *current insights* reads for what its market published
// in the last 30 days. `news.ts`'s header carries it.
//
// **The eighth is `keywordOverview`** (SPEC §6, owner D49, 2026-10-05, issue
// 1270): Labs keyword overview, one call a pass for the search volume of a
// market's candidate terms.
//
// **The ninth is `placeLocation`** (SPEC §6, owner D67, 2026-10-07, issue
// 1318): the vendor's own list of the cities Google's results can be read
// from, looked up once for a site that serves one place. The vendor charges
// nothing for it, so it is the one export that takes no `CostContext`.
// `locations.ts`'s header carries it.
//
// **The tenth is `renderedPage`** (SPEC §6, 2026-10-10, issue 1374): one
// page of the customer's own site as a browser draws it, bought only for a
// site that serves an empty JavaScript shell. `rendered.ts`'s header
// carries it.
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
export { competitorsDomain, keywordOverview, keywordSuggestions, rankedKeywords } from "./labs";
export { serpOrganic } from "./serp";
export { serpNews } from "./news";
export { aiMode, llmScraper } from "./ai";
export { placeLocation } from "./locations";
export { renderedPage } from "./rendered";
