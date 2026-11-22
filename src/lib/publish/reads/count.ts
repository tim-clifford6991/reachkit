// SPEC §6 measure (d) · SPEC §7 — what one request to a live hosted page counts, decided on the request and written after
// the response has gone. Run from middleware, the one place every request passes before the cache.
// Nothing of the request is kept: the agent, referrer, query and headers are reduced to `{ engine, kind }` here, and a
// skip logs its reason alone. The write is handed to `waitUntil` and swallows its own failure, so a page never waits on it.
import { isbot } from "isbot";
import type { NextFetchEvent, NextRequest } from "next/server";
import { ONWARD_CLICK_ACTIONS, ONWARD_CLICKS_COUNTED } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { classifyBlogRead, hostOf, type BlogRead, type OnwardClick } from "./classify";

/** The query a ReachKit mail adds to its links to a hosted page, so the customer opening their own page is not a visit. */
const MAIL_TAG = { name: "rk", value: "mail" } as const;
/** The query a page's ping names its link by (`ping="?rk_out=site"`); relative, so it posts to the page that sent it. */
const CLICK_PARAM = "rk_out";

/** A hosted page's address as a ReachKit mail links it. */
export function fromMail(liveUrl: string): string {
  try {
    const url = new URL(liveUrl);
    url.searchParams.set(MAIL_TAG.name, MAIL_TAG.value);
    return url.href;
  } catch {
    return liveUrl;
  }
}

/** The `ping` a link to the business's own site carries, or none while clicks are off. */
export function pingOf(action: OnwardClick): string | undefined {
  return ONWARD_CLICKS_COUNTED ? `?${CLICK_PARAM}=${action}` : undefined;
}

function skipped(reason: "unverified_crawler" | "ranges_unreadable" | "page_lookup_deadline"): void {
  console.warn(JSON.stringify({ event: "blog_read_skipped", reason }));
}

function hostOfHeader(req: NextRequest): string {
  return (req.headers.get("host") ?? "").trim().toLowerCase();
}

/** A browser's hyperlink-auditing POST (`<a ping>`), whatever else it carries. */
function isPing(req: NextRequest): boolean {
  return req.method === "POST" && (req.headers.get("content-type") ?? "").toLowerCase().startsWith("text/ping");
}

/** One click on one of the business's links, sent from a page on this very host by a browser. */
function clickOf(req: NextRequest): BlogRead | null {
  const from = req.headers.get("ping-from");
  let sameHost = false;
  try {
    sameHost = from !== null && new URL(from).host.toLowerCase() === hostOfHeader(req);
  } catch {
    sameHost = false;
  }
  const action = req.nextUrl.searchParams.get(CLICK_PARAM);
  if (!ONWARD_CLICKS_COUNTED || !sameHost || isbot(req.headers.get("user-agent") ?? "")) return null;
  if (!(ONWARD_CLICK_ACTIONS as readonly string[]).includes(action ?? "")) return null;
  return { engine: action as OnwardClick, kind: "outbound" };
}

/** A person opening the page: a top-level GET by a browser, not a prefetch or prerender, not ReachKit's own link and
 *  not a move within the same blog. */
function isVisit(req: NextRequest): boolean {
  const headers = req.headers;
  if (req.method !== "GET" || headers.get("sec-fetch-mode") !== "navigate") return false;
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || headers.has("next-router-prefetch")) return false;
  const agent = headers.get("user-agent");
  if (agent === null || isbot(agent)) return false;
  if (req.nextUrl.searchParams.get(MAIL_TAG.name) === MAIL_TAG.value) return false;
  const referer = headers.get("referer");
  if (referer === null) return true;
  const from = hostOf(referer);
  return from !== hostOfHeader(req).split(":")[0] && from !== hostOf(env.NEXT_PUBLIC_APP_URL);
}

function classified(req: NextRequest): BlogRead | null {
  if (isPing(req)) return clickOf(req);
  const referer = req.headers.get("referer");
  const read = classifyBlogRead({
    userAgent: req.headers.get("user-agent"),
    referer,
    utmSource: req.nextUrl.searchParams.get("utm_source"),
  });
  // Fetches and crawls are counted as they always were; every referral passes the visit gate first.
  if (read !== null && read.kind !== "referral") return read;
  if (!isVisit(req)) return null;
  return read ?? { engine: referer === null ? "none" : "other", kind: "referral" };
}

/** Fails open: a request that cannot be read is simply not counted. */
function readOf(req: NextRequest): BlogRead | null {
  try {
    return classified(req);
  } catch {
    return null;
  }
}

/** The page lookup ran out of time, so a read it would have counted is not. */
export function lookupMissed(req: NextRequest): void {
  if (readOf(req) !== null) skipped("page_lookup_deadline");
}

/**
 * Counts this request against the live page it reached, after the response. `"ping"` says the request was a click
 * report, which middleware answers with an empty 204 rather than the page.
 * A search crawler is counted only from its own engine's addresses: the client address is checked inside the deferred
 * write and dropped.
 */
export function countHostedRequest(
  req: NextRequest,
  live: { siteId: string; publicationId: string },
  event: Pick<NextFetchEvent, "waitUntil"> | undefined
): "ping" | null {
  const answer = isPing(req) ? "ping" : null;
  const read = readOf(req);
  if (read === null) return answer;
  const write = (async (): Promise<void> => {
    if (read.kind === "crawl") {
      const [{ clientAddressOf }, { crawlerVerdict }] = await Promise.all([import("@/lib/scan/admission"), import("./crawler")]);
      const verdict = await crawlerVerdict(read.engine, clientAddressOf(req.headers));
      if (verdict !== "verified") return skipped(verdict);
    }
    const [{ recordBlogRead }, { now }] = await Promise.all([import("./store"), import("@/lib/config/now")]);
    await recordBlogRead({ siteId: live.siteId, publicationId: live.publicationId, at: now(), read });
  })().catch(() => undefined);
  event?.waitUntil(write);
  return answer;
}
