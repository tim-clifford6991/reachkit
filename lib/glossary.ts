/**
 * Plain-English glossary for de-jargoning the dashboard (§7). Keyed by the term
 * as it appears in the UI; consumed by the InfoTip component.
 */
export const GLOSSARY: Record<string, string> = {
  "Discoverability Score":
    "A 0–100 measure of how findable your product is, built from 18 verified signals across Content, Outreach, and SEO.",
  Content: "How much substantive, discoverable content you publish (depth, cadence, owned channels).",
  Outreach: "Your presence where buyers look — marketplaces, communities, comparison pages, and press.",
  SEO: "How well your pages are structured and ranked for the queries buyers actually search.",
  Delta: "Change since your previous scan.",
  ETV: "Estimated Traffic Value — the approximate monthly search traffic a page attracts.",
  "Share of voice": "Your slice of the community mentions in your space, versus competitors.",
  "Rank depth": "How far into search results we looked when checking your rankings.",
  Opportunity: "How worth-it a keyword is — high search volume with few rivals ranking is best.",
  Discoverability: "Your 0–100 Discoverability Score — how findable your product is, from 18 verified signals.",
  "Organic keywords": "How many distinct search queries your site already ranks for.",
  "Keyword gaps": "Queries your rivals rank for that you don't — ready-made content targets.",
  "Signals passing": "How many of the 18 measured discoverability signals are in good shape.",
};
