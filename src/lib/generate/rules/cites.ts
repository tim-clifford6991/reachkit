// SPEC §7 (2026-10-17, issue 1486) — `cites_market`: a how-to or a Q&A is
// built from cited outside facts.
//
// Found by the content review of 17 October: page D's pack held 24 claims
// read off six public pages, and its body linked none of them; seven of its
// ten steps were the business's own features. The template now asks the pack
// for claims off `CITES_MARKET.min` pages (`../templates`), and this rule
// holds the body to linking at least that many of them, in its own words —
// the *Sources* list is code's and is read off the links (`../pipeline/
// sources.ts`), so the rules read the page without it.
//
// A page is distinct by its address as `urlKey` compares it, and only a page
// the pack holds a claim from counts: an address the writer reached for on
// its own sources nothing.
//
// **It binds what ReachKit generates.** A caller that passes no `cites` — a
// founder's own edit, or a type not built from outside facts — is asked
// nothing.
import { urlKey } from "../links/select";
import { linksOf } from "./text";
import type { RuleFailure } from "./types";

export interface CitesRuleInputs {
  /** The addresses of the pack's market claims. */
  claimUrls: readonly string[];
  /** How many distinct ones the body must link. */
  min: number;
}

/** How many of the pack's claim pages the body links, each once. */
export function citedSources(markdown: string, claimUrls: readonly string[]): number {
  const claimed = new Set(claimUrls.map(urlKey).filter((key) => key !== null));
  return new Set(linksOf(markdown).map(urlKey).filter((key) => key !== null && claimed.has(key))).size;
}

export function checkCitesMarket(a: { markdown: string; cites: CitesRuleInputs | null }): RuleFailure | null {
  if (a.cites === null) return null;
  const cited = citedSources(a.markdown, a.cites.claimUrls);
  return cited >= a.cites.min ? null : { rule: "cites_market", detail: { rule: "cites_market", cited, min: a.cites.min } };
}
