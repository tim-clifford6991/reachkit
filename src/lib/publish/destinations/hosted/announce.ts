// SPEC §7 — Google is told about a hosted page the moment it changes, through the feed's WebSub hub.
// One ping per change; a move is one change. Hosted and live hosts only: the feed is served on our hosts alone.
// Never in the way: a refusal, a 429 or a network failure is logged and dropped, with no retry. The hub is free, so 0¢.
// An accepted ping stamps `publications.announced_at` on the touched addresses; `announceUnannounced` pings once for
// live pages with no stamp.
import { safeFetch, type FetchOutcome, type SafeFetchOpts } from "@/lib/egress";
import { publishDb } from "../../db";
import { hostedHostFor } from "./hostname";

/** Google's public WebSub hub, which the feed names and each change pings. */
export const WEBSUB_HUB = "https://pubsubhubbub.appspot.com/";
/** The feed, on the customer's own host. */
export const HOSTED_FEED_PATH = "/rss.xml";

/** The ping as `safeFetch` makes it; injected so no suite pings the hub. */
export type AnnounceSend = (url: string, opts: SafeFetchOpts) => Promise<FetchOutcome>;

const SEND_OPTS = { respectRobots: false, userAgent: "reachkit-verify", timeoutMs: 8000 } as const;

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

/** 2xx is "received"; anything else is dropped. */
function accepted(outcome: FetchOutcome | null): boolean {
  return outcome?.ok === true && outcome.status >= 200 && outcome.status < 300;
}

function statusOf(outcome: FetchOutcome | null): number | string {
  if (outcome === null) return "threw";
  return outcome.ok ? outcome.status : (outcome.status ?? outcome.reason);
}

/** Tells the WebSub hub that `urls` changed on the hosted host; answers whether the hub accepted. Never throws, never retries. */
export async function announceHosted(a: { siteId: string; urls: readonly string[]; send?: AnnounceSend; at?: Date }): Promise<boolean> {
  try {
    const live = await hostedHostFor(a.siteId);
    if (live === null || live.state !== "live") return false;
    const host = live.hostname.trim().toLowerCase();
    const changed = a.urls.map((url) => onHost(url, host)).filter((url): url is string => url !== null);
    if (changed.length === 0) return false;
    const urlList = [...new Set([...changed, `https://${host}/`])];
    const send = a.send ?? safeFetch;

    const feed = `https://${host}${HOSTED_FEED_PATH}`;
    const hub = await send(WEBSUB_HUB, {
      ...SEND_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ "hub.mode": "publish", "hub.url": feed }).toString(),
    }).catch(() => null);
    if (!accepted(hub)) {
      log("websub_dropped", { siteId: a.siteId, status: statusOf(hub) });
      return false;
    }
    log("websub_sent", { siteId: a.siteId, urls: urlList.length });
    await publishDb()
      .from("publications")
      .update({ announced_at: (a.at ?? new Date()).toISOString() })
      .eq("site_id", a.siteId)
      .in("live_url", urlList)
      .is("unpublished_at", null);
    return true;
  } catch (error) {
    log("announce_failed", { siteId: a.siteId, message: String(error) });
    return false;
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

/** Pings the hub once for every live hosted page no accepted ping has stamped. Never throws. */
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
