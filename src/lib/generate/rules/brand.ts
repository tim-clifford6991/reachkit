// What counts as naming this business — one answer, given here, for every
// rule that asks it (`./honest.ts`, `../claims/fit.ts`).
//
// The brand is two stored values: the business name recorded for the site
// and its domain. A site that records neither has no brand to name, and a
// rule that asks then decides nothing rather than guessing one.

/** The domain matches on its own registrable label as well as whole — a
 *  page that says "Acme" is naming the brand whether or not it writes
 *  "acme.com". */
export function brandTokens(a: { businessName: string | null; domain: string }): string[] {
  const tokens: string[] = [];
  const name = a.businessName?.trim() ?? "";
  if (name.length > 0) tokens.push(name);
  const domain = a.domain.trim();
  if (domain.length > 0) {
    tokens.push(domain);
    const label = domain.split(".")[0] ?? "";
    // A one- or two-letter label is not a brand mention: it matches inside
    // ordinary words.
    if (label.length > 2) tokens.push(label);
  }
  return tokens;
}

const REGEXP_SPECIAL_RE = /[.*+?^${}()|[\]\\]/g;

/** Bounded at both ends, so a site whose registrable label is an ordinary
 *  word is not read as naming itself every time that word appears inside
 *  another. Case-insensitive. */
export function namesBrand(text: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  const ordered = [...tokens]
    .sort((x, y) => y.length - x.length)
    .map((token) => token.replace(REGEXP_SPECIAL_RE, "\\$&"));
  return new RegExp(`\\b(?:${ordered.join("|")})\\b`, "i").test(text);
}
