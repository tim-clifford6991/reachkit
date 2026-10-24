// SPEC §7 (2026-10-04, D41 stage 1 and D42) — the content types.
//
// A listicle or comparison, a how-to, a documentation page, a research page,
// a Q&A page, a current-insights page, an update of a live page, and an
// offering page: the business's own service or product page, where the
// search's results are mostly such pages (owner ruling B6, 2026-10-19). The
// type is read off what the row already stores — its opportunity type and
// its target search — so nothing is judged twice and no model decides it
// (SPEC §7, 2026-09-18: the ranking only reads). The weekly mix (D36, issue
// 1209) rotates these.
//
// An update is the asset kind `ASSET_KIND_OF` already names. A new page
// takes the first shape its search has, in the order below, and otherwise
// its opportunity type's own: an Earn page and a format page compare, the
// rest answer the questions buyers ask. A new page whose stored results
// page asks for a provider's own page (`evidence.shape`, set by readiness)
// is an offering page ahead of its words.
import { SHAPES } from "@/lib/locale/language";
import { ASSET_KIND_OF, isRetarget, type Opportunity, type OpportunityType } from "./types";

export type ContentType = "listicle" | "how_to" | "documentation" | "research" | "qa" | "insights" | "update" | "offering";

export const CONTENT_TYPES: readonly ContentType[] = Object.freeze([
  "listicle",
  "how_to",
  "documentation",
  "research",
  "qa",
  "insights",
  "update",
  "offering",
]);

// The shapes, in every supported language at once (D66): `SHAPES` is built
// from each language's own words.
const LISTICLE_SHAPES = SHAPES.listicle;
const HOW_TO_SHAPES = SHAPES.guide;
const INSIGHTS_SHAPES = SHAPES.insights;
const RESEARCH_SHAPES = SHAPES.research;
const DOCUMENTATION_SHAPES = SHAPES.documentation;

/** The new pages whose results page may make them offering pages. */
export const SHAPED: ReadonlySet<OpportunityType> = new Set(["keyword_page", "answer_page", "listed_page"]);

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
  if (SHAPED.has(o.type) && o.evidence !== undefined && o.evidence !== null && "shape" in o.evidence && o.evidence.shape === "offering") return "offering";
  const text = (o.targetQuery ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (LISTICLE_SHAPES.test(text)) return "listicle";
  if (HOW_TO_SHAPES.test(text)) return "how_to";
  if (INSIGHTS_SHAPES.test(text)) return "insights";
  if (RESEARCH_SHAPES.test(text)) return "research";
  if (DOCUMENTATION_SHAPES.test(text)) return "documentation";
  return TYPE_BY_OPPORTUNITY[o.type] ?? "qa";
}
