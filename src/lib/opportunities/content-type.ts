// SPEC §7 (2026-10-04, D41 stage 1 and D42) — the seven content types.
//
// A listicle or comparison, a how-to, a documentation page, a research page,
// a Q&A page, a current-insights page, and an update of a live page. The
// type is read off what the row already stores — its opportunity type and
// its target search — so nothing is judged twice and no model decides it
// (SPEC §7, 2026-09-18: the ranking only reads). The weekly mix (D36, issue
// 1209) rotates these.
//
// An update is the asset kind `ASSET_KIND_OF` already names. A new page
// takes the first shape its search has, in the order below, and otherwise
// its opportunity type's own: an Earn page and a format page compare, the
// rest answer the questions buyers ask.
import { ASSET_KIND_OF, isRetarget, type Opportunity, type OpportunityType } from "./types";

export type ContentType = "listicle" | "how_to" | "documentation" | "research" | "qa" | "insights" | "update";

export const CONTENT_TYPES: readonly ContentType[] = Object.freeze([
  "listicle",
  "how_to",
  "documentation",
  "research",
  "qa",
  "insights",
  "update",
]);

const LISTICLE_SHAPES = /\b(?:vs|versus|alternatives?|compare|compared|comparison|best|top|reviews?)\b/;
const HOW_TO_SHAPES =
  /^how (?:to|do i|do you|can i|should i)\b|\b(?:step by step|steps|set ?up|setup|install|configure|tutorial|checklist|template|troubleshoot(?:ing)?|fix)\b/;
const INSIGHTS_SHAPES = /\b(?:news|latest|new in|what changed|changes|updates?|trends?|this (?:year|month|week))\b/;
const RESEARCH_SHAPES = /\b(?:statistics|stats|data|study|studies|report|benchmarks?|survey|research|numbers)\b/;
const DOCUMENTATION_SHAPES =
  /^(?:what is|what are|how does|how do)\b|\b(?:documentation|docs|reference|explained|meaning|definition|guide|features?|api|integrations?)\b/;

/** The type a new page's opportunity type gives it where its search has no
 *  shape of its own. */
const TYPE_BY_OPPORTUNITY: Readonly<Partial<Record<OpportunityType, ContentType>>> = Object.freeze({
  comparison_page: "listicle",
  format_page: "listicle",
  listed_page: "listicle",
  answer_page: "qa",
  keyword_page: "qa",
});

/** `null` only for an `unblock`, which publishes no asset. A live page
 *  rewritten for a new search (D53, issue 1268) is still published as an
 *  update of its address, and is written as the new search's own type. */
export function contentTypeOf(
  o: Pick<Opportunity, "type" | "targetQuery"> & { evidence?: Opportunity["evidence"] | null }
): ContentType | null {
  const asset = ASSET_KIND_OF[o.type];
  if (asset === null) return null;
  if (asset === "update" && !isRetarget(o)) return "update";
  if (o.type === "comparison_page") return "listicle";
  const text = (o.targetQuery ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (LISTICLE_SHAPES.test(text)) return "listicle";
  if (HOW_TO_SHAPES.test(text)) return "how_to";
  if (INSIGHTS_SHAPES.test(text)) return "insights";
  if (RESEARCH_SHAPES.test(text)) return "research";
  if (DOCUMENTATION_SHAPES.test(text)) return "documentation";
  return TYPE_BY_OPPORTUNITY[o.type] ?? "qa";
}
