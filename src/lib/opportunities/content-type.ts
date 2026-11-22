// SPEC §7 — the content types, read off what the row stores, so no model decides one. An update is `ASSET_KIND_OF`'s; a
// hot page is current insights; then an offering shape, the search's first shape below, a rising search, the type's own.
import { SHAPES } from "@/lib/locale/language";
import { isRising } from "./rank/points";
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

// The shapes, in every supported language at once (D66): `SHAPES` is built from each language's own words.
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
  if (o.evidence?.family === "write" && o.evidence.hot !== undefined) return "insights";
  if (SHAPED.has(o.type) && o.evidence !== undefined && o.evidence !== null && "shape" in o.evidence && o.evidence.shape === "offering") return "offering";
  const text = (o.targetQuery ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (LISTICLE_SHAPES.test(text)) return "listicle";
  if (HOW_TO_SHAPES.test(text)) return "how_to";
  if (INSIGHTS_SHAPES.test(text) || isRising(o.evidence)) return "insights";
  if (RESEARCH_SHAPES.test(text)) return "research";
  if (DOCUMENTATION_SHAPES.test(text)) return "documentation";
  return TYPE_BY_OPPORTUNITY[o.type] ?? "qa";
}
