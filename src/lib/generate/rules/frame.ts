// SPEC §7 (2026-09-19, issue 900) — the frame rule.
//
// **The fault this module answers.** Both drafts this product had ever
// written were advertisements for the site that pays for it. "Best SEO
// Software" opened on the category and then listed ReachKit's features;
// "Best AI SEO Software: ReachKit Writes Your Way to Discovery" put the
// brand in its own title. Three rules stopped both — `no_private_figure`,
// `brand_gap`, `no_unsourced_testimonial` — but every one of those is about
// a *claim*. Nothing was about *stance*, so a page could say only true,
// sourced, brand-free-for-300-characters things and still be a brochure
// handed to a reader who asked which product to buy.
//
// **What this rule says.** Where the target search is a question about the
// market, the page's subject is that question and the options a reader is
// choosing among. The business whose site it is may appear as one named
// option among others; it may not be the frame. A page that names it in its
// title, or in half or more of its headings, has made itself the subject and
// does not pass.
//
// **What issue 1187 measured, and took out.** The rule also failed a page for
// one heading naming the business, and for naming it more than twice. On the
// ten evaluation drafts that was wrong seven times: SPEC §7 (2026-09-29)
// requires a section on how the business itself handles the question, whose
// heading names it, and a page of 1,200 words that says so names it more than
// twice. A count of mentions is a style measure, not a violation, and is
// gone. The two stored adverts the rule was written for name the business in
// the title or in most of their headings, and still stop.
//
// **What it deliberately does not do.** It never fires on a target that is
// genuinely about this business — a search that names the brand is the
// customer's own question and the page should of course answer it about
// them. It never fires on an Improve type, whose page is one of the
// customer's own that already exists. And it decides nothing where there is
// no brand recorded and nothing where no target search is known: a rule
// that cannot decide does not fail a draft.
//
// Deterministic, no I/O. `FRAME_INSTRUCTION` is the model-facing sentence
// the drafting prompts carry, held here beside the rule that enforces it so
// the two cannot drift apart. It is not a customer-visible string.
import { FAMILY_OF, type OpportunityType } from "@/lib/opportunities/types";
import { brandTokens, namesBrand } from "./brandgap";
import { headingsOf } from "./text";
import type { RuleFailure } from "./types";

/** What the drafting prompts tell the model, where the target is the
 *  market's question. Stricter than the rule, so an ordinary page is nowhere
 *  near the bar. Model-facing only. */
export const FRAME_INSTRUCTION =
  "The target search is a question about the market, not about this business. The page's job is to " +
  "help the reader choose: what the options are, what distinguishes them, and which case each suits. " +
  "This business may be named at most once, as one option among the others — never in the title, never " +
  "in a heading, and never as the page's subject.";

export interface FrameInputs {
  /** The title as written — the first place a frame shows. */
  title: string;
  markdown: string;
  businessName: string | null;
  domain: string;
  /** The opportunity the page is written for. `null` where the caller holds
   *  no row for it, and then nothing here decides. */
  opportunityType: OpportunityType | null;
  /** The target search and every search the row absorbed. */
  queries: readonly string[];
}

/**
 * Is this page's target a question about the market rather than about the
 * customer's own brand?
 *
 * Three things have to hold. The page is one ReachKit writes to answer a
 * search the reader brought from outside — the Write and Earn families;
 * an Improve page is the customer's own page being improved and an update to
 * it is rightly about them. There is a brand recorded, so "names the brand"
 * is a question that can be answered at all. And no search the row targets
 * names that brand: a search that does is the customer's own question.
 *
 * Exported because the drafting prompt asks it too — the instruction the
 * model is given and the rule that judges the answer are the same question,
 * asked once.
 */
export function answersMarketQuestion(a: {
  opportunityType: OpportunityType | null;
  queries: readonly string[];
  businessName: string | null;
  domain: string;
}): boolean {
  if (a.opportunityType === null) return false;
  const family = FAMILY_OF[a.opportunityType];
  if (family !== "write" && family !== "earn") return false;
  const tokens = brandTokens(a);
  if (tokens.length === 0) return false;
  const queries = a.queries.filter((query) => query.trim() !== "");
  if (queries.length === 0) return false;
  return !queries.some((query) => namesBrand(query, tokens));
}

export function checkPageFrame(a: FrameInputs): RuleFailure | null {
  if (!answersMarketQuestion(a)) return null;
  const tokens = brandTokens(a);

  // The subject, as the page announces it. A title naming the seller is the
  // frame itself, whatever the body then says.
  if (namesBrand(a.title, tokens)) return { rule: "page_frame" };

  // One section about the business is the section SPEC §7 asks for. Half the
  // page's headings about it is a brochure.
  const headings = headingsOf(a.markdown);
  const naming = headings.filter((heading) => namesBrand(heading, tokens)).length;
  return naming > 0 && naming * 2 >= headings.length ? { rule: "page_frame" } : null;
}
