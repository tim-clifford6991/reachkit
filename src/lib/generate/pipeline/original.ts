// SPEC §7 *Two pools of facts*: a statistic is cited to its original publisher.
//
// A page that repeats a statistic and links where it came from (the survey, the study, the vendor's own docs) is
// followed to that link with a free, cached page read. Where the linked page states the statistic's figures, the
// claim is cited there in the original's own sentence, and the repeating page is kept only as `via`, a supporting
// source. Where the link cannot be read or does not state them, the claim stays on the repeating page, marked
// `secondHand`: never a title's figure, and never by itself what makes its page a cited source. A claim that is not
// a statistic, and one whose page links no source beside it, are cited as before. No model call: 0¢.
import { parse } from "node-html-parser";
import { RIVAL_PRICE_MAX_AGE_D } from "@/lib/config/constants";
import { isPlatformDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { visibleText } from "@/lib/measure/parse";
import { isAccountPage } from "@/lib/site-profile/knowledge/priority";
import { derivePurpose } from "@/lib/site-profile/purpose";
import { aged, squash, statisticYear } from "./claims";
import { datesOf } from "./dated";
import type { PackClaim } from "./pack";
import type { MarketFact, ReadPage } from "./research";

/** A passage of a read page with the outside pages it links: where a statistic says it came from. */
export interface SourcedBlock {
  text: string;
  hrefs: string[];
}

/** A page read at 0¢, cache first, with its own dates; `null` where it does not read. */
export type ReadOriginal = (url: string) => Promise<ReadPage | null>;

const BLOCKS = "p, li, blockquote, td, figcaption";
const MOST_BLOCKS = 60;

/** The passages of a page that state a figure and link another site, each with those links in order. */
export function sourcedBlocks(html: string, pageUrl: string): SourcedBlock[] {
  const own = registrableDomain(pageUrl);
  const out: SourcedBlock[] = [];
  for (const block of parse(html).querySelectorAll(BLOCKS)) {
    const text = squash(visibleText(block.innerHTML));
    if (!/\d/.test(text)) continue;
    const hrefs = block.querySelectorAll("a[href]").flatMap((a) => {
      try {
        const url = new URL(a.getAttribute("href") ?? "", pageUrl);
        const domain = registrableDomain(url.hostname);
        return /^https?:$/.test(url.protocol) && domain !== null && domain !== own && !isPlatformDomain(domain) ? [url.href] : [];
      } catch {
        return [];
      }
    });
    if (hrefs.length > 0) out.push({ text, hrefs: [...new Set(hrefs)] });
    if (out.length >= MOST_BLOCKS) break;
  }
  return out;
}

/** The most pages followed from the repeating one toward the publisher. */
const HOPS = 3;

const FIGURE_RE = /\d+(?:[.,]\d+)*\s?%?/g;
const YEAR_ONLY_RE = /^(?:19|20)\d{2}$/;

/** A passage's figures, years aside, written one way: "12,000" and "12 000" are one figure. */
function figuresOf(text: string): string[] {
  return [...new Set([...text.matchAll(FIGURE_RE)].map((match) => match[0].replace(/[\s,]/g, "")).filter((figure) => !YEAR_ONLY_RE.test(figure)))];
}

/** A figure that names one finding: a share, or a number of three digits or more. "12" alone could be anything. */
const telling = (figure: string): boolean => figure.endsWith("%") || figure.replace(/\D/g, "").length >= 3;

/** The original's own sentence that states the most of the passage's figures, one of them telling; `null` where none does. */
export function originalSentence(passage: string, text: string): string | null {
  const wanted = figuresOf(passage);
  let best: { sentence: string; held: number } | null = null;
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/).map(squash)) {
    if (sentence.length < 20 || sentence.length > 400) continue;
    const held = figuresOf(sentence).filter((figure) => wanted.includes(figure));
    if (held.some(telling) && (best === null || held.length > best.held)) best = { sentence, held: held.length };
  }
  return best?.sentence ?? null;
}

/** Each statistic read on a page that links its source, cited to that source where it states it, else marked
 *  `secondHand`. The first linked page that states it wins; `read` is the cached page read. */
export async function toOriginals(
  facts: readonly MarketFact[],
  pages: readonly { url: string; sourced?: readonly SourcedBlock[] }[],
  read: ReadOriginal
): Promise<MarketFact[]> {
  const out: MarketFact[] = [];
  for (const fact of facts) {
    const hrefs = fact.product !== undefined || statisticYear(fact.passage, null) === null ? [] : linkedFrom(fact, pages);
    let cited: MarketFact | null = null;
    for (const href of hrefs.slice(0, 2)) {
      const found = await publisherOf(fact.passage, href, read);
      if (found === null) continue;
      const { page, sentence } = found;
      // The original's own date ranks it, never the repeating page's.
      cited = { url: page.url, title: page.title, readAt: new Date(page.readAt), passage: sentence, kind: fact.kind, via: fact.url };
      if (fact.about !== undefined) cited.about = fact.about;
      Object.assign(cited, aged({ ...datesOf(page), passage: sentence, ...(fact.timeliness === undefined ? {} : { timeliness: fact.timeliness }) }));
      break;
    }
    if (cited !== null && !out.some((held) => held.passage === cited.passage)) out.push(cited);
    else if (cited === null) out.push(hrefs.length === 0 ? fact : { ...fact, secondHand: true });
  }
  return out;
}

/** The page `href` leads to that states the passage's figures in its own sentence: a linked page that repeats it in
 *  turn, linking its own source beside it, is followed toward the publisher. `null` where the first does not state it. */
async function publisherOf(passage: string, href: string, read: ReadOriginal): Promise<{ page: NonNullable<Awaited<ReturnType<ReadOriginal>>>; sentence: string } | null> {
  const first = await read(href);
  const said = first === null ? null : originalSentence(passage, first.text);
  if (first === null || said === null) return null;
  let found = { page: first, sentence: said };
  for (let hop = 1; hop < HOPS; hop++) {
    const next = found.page.sourced?.find((block) => block.text.includes(found.sentence))?.hrefs[0];
    const deeper = next === undefined ? null : await read(next);
    const stated = deeper === null ? null : originalSentence(passage, deeper.text);
    if (deeper === null || stated === null) break;
    found = { page: deeper, sentence: stated };
  }
  return found;
}

/** The outside pages the passage's own block links on the page it was read from. */
function linkedFrom(fact: MarketFact, pages: readonly { url: string; sourced?: readonly SourcedBlock[] }[]): string[] {
  const blocks = pages.find((page) => page.url === fact.url)?.sourced ?? [];
  return blocks.find((block) => block.text.includes(fact.passage) || fact.passage.includes(block.text))?.hrefs ?? [];
}

/** The addresses a page's sources count: a page whose only claims are second-hand statistics is a supporting source. */
export function sourcingUrls(claims: readonly Pick<PackClaim, "url" | "secondHand">[]): string[] {
  return [...new Set(claims.filter((claim) => claim.secondHand !== true).map((claim) => claim.url))];
}

/** Whether a claim is a rival's price read too long ago to state (D59): more than `RIVAL_PRICE_MAX_AGE_D` days before
 *  `now`. A date that cannot be read is not an age. */
export function staleRivalPrice(claim: Pick<PackClaim, "kind" | "readAt">, now: Date): boolean {
  if (claim.kind !== "rival_pricing") return false;
  const read = Date.parse(claim.readAt);
  return !Number.isNaN(read) && now.getTime() - read > RIVAL_PRICE_MAX_AGE_D * 86_400_000;
}

/** Whether an address may never be a page's grounding or one of its sources, on any site: a sign-in, account, basket,
 *  checkout or legal page (SPEC §7, 2026-10-10, issue 1393). The read of the customer's own pages leaves them out
 *  already (`./grounding.ts`); this holds the same line for everything else the pack carries an address for. */
export function neverASource(url: string): boolean {
  return isAccountPage(url) || derivePurpose({ url, title: "", h1: "" }) === "legal";
}
