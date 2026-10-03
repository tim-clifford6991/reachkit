// BUILD §8 hard rule 3 — not a doorway.
//
// BUILD §14 guardrail 4 — no doorway pages.
//
// "Answers the target question before naming the product." The page's first
// sentence — and any heading standing above it — is where it answers or
// advertises: "Acme is the best CRM because…" has named the product before
// it has answered anything.
//
// **It was a 300-character window until issue 1187.** Measured, the window
// stopped three of the ten evaluation drafts for an answer box that names
// the options and has the business among them in its second or third
// sentence — which SPEC §7 (2026-09-29, *honesty by page type*) asks a page
// to do. Every real advert the window caught among the stored drafts names
// the business in its first sentence or the heading above it, and those are
// what the rule reads now.
//
// **A search that names the business is the customer's own question**, and
// its page opens on them. The rule decides nothing there, as `./frame.ts`
// decides nothing there.
//
// The brand is two stored values: the business name recorded for the site
// and its domain. A site that records neither has no brand to name, and the
// rule passes rather than guessing one.
import { blocksOf, sourceBlocksOf, splitSentences, renderOf } from "./text";
import type { RuleFailure } from "./types";

/** The domain matches on its own registrable label as well as whole — a
 *  page that says "Acme" in its opening line is naming the brand whether or
 *  not it writes "acme.com". Every match is case-insensitive, per §8.
 *
 *  Exported because the frame rule (`./frame.ts`, issue 900) asks the same
 *  question of the title, the headings and the whole body: what counts as
 *  naming this business is one answer, given here. */
export function brandTokens(a: { businessName: string | null; domain: string }): string[] {
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

const REGEXP_SPECIAL_RE = /[.*+?^${}()|[\]\\]/g;

/** One alternation, longest token first, so `example.com` is one mention and
 *  not also a second one for the `example` inside it — and bounded at both
 *  ends, so a site whose registrable label is an ordinary word is not read as
 *  naming itself every time that word appears inside another. */
export function brandRegExp(tokens: readonly string[]): RegExp {
  const ordered = [...tokens]
    .sort((x, y) => y.length - x.length)
    .map((token) => token.replace(REGEXP_SPECIAL_RE, "\\$&"));
  return new RegExp(`\\b(?:${ordered.join("|")})\\b`, "gi");
}

export function namesBrand(text: string, tokens: readonly string[]): boolean {
  return tokens.length > 0 && brandRegExp(tokens).test(text);
}

/** The words the page opens on: every heading above its first paragraph, and
 *  that paragraph's first sentence. */
export function openingOf(markdown: string): string[] {
  const source = sourceBlocksOf(markdown);
  const blocks = blocksOf(markdown);
  const out: string[] = [];
  for (let at = 0; at < blocks.length; at++) {
    const block = blocks[at]!;
    if (block.heading) {
      out.push(block.text);
      continue;
    }
    const first = splitSentences(source[at]!.raw)[0] ?? "";
    out.push(renderOf(first).replace(/\s+/g, " ").trim());
    break;
  }
  return out;
}

export function checkBrandGap(a: {
  markdown: string;
  businessName: string | null;
  domain: string;
  /** The target search and every search the row absorbed. */
  queries: readonly string[];
}): RuleFailure | null {
  const tokens = brandTokens(a);
  if (a.queries.some((query) => namesBrand(query, tokens))) return null;
  return openingOf(a.markdown).some((words) => namesBrand(words, tokens)) ? { rule: "brand_gap" } : null;
}
