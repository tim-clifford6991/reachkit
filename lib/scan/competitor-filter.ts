import type { Competitor } from "@/lib/scan/types";
import { hostname } from "@/lib/scan/url";

/**
 * Competitor sanity filter (spec §5.2 + §9.3 honesty bar).
 *
 * The web-mode competitor sources run a `"alternatives to {product}"` SERP/Tavily
 * query. That query is a SOURCE to mine real rival PRODUCTS from — it is NOT a
 * competitor list. Its top results are almost always review-directory / listicle
 * pages ("Top 10 X Alternatives — G2", "18 Best … Reviews", "X Competitors |
 * Product Hunt"). Surfacing those article titles as competitors is exactly the
 * "horoscope problem" the spec warns about (line 197: claims only when evidence
 * exists) and produces results that are neither competitors NOR even about the
 * right product (brand-name collisions, e.g. "nudgi" → "Nudge"/"Nudge Security").
 *
 * This filter drops those, normalises real product names, and — critically —
 * returns [] when nothing real survives. An honest empty set is the correct
 * signal: for a low-/no-presence subject it routes the scan to Cold Start
 * (§4.3) instead of fabricating a competitor matrix.
 */

// Review directories, listicle factories, and social/UGC platforms. A result on
// one of these hosts is an *article about* alternatives, never the rival product
// itself. App-store hosts are intentionally absent — app-mode competitors
// legitimately resolve to apps.apple.com / play.google.com.
const AGGREGATOR_HOSTS = [
  "g2.com", "capterra.com", "getapp.com", "softwareadvice.com", "trustradius.com",
  "gartner.com", "trustpilot.com", "producthunt.com", "alternativeto.net", "slant.co",
  "sourceforge.net", "saashub.com", "crozdesk.com", "goodfirms.co", "financesonline.com",
  "tekpon.com", "selecthub.com", "toolify.ai", "futurepedia.io", "theresanaiforthat.com",
  "reddit.com", "quora.com", "medium.com", "substack.com", "wikipedia.org",
  // forums / Q&A — a thread is never the rival product (the Stripe scan surfaced
  // an "Ask HN" item from news.ycombinator.com).
  "ycombinator.com", "news.ycombinator.com", "stackoverflow.com", "stackexchange.com",
  "youtube.com", "youtu.be", "linkedin.com", "twitter.com", "x.com", "facebook.com",
  "instagram.com", "tiktok.com", "pinterest.com", "forbes.com", "techcrunch.com",
  "zapier.com", "nerdwallet.com", "pcmag.com", "cnet.com",
  // dictionaries / thesauruses / reference — an "X synonyms/definition" result is
  // never a competitor product (the live nudgi.ai run surfaced "NUDGE Synonyms").
  "thesaurus.com", "merriam-webster.com", "dictionary.com", "dictionary.cambridge.org",
  "collinsdictionary.com", "vocabulary.com", "wordnik.com", "britannica.com",
  "wiktionary.org", "yourdictionary.com",
];

/** True if `host` is a known aggregator/directory/social platform (or a subdomain of one). */
export function isAggregatorHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  return AGGREGATOR_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

/**
 * Forum/aggregator artifact NAMES that are never real products — caught regardless
 * of host (a SERP result titled "Ask HN" surfaced as a competitor). Shared with the
 * LLM competitor extractor (lib/llm/competitor-names) so BOTH discovery paths drop them.
 */
export const NON_PRODUCT_NAMES = new Set<string>([
  "ask hn", "show hn", "hacker news", "hackernews", "reddit", "quora",
  "product hunt", "producthunt", "g2", "capterra", "getapp", "trustpilot",
  "stack overflow", "stackoverflow",
]);

// A title that reads like a listicle / comparison article rather than a product.
const LISTICLE_RE =
  /\b(alternatives?|competitors?|vs\.?|versus|comparison|pros\s*&?\s*cons)\b|\b(top|best)\s+\d+|\b\d+\s+best\b/i;

/** True if a result title looks like a listicle/comparison article, not a product. */
export function looksLikeListicle(name: string): boolean {
  return LISTICLE_RE.test(name);
}

/** Strip a trailing tagline / site suffix: "Focusmate – Virtual Coworking" → "Focusmate". */
export function cleanCompetitorName(name: string): string {
  const first = name.split(/\s+[|–—-]\s+|:\s+/)[0]?.trim();
  return first || name.trim();
}

/** Derive a brand-ish name from a host: "focusmate.com" → "Focusmate". */
export function brandFromHost(host: string): string {
  const label = host.replace(/^www\./, "").split(".")[0] ?? host;
  if (!label) return host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Brand-ambiguity hard rule (system-wide) ──────────────────────────────────
// A discovered "competitor" whose name is (nearly) identical to the SUBJECT's is
// almost always a name COLLISION: a DIFFERENT product that merely shares a
// similar name (e.g. "Nudge" / "Nudge Security" surfacing for "Nudgi"), not a
// real rival. We drop these everywhere — the system must NEVER attribute a
// similarly-named different product to the user's app.
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = new Array<number>(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}

/** True if `candidate` is a near-duplicate of `subject` — a likely name collision. */
export function isNameCollision(candidate: string, subject: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(subject);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false; // too short to judge safely
  return levenshtein(a, b) <= 2;
}

/**
 * True if the candidate collides with the subject — as a whole name, via its host
 * brand, OR via any significant word token. The token check catches reference /
 * comparison pages that merely CONTAIN the colliding word (e.g. "NUDGE Synonyms",
 * "Nudge vs X") rather than being the product itself.
 */
export function hasAnyCollision(name: string, host: string, subject: string): boolean {
  if (isNameCollision(name, subject)) return true;
  if (isNameCollision(brandFromHost(host), subject)) return true;
  for (const tok of name.split(/[^a-z0-9]+/i)) {
    if (tok.length >= 4 && isNameCollision(tok, subject)) return true;
  }
  return false;
}

/**
 * Keep only entries that are plausibly a real rival PRODUCT, with a normalised
 * display name. Drops self (by DOMAIN), aggregator/directory/social hosts,
 * listicle-titled results, and — when `subjectName` is given — name collisions
 * with the subject (the brand-ambiguity hard rule). Returns [] when nothing real
 * survives (→ Cold Start).
 */
export function filterRealCompetitors(
  raw: Competitor[],
  opts: { selfHost?: string; subjectName?: string } = {},
): Competitor[] {
  const self = opts.selfHost ? hostname(opts.selfHost) : null;
  const subject = opts.subjectName;
  const out: Competitor[] = [];
  for (const c of raw) {
    const host = hostname(c.url); // "" for content-extracted (llm_extracted) names with no URL
    // Host-based screens only apply when we have a host. Content-extracted names
    // (no URL) skip these but still face the listicle + collision guards below.
    if (host) {
      if (self && host === self) continue; // self by DOMAIN, never by name
      if (isAggregatorHost(host)) continue;
    }
    if (looksLikeListicle(c.name)) continue;
    let name = cleanCompetitorName(c.name);
    if (!name || looksLikeListicle(name)) name = host ? brandFromHost(host) : "";
    if (!name) continue; // nothing usable (empty name + no host to fall back to)
    if (NON_PRODUCT_NAMES.has(name.toLowerCase())) continue; // forum/aggregator artifact
    // Brand-ambiguity hard rule: never accept a same-/similar-named DIFFERENT product.
    if (subject && hasAnyCollision(name, host, subject)) continue;
    out.push({ ...c, name });
  }
  return out;
}
