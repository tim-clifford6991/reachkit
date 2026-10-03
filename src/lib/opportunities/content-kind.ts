// SPEC §7 (2026-10-03, D36, issue 1209) — the four kinds of page a week mixes.
//
// A comparison or listicle, an explainer, a how-to or documentation page,
// and an update of a live page. The kind is read off what the row already
// stores — its type and its target search — so nothing is judged twice and
// no model decides it (SPEC §7, 2026-09-18: the ranking only reads).
//
// An update is the asset kind `ASSET_KIND_OF` already names. A new page is
// a comparison where its type or its search says so, a how-to where the
// search asks for steps, and an explainer otherwise.
import { ASSET_KIND_OF, type Opportunity, type OpportunityType } from "./types";

export type ContentKind = "comparison" | "explainer" | "how_to" | "update";

export const CONTENT_KINDS: readonly ContentKind[] = Object.freeze([
  "comparison",
  "explainer",
  "how_to",
  "update",
]);

const HOW_TO_SHAPES =
  /^how (?:to|do|does|can|should)\b|\b(?:step by step|steps|set ?up|setup|install|configure|tutorial|guide|documentation|docs|checklist|template|troubleshoot(?:ing)?|fix)\b/;
const COMPARISON_SHAPES = /\b(?:vs|versus|alternatives?|compare|compared|comparison|best|top|reviews?)\b/;

/** The kind a new page's type gives it where its search has no shape of
 *  its own: an Earn page and a format page compare, the rest explain. */
const KIND_BY_TYPE: Readonly<Partial<Record<OpportunityType, ContentKind>>> = Object.freeze({
  comparison_page: "comparison",
  format_page: "comparison",
  listed_page: "comparison",
  answer_page: "explainer",
  keyword_page: "explainer",
});

/** `null` only for an `unblock`, which publishes no asset. */
export function contentKindOf(o: Pick<Opportunity, "type" | "targetQuery">): ContentKind | null {
  const asset = ASSET_KIND_OF[o.type];
  if (asset === null) return null;
  if (asset === "update") return "update";
  if (o.type === "comparison_page") return "comparison";
  const text = (o.targetQuery ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (COMPARISON_SHAPES.test(text)) return "comparison";
  if (HOW_TO_SHAPES.test(text)) return "how_to";
  return KIND_BY_TYPE[o.type] ?? "explainer";
}
