// SPEC §7 (2026-10-18, issue 1511) — search engines are told about a hosted
// page the moment it changes: IndexNow, and the feed's WebSub hub.
//
// **One request each, per change.** A publish, an update and an unpublish
// each call this once with the address(es) the change touched, and the index
// with them, because the index lists the newest pages. A move (issue 1487)
// is one change: its old address, its new one and the index, in the one
// request.
//
// **Hosted only, and only while the host is live.** IndexNow proves the
// sender owns the host by a key file at its root (`/<key>.txt`, served by
// `src/app/(hosted)/hosted-page/indexnow/[key]/route.ts`). ReachKit can
// place that file on a host it serves and on no other, so a WordPress
// destination sends none, and a host whose record is not live yet sends none
// either: the engine would fetch a key file the host does not serve and
// answer 403.
//
// **Never in the way.** A refusal, a 429 or a network failure is logged and
// dropped: no retry, no loop, and the publish it follows has already
// happened. Both services are free and public, so this is 0¢.
//
// **Recorded** (issue 1553). An accepted IndexNow request stamps
// `publications.announced_at` on every live page whose address it carried,
// and `announceUnannounced` sends once for the live hosted pages that have
// no stamp: the pages published before issue 1511, and any whose request
// was dropped. A stamped page is never sent again by it.
//
// The key is not a secret. IndexNow publishes it at the host's root by
// design; it only has to be stable per site, so it is derived from the
// site's id and never stored.
import { createHash } from "node:crypto";
import { safeFetch, type FetchOutcome, type SafeFetchOpts } from "@/lib/egress";
import { publishDb } from "../../db";
import { hostedHostFor } from "./hostname";

/** The shared IndexNow endpoint: a submission reaches every participating
 *  engine. */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Google's public WebSub hub, the one Google's sitemap guide documents
 *  for feeds. The feed names it (`rss.xml`) and each change pings it. */
export const WEBSUB_HUB = "https://pubsubhubbub.appspot.com/";
/** The feed, on the customer's own host. */
export const HOSTED_FEED_PATH = "/rss.xml";

/** The two requests, as `safeFetch` makes them. Injected by tests: no suite
 *  pings either service. */
export type AnnounceSend = (url: string, opts: SafeFetchOpts) => Promise<FetchOutcome>;

const SEND_OPTS = { respectRobots: false, userAgent: "reachkit-verify", timeoutMs: 8000 } as const;

/** The site's IndexNow key: 32 hex characters, the same for the site every
 *  time. */
export function indexNowKey(siteId: string): string {
  return createHash("sha256").update(`indexnow:${siteId}`).digest("hex").slice(0, 32);
}

/** Where the key file is served on the host. */
export function keyLocation(host: string, siteId: string): string {
  return `https://${host}/${indexNowKey(siteId)}.txt`;
}

function onHost(url: string, host: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.host.toLowerCase() === host ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

/** 200 and 202 are both "received" (IndexNow, WebSub); anything else —
 *  a 4xx, a 429, a 5xx, no answer — is dropped. */
function accepted(outcome: FetchOutcome | null): boolean {
  return outcome?.ok === true && outcome.status >= 200 && outcome.status < 300;
}

function statusOf(outcome: FetchOutcome | null): number | string {
  if (outcome === null) return "threw";
  return outcome.ok ? outcome.status : (outcome.status ?? outcome.reason);
}

/**
 * Tells IndexNow and the WebSub hub that `urls` changed on the site's hosted
 * host. Never throws, and never retries.
 */
export async function announceHosted(a: { siteId: string; urls: readonly string[]; send?: AnnounceSend; at?: Date }): Promise<void> {
  try {
    const live = await hostedHostFor(a.siteId);
    if (live === null || live.state !== "live") return;
    const host = live.hostname.trim().toLowerCase();
    const changed = a.urls.map((url) => onHost(url, host)).filter((url): url is string => url !== null);
    if (changed.length === 0) return;
    const urlList = [...new Set([...changed, `https://${host}/`])];
    const send = a.send ?? safeFetch;

    const indexNow = await send(INDEXNOW_ENDPOINT, {
      ...SEND_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: indexNowKey(a.siteId), keyLocation: keyLocation(host, a.siteId), urlList }),
    }).catch(() => null);
    if (accepted(indexNow)) {
      log("indexnow_sent", { siteId: a.siteId, urls: urlList.length });
      await publishDb()
        .from("publications")
        .update({ announced_at: (a.at ?? new Date()).toISOString() })
        .eq("site_id", a.siteId)
        .in("live_url", urlList)
        .is("unpublished_at", null);
    } else log("indexnow_dropped", { siteId: a.siteId, status: statusOf(indexNow) });

    const feed = `https://${host}${HOSTED_FEED_PATH}`;
    const hub = await send(WEBSUB_HUB, {
      ...SEND_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ "hub.mode": "publish", "hub.url": feed }).toString(),
    }).catch(() => null);
    if (!accepted(hub)) log("websub_dropped", { siteId: a.siteId, status: statusOf(hub) });
  } catch (error) {
    log("announce_failed", { siteId: a.siteId, message: String(error) });
  }
}

/** `announceHosted` for the site a draft belongs to. Never throws. */
export async function announceForDraft(a: { draftId: string; urls: readonly string[]; send?: AnnounceSend }): Promise<void> {
  try {
    const { data } = await publishDb().from<{ site_id: string }>("drafts").select("site_id").eq("id", a.draftId).limit(1);
    const siteId = data?.[0]?.site_id;
    if (typeof siteId !== "string") return;
    await announceHosted({ siteId, urls: a.urls, ...(a.send === undefined ? {} : { send: a.send }) });
  } catch (error) {
    log("announce_failed", { draftId: a.draftId, message: String(error) });
  }
}

/** Announces, in one request, every live hosted page of the site that
 *  IndexNow has never accepted. Never throws; a site with none sends
 *  nothing. */
export async function announceUnannounced(a: { siteId: string; send?: AnnounceSend; at?: Date }): Promise<void> {
  try {
    const { data } = await publishDb()
      .from<{ live_url: string | null }>("publications")
      .select("live_url")
      .eq("site_id", a.siteId)
      .eq("destination", "hosted")
      .not("published_at", "is", null)
      .is("unpublished_at", null)
      .is("announced_at", null);
    const urls = (data ?? []).map((row) => row.live_url).filter((url): url is string => typeof url === "string");
    if (urls.length === 0) return;
    await announceHosted({ siteId: a.siteId, urls, ...(a.send === undefined ? {} : { send: a.send }), ...(a.at === undefined ? {} : { at: a.at }) });
  } catch (error) {
    log("announce_failed", { siteId: a.siteId, message: String(error) });
  }
}
