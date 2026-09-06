// BUILD §8 hard rule 3 — not a doorway.
//
// "Answers the target question before naming the product (checked: first
// 300 chars contain no brand mention)." The 300 is `GENERATION.brandGapChars`
// and is counted over the words a reader of the published page meets — not
// over the Markdown that produces them, because a link's address is not
// something a reader reads and a heading's `##` is not a character they
// count.
//
// The brand is two stored values: the business name recorded for the site
// and its domain. A site that records neither has no brand to name, and the
// rule passes rather than guessing one.
import { GENERATION } from "@/lib/config/constants";
import type { RuleFailure } from "./types";

/** The domain matches on its own registrable label as well as whole — a
 *  page that says "Acme" in its opening line is naming the brand whether or
 *  not it writes "acme.com". Every match is case-insensitive, per §8. */
function brandTokens(a: { businessName: string | null; domain: string }): string[] {
  const tokens: string[] = [];
  const name = a.businessName?.trim() ?? "";
  if (name.length > 0) tokens.push(name);
  const domain = a.domain.trim();
  if (domain.length > 0) {
    tokens.push(domain);
    const label = domain.split(".")[0] ?? "";
    // A one- or two-letter label is not a brand mention: it matches inside
    // ordinary words and would fail every draft for a site on a short
    // domain.
    if (label.length > 2) tokens.push(label);
  }
  return tokens;
}

export function checkBrandGap(a: {
  rendered: string;
  businessName: string | null;
  domain: string;
}): RuleFailure | null {
  const opening = a.rendered.slice(0, GENERATION.brandGapChars).toLowerCase();
  for (const token of brandTokens(a)) {
    if (opening.includes(token.toLowerCase())) return { rule: "brand_gap" };
  }
  return null;
}
