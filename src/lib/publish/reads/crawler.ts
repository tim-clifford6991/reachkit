// Issue 1553 — is this Googlebot or Bingbot, or something saying it is?
//
// An agent string is free text. Google and Bing each publish the addresses
// their crawler fetches from (`SEARCH_CRAWLER_RANGES`), and both say to
// check a crawler by its address. A `crawl` claim from `classify.ts` is
// counted only when the request's address is inside the claimed engine's
// ranges; anything else is not counted at all.
//
// **The address is checked and dropped.** It is a parameter here and is
// never returned, logged or stored: the caller gets a yes or no, and the
// count it writes holds the day, the page and the engine, as every other
// read does (SPEC §7, 2026-09-20, as amended by issue 1553).
//
// **Ranges are read at most once a day per process**, and a list that
// could not be read verifies nobody: an unread list is not a list that
// holds everyone. Membership is `node:net`'s `BlockList`, the primitive
// `egress/policy.ts` already uses for the same question.
import { BlockList, isIP } from "node:net";
import { SEARCH_CRAWLER_RANGES, SEARCH_CRAWLER_RANGES_TTL_H } from "@/lib/config/constants";
import { safeFetch } from "@/lib/egress";
import type { CrawlEngine } from "./classify";

const HOUR_MS = 3_600_000;

/** Reads one engine's published list; injected by tests. */
export type RangesFetch = (url: string) => Promise<unknown>;

/** The published JSON, as a `BlockList`. A prefix this cannot read adds
 *  nothing. */
export function rangesFrom(json: unknown): BlockList {
  const list = new BlockList();
  const prefixes = (json as { prefixes?: unknown } | null)?.prefixes;
  if (!Array.isArray(prefixes)) return list;
  for (const entry of prefixes) {
    const cidr = (entry as { ipv4Prefix?: unknown; ipv6Prefix?: unknown } | null);
    const text = typeof cidr?.ipv4Prefix === "string" ? cidr.ipv4Prefix : cidr?.ipv6Prefix;
    if (typeof text !== "string") continue;
    const [net, bits] = text.split("/");
    const family = net === undefined ? 0 : isIP(net);
    const prefix = Number(bits);
    if (family === 0 || net === undefined || !Number.isInteger(prefix)) continue;
    list.addSubnet(net, prefix, family === 4 ? "ipv4" : "ipv6");
  }
  return list;
}

async function fetchJson(url: string): Promise<unknown> {
  const outcome = await safeFetch(url, { respectRobots: false, timeoutMs: 5000 });
  return outcome.ok && outcome.status === 200 ? (JSON.parse(outcome.html) as unknown) : null;
}

const held = new Map<CrawlEngine, { list: BlockList; at: number }>();

/** Forgets the ranges read so far; for the suites. */
export function forgetCrawlerRanges(): void {
  held.clear();
}

/** Why a crawl claim was not counted, as the skip line names it. */
export type CrawlerVerdict = "verified" | "unverified_crawler" | "ranges_unreadable";

/**
 * Whether `ip` is inside the published ranges of `engine`'s crawler.
 * Never throws: a list that could not be read answers `ranges_unreadable`.
 */
export async function crawlerVerdict(
  engine: CrawlEngine,
  ip: string | null,
  read: RangesFetch = fetchJson,
  at: number = Date.now()
): Promise<CrawlerVerdict> {
  if (ip === null) return "unverified_crawler";
  const family = isIP(ip);
  if (family === 0) return "unverified_crawler";
  try {
    let entry = held.get(engine);
    if (entry === undefined || at - entry.at > SEARCH_CRAWLER_RANGES_TTL_H * HOUR_MS) {
      entry = { list: rangesFrom(await read(SEARCH_CRAWLER_RANGES[engine])), at };
      // An empty answer is kept for no day: the next crawl asks again.
      if (entry.list.rules.length === 0) return "ranges_unreadable";
      held.set(engine, entry);
    }
    return entry.list.check(ip, family === 4 ? "ipv4" : "ipv6") ? "verified" : "unverified_crawler";
  } catch {
    return "ranges_unreadable";
  }
}
