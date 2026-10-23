// BUILD §6.3 — the closed DataForSEO endpoint list, and nothing else.
// Exactly ten approved functions: no generic `dataforseo(endpoint, params)`, no re-export of `transport.ts` or `envelope.ts`;
// `tests/vendors/never-list.test.ts` fails on an eleventh. LLM Mentions is not bought (SPEC §6), so it has no function.
// `placeLocation` is free, so it is the one export that takes no `CostContext`.
// Whatever BUILD §6.4's never-list forbids has no function here. Its one exception, `load_async_ai_overview`, is
// `serpOrganic`'s required `loadAsyncAiOverview` argument and reaches the wire nowhere else.
// Row counts are typed from the price-book pins, so a count the book does not price is a compile error.
export { competitorsDomain, keywordOverview, keywordSuggestions, rankedKeywords } from "./labs";
export { serpOrganic } from "./serp";
export { serpNews } from "./news";
export { aiMode, llmScraper } from "./ai";
export { placeLocation } from "./locations";
export { renderedPage } from "./rendered";
