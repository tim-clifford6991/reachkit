// BUILD §5
// src/lib/measure/pages.ts — the pages Content reads and how a stored read
// of one is read (issue 1551), apart from `index.ts` so the re-score, which
// reaches no network and loads no vendor, reads them as a pass does.
import { BATTERY } from "@/lib/config/constants";
import { pagePathAlternation } from "@/lib/locale/language";
import { BOT_PROTECTION, challengeOf } from "./challenge";
import { answerabilityOf } from "./drivers";
import { measured, measuredZero, unmeasured, type Measured } from "./measured";
import { isStoredDocument, type StoredDocument } from "./own-fetch";
import { parseOnPage, type OnPageFacts } from "./parse";

export type Tier = "free" | "deep" | "weekly";

export const EXTRA_PAGES_BY_TIER: Readonly<Record<Tier, number>> = Object.freeze({
  free: 0,
  deep: BATTERY.MEASURED_PAGES_MAX,
  weekly: BATTERY.MEASURED_PAGES_MAX,
});

/** A read document as its facts: `zero` when it parsed to nothing (no
 *  headings, no visible text — REQ-004 c7's "read it; it contained none"). */
export function factsOf(document: StoredDocument, at: Date): Measured<OnPageFacts> {
  const facts = parseOnPage({ url: document.url, html: document.html });
  const isEmpty = facts.headings === 0 && facts.visibleChars === 0;
  return isEmpty ? measuredZero(facts, at) : measured(facts, at);
}

/** Re-stamps a read's `at` to the pass's one date. The document's own
 *  `readAt` survives in the `fetches` row; the verdict carries one date. */
export function stampedAt<T>(m: Measured<T>, at: Date): Measured<T> {
  return m.kind === "unmeasured" ? { kind: "unmeasured", reason: m.reason, at } : { kind: m.kind, value: m.value, at };
}

// ── Pricing-page detection over the home document's own links ───────────
//
// BUILD §6.4: "no crawling — the page set is only URLs we already hold …
// or construct by name". The pricing page is the one page §6.7 step 1
// reads beside the home, found by its link on the home document: the
// first same-host anchor whose path's last segment is a pricing word.
// Deterministic — document order, first match.
const ANCHOR_HREF_RE = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;
// The other supported languages name the same page in their own words (D66).
const PRICING_PATH_RE = new RegExp(`(?:^|/)(?:pricing|prices?|plans|${pagePathAlternation("pricing")})/?$`, "i");

export function detectPricingUrl(html: string, homeUrl: string): string | null {
  let home: URL;
  try {
    home = new URL(homeUrl);
  } catch {
    return null;
  }
  ANCHOR_HREF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_HREF_RE.exec(html)) !== null) {
    const href = match[1] ?? match[2] ?? "";
    if (!href) continue;
    try {
      const resolved = new URL(href, home);
      if (resolved.hostname !== home.hostname) continue;
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      if (!PRICING_PATH_RE.test(resolved.pathname)) continue;
      resolved.hash = "";
      const candidate = resolved.toString();
      if (candidate === home.toString()) continue;
      return candidate;
    } catch {
      // Not a resolvable URL — never a candidate, never a throw.
    }
  }
  return null;
}

export function homeUrlOf(domain: string): string {
  return `https://${domain}/`;
}

// ── The site's measured pages (issue 1551) ───────────────────────────────
//
// BUILD §5's Content is the "shape of the home + measured pages". The pages
// beyond the home and pricing page are the ones the site's crawl read and
// the ones ReachKit published for it, which the crawl does not read (issue
// 1511): the caller names them once the crawl is done, and every one is a
// zero-cent own read that the crawl's own read of it serves from the cache.

/** The pages Content reads beside the home and pricing page: `pages` in the
 *  order given, without those two and without repeats, up to the tier's
 *  allowance. A free scan's allowance is none. */
export function measuredPagesOf(a: { tier: Tier; domain: string; pricingUrl: string | null; pages: readonly string[] }): string[] {
  const seen = new Set<string>([homeUrlOf(a.domain), ...(a.pricingUrl === null ? [] : [a.pricingUrl])]);
  const out: string[] = [];
  for (const url of a.pages) {
    if (out.length >= EXTRA_PAGES_BY_TIER[a.tier]) break;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** A stored own-document read (`fetches.payload`) as the facts Content reads
 *  off it, mapped as a pass maps its own read: a refusal or a protection's
 *  page is no reading of the site. Dated `at`. */
export function storedFactsOf(payload: unknown, at: Date): Measured<OnPageFacts> {
  if (!isStoredDocument(payload)) return unmeasured("undeterminable", at);
  if (challengeOf(payload) !== null) return unmeasured("undeterminable", at, BOT_PROTECTION);
  return stampedAt(factsOf(payload, at), at);
}

/** Content over the home page, the pricing page and the measured pages. */
export function contentOf(a: { onPage: Measured<OnPageFacts>; pricing: Measured<OnPageFacts> | null; pages: readonly Measured<OnPageFacts>[]; at: Date }): Measured<number> {
  return answerabilityOf({ pages: [a.onPage, ...(a.pricing === null ? [] : [a.pricing]), ...a.pages], at: a.at });
}
