// Issue 1458 — what ReachKit does today, as the figures the articles quote.
//
// No figure is typed into an article (SPEC §1, 2026-10-10). Each one is read
// here from the constants the product runs on, so a comparison written today
// cannot outlive a change to the product.
import { PRICE_EUR_CENTS, SITE_PROFILE } from "@/lib/config/constants";
import { HOW_FACTS } from "../_how/facts";

export const PRODUCT = Object.freeze({
  /** "€49" */
  price: `€${PRICE_EUR_CENTS / 100}`,
  /** Google searches measured per site: "12". */
  searches: String(HOW_FACTS.searches),
  /** Questions put to AI each Monday: "25". */
  prompts: String(HOW_FACTS.prompts),
  /** The AI answers asked. */
  engines: "ChatGPT and Google AI Mode",
  /** Competitors tracked: "5". */
  competitors: String(HOW_FACTS.rivals),
  /** Pages in a week at most, new or updated: "7". */
  weekPages: String(HOW_FACTS.weekPages),
  /** New pages in a week at most: "4". The other days update a live page. */
  newPages: String(HOW_FACTS.newPages),
  /** Checks a page passes before it goes live: "20". */
  checks: String(HOW_FACTS.checks),
  /** Hours before a written page goes live on its own: "24". */
  windowHours: String(HOW_FACTS.windowHours),
  /** Links into the customer's own site per page: "3" to "6". */
  linksMin: String(HOW_FACTS.siteLinksMin),
  linksMax: String(HOW_FACTS.siteLinksMax),
  /** Pages of a site the scan reads at most: "100". */
  pages: String(SITE_PROFILE.MAX_PAGES),
});
