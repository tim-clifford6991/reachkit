// SPEC §6 (2026-09-20, #908) measure (d) · SPEC §7 (2026-09-20) — what one
// request to a hosted page was, decided from three strings and nothing
// else.
//
// §7 of that date: "Hosted pages count answer-engine fetches and
// answer-engine referrals (§6 of this date) — server-side, no cookie, no
// visitor identity, no client script. Nothing else about a visit is kept."
//
// **This file is pure, and it is the whole of the decision.** Agent string,
// referrer and `utm_source` in; one `{ engine, kind }` or `null` out. No
// clock, no store, no request object, no header names — so every rule below
// is settled by a test with no database and no browser, and the route above
// it has nothing to decide.
//
// **What it deliberately cannot do.** It returns no identifier, no address,
// no agent string and no host: the caller is handed two closed enumerations
// and cannot store anything else even by accident, because there is nothing
// else in the value. That is §7's "no visitor identity" made structural
// rather than promised.
//
// **Training crawlers are excluded by name, first.** §6(d): "training
// crawlers are not progress and are not shown." `GPTBot` and `ClaudeBot`
// are tested before anything else and end the decision — a string that
// carries one of them is not counted, whatever else it also carries. An
// agent list that grew a token containing one of theirs would otherwise
// quietly start counting a training crawl as a customer's progress.
//
// **A fetcher outranks a referrer.** An engine's own fetch carries no
// referrer of a person's, and a crafted one must never turn a robot's
// fetch into a visit.
//
// **A search crawler is a claim here, not a count** (issue 1553). Googlebot
// and Bingbot are returned as `crawl`, and the route counts one only after
// `crawler.ts` finds the request's address inside that engine's published
// ranges. The agent string alone proves nothing: anyone can send it.
import {
  AI_ANSWER_FETCHERS,
  AI_BLOG_ENGINES,
  AI_REFERRER_HOSTS,
  AI_REFERRER_SOURCES,
  AI_SEARCH_INDEXERS,
  AI_TRAINING_CRAWLERS,
  SEARCH_CRAWLERS,
} from "@/lib/config/constants";

/** The AI apps this product can tell apart, as internal handles. Every word
 *  a customer reads for one of them is a registry key. */
export type BlogEngine = (typeof AI_BLOG_ENGINES)[number];

/** The two search engines whose crawlers are counted (issue 1553). */
export type CrawlEngine = (typeof SEARCH_CRAWLERS)[keyof typeof SEARCH_CRAWLERS];

/**
 * Why the page was read.
 *
 * `answer_fetch`   an engine fetched it because a person asked a question
 * `index_fetch`    an engine fetched it to build the index it answers from
 * `referral`       a person arrived from an AI answer
 *
 * Three members, closed. The card counts the first two apart from the third
 * and never adds them together: a fetch is not a visitor.
 */
export const BLOG_READ_KINDS = ["answer_fetch", "index_fetch", "referral"] as const;
export type BlogReadKind = (typeof BLOG_READ_KINDS)[number];

export type BlogRead =
  | { readonly engine: BlogEngine; readonly kind: BlogReadKind }
  /** Googlebot or Bingbot by its agent string, still to be checked by
   *  address (`crawler.ts`). */
  | { readonly engine: CrawlEngine; readonly kind: "crawl" };

/** What a request offers this decision. All three are optional because all
 *  three are absent from some real request, and none of them is stored. */
export interface RequestFacts {
  readonly userAgent: string | null;
  readonly referer: string | null;
  readonly utmSource: string | null;
}

/** A token appears in an agent string. Case-sensitive on purpose: every
 *  token here is a product name the vendor publishes with that exact
 *  casing, and a case-insensitive match would let `chatgpt-user` in a
 *  hand-written string stand for OpenAI's fetcher. */
function carries(agent: string, token: string): boolean {
  return agent.includes(token);
}

/** The referrer's host, or `null` for anything that is not an absolute
 *  address. A `Referer` header is attacker-controlled in exactly the way a
 *  query string is, so it is parsed rather than searched: a URL whose
 *  *path* contains `chatgpt.com` is not a referral from ChatGPT. */
function hostOf(referer: string): string | null {
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** The host itself, or a subdomain of it — `www.perplexity.ai` is
 *  Perplexity, `perplexity.ai.example.com` is not. */
function isHostOrSubdomain(host: string, of: string): boolean {
  return host === of || host.endsWith(`.${of}`);
}

function engineOfReferrer(referer: string | null, utmSource: string | null): BlogEngine | null {
  const host = referer === null ? null : hostOf(referer);
  if (host !== null) {
    for (const [known, engine] of Object.entries(AI_REFERRER_HOSTS)) {
      if (isHostOrSubdomain(host, known)) return engine;
    }
  }
  // `utm_source` is the other half: most AI apps strip the referrer, and
  // some of them tag the link instead. Lower-cased here, never in the pin.
  if (utmSource !== null) {
    const source = utmSource.trim().toLowerCase();
    const tagged = (AI_REFERRER_SOURCES as Readonly<Record<string, BlogEngine>>)[source];
    if (tagged !== undefined) return tagged;
  }
  return null;
}

/**
 * One request, as one countable read — or `null`, which is the ordinary
 * answer for the overwhelming majority of traffic and is not an error.
 *
 * The order is the rule: training crawler, then fetcher, then indexer, then
 * search crawler, then referrer. Nothing falls through to a guess.
 */
export function classifyBlogRead(facts: RequestFacts): BlogRead | null {
  const agent = facts.userAgent ?? "";

  if (agent !== "") {
    for (const crawler of AI_TRAINING_CRAWLERS) {
      if (carries(agent, crawler)) return null;
    }
    for (const [token, engine] of Object.entries(AI_ANSWER_FETCHERS)) {
      if (carries(agent, token)) return { engine, kind: "answer_fetch" };
    }
    for (const [token, engine] of Object.entries(AI_SEARCH_INDEXERS)) {
      if (carries(agent, token)) return { engine, kind: "index_fetch" };
    }
    for (const [token, engine] of Object.entries(SEARCH_CRAWLERS)) {
      if (carries(agent, token)) return { engine, kind: "crawl" };
    }
  }

  const referred = engineOfReferrer(facts.referer, facts.utmSource);
  return referred === null ? null : { engine: referred, kind: "referral" };
}
