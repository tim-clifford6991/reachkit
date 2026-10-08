// SPEC §7 (2026-09-29 *honesty by page type*; owner, 2026-10-02, D20; issue
// 1136) — the three types of page a Write or an Earn row can be, which
// decide how the business may appear on it.
//
//   `product`            anchored on the product: the product against a
//                        rival, a rival's alternatives, the product for an
//                        audience, its price, a problem it solves. The
//                        product is the subject.
//   `market_comparison`  the market compared — a "best X", a "top X", a
//                        comparison no brand anchors. Favourable framing,
//                        never a self-ranked "#1 best" (`honest_row`).
//   `answer`             a question answered.
//
// Decided in code from what the row already stores — its type, its search
// and the source the pass gave it (§6, issue 1134) — never by a model, and
// stored on the row (`opportunities.page_type`) so the rule set is chosen
// per page. A row from before the column reads the same answer off the same
// three values.
//
// A leaf: the draft editor asks it in the browser, so it imports nothing
// that reaches the database.
import { SHAPES } from "@/lib/locale/language";
import { contentTypeOf } from "./content-type";
import { FAMILY_OF, isRetarget, type Opportunity, type PageType } from "./types";

export type { PageType };

export const PAGE_TYPES: readonly PageType[] = Object.freeze(["product", "market_comparison", "answer"]);

/** A search anchored on a product by its own words, whatever source it was
 *  found through — an AI-answer gap for "acme alternatives" is still a page
 *  about the product. */
const ANCHORED_SHAPES = SHAPES.anchored;

/** `null` for a row that writes no new page of ReachKit's: an Improve page
 *  is the customer's own, and a Fix has none. A live page of ours rewritten
 *  for a new search (issue 1268) is written whole, so it has one. */
export function pageTypeOf(
  o: Pick<Opportunity, "type" | "targetQuery" | "source" | "pageType"> & { evidence?: Opportunity["evidence"] | null }
): PageType | null {
  const family = FAMILY_OF[o.type];
  if (family !== "write" && family !== "earn" && !isRetarget(o)) return null;
  if (o.pageType !== undefined && o.pageType !== null) return o.pageType;
  const source = o.source ?? null;
  if (source === "best_x") return "market_comparison";
  if (source === "product" || source === "problem") return "product";
  if (ANCHORED_SHAPES.test((o.targetQuery ?? "").toLowerCase())) return "product";
  return contentTypeOf(o) === "listicle" ? "market_comparison" : "answer";
}
