// SPEC §6 measure (d) · SPEC §7 — what one request to a hosted page was: "server-side, no cookie, no visitor identity,
// no client script. Nothing else about a visit is kept."
// Pure and the whole decision: agent, referrer and `utm_source` in, `{ engine, kind }` or `null` out. It returns two closed
// enums and nothing else, so "no visitor identity" is structural.
// Training crawlers are excluded by name first (§6(d)), whatever else the string carries. A fetcher outranks a referrer,
// so a crafted one never turns a robot into a visit. A search crawler is a claim: `crawler.ts` checks its address.
import {
  AI_ANSWER_FETCHERS,
  AI_BLOG_ENGINES,
  AI_REFERRER_HOSTS,
  AI_REFERRER_SOURCES,
  AI_SEARCH_INDEXERS,
  AI_TRAINING_CRAWLERS,
  SEARCH_CRAWLERS,
  SEARCH_REFERRER_HOSTS,
} from "@/lib/config/constants";

/** The AI apps we can tell apart, as handles; every word a customer reads for one is a registry key. */
export type BlogEngine = (typeof AI_BLOG_ENGINES)[number];

/** The two search engines whose crawlers are counted. */
export type CrawlEngine = (typeof SEARCH_CRAWLERS)[keyof typeof SEARCH_CRAWLERS];

/**
 * Why the page was read.
 *
 * `answer_fetch`   an engine fetched it because a person asked a question
 * `index_fetch`    an engine fetched it to build the index it answers from
 * `referral`       a person arrived from an AI answer, or from Google or
 *                  Bing search
 *
 * Closed. The card never adds fetches to referrals: a fetch is not a visitor.
 */
export const BLOG_READ_KINDS = ["answer_fetch", "index_fetch", "referral"] as const;
export type BlogReadKind = (typeof BLOG_READ_KINDS)[number];

export type BlogRead =
  | { readonly engine: BlogEngine; readonly kind: BlogReadKind }
  /** Googlebot or Bingbot by agent string, still to be checked by address (`crawler.ts`). */
  | { readonly engine: CrawlEngine; readonly kind: "crawl" }
  /** A person arriving from Google or Bing search. */
  | { readonly engine: CrawlEngine; readonly kind: "referral" };

/** What a request offers; each is absent from some real request, and none is stored. */
export interface RequestFacts {
  readonly userAgent: string | null;
  readonly referer: string | null;
  readonly utmSource: string | null;
}

/** Case-sensitive on purpose: vendors publish these exact casings, and `chatgpt-user` must not stand for OpenAI's fetcher. */
function carries(agent: string, token: string): boolean {
  return agent.includes(token);
}

/** The referrer's host, parsed rather than searched since `Referer` is attacker-controlled: a path containing
 *  `chatgpt.com` is not a referral from ChatGPT. */
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
  // Most AI apps strip the referrer and some tag the link instead; lower-cased here, never in the pin.
  if (utmSource !== null) {
    const source = utmSource.trim().toLowerCase();
    const tagged = (AI_REFERRER_SOURCES as Readonly<Record<string, BlogEngine>>)[source];
    if (tagged !== undefined) return tagged;
  }
  return null;
}

/** One request as one countable read, or `null`, the ordinary answer. The order is the rule: training crawler, fetcher,
 *  indexer, search crawler, AI referrer, search referrer. Nothing falls through to a guess. */
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
  if (referred !== null) return { engine: referred, kind: "referral" };
  const host = facts.referer === null ? null : hostOf(facts.referer);
  // Own keys only: a host named `constructor` must not read the prototype.
  if (host === null || !Object.hasOwn(SEARCH_REFERRER_HOSTS, host)) return null;
  return { engine: SEARCH_REFERRER_HOSTS[host] as CrawlEngine, kind: "referral" };
}
