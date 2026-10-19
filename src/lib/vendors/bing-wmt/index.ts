// Issue 1553 — Bing Webmaster Tools, under ReachKit's own account.
//
// The weekly pass adds each live hosted host, reads the account's meta
// code (`msvalidate.01`, which the hosted index prints), asks Bing to
// verify it, submits its sitemap, and reads each page's impressions,
// clicks, best place and last crawl. Every call is free. Bing's AI
// Performance report (Copilot citations) has no documented API as of
// 2026-10-19, so it is not read here.
//
// **Inert without a key.** `bingClient()` is `null` where
// `BING_WEBMASTER_API_KEY` is absent, and the pass then asks Bing nothing.
// The key rides in the query string, as Bing documents; it is never
// logged, and no payload leaves this file.
import { env } from "@/lib/config/env";
import { safeFetch, type FetchOutcome, type SafeFetchOpts } from "@/lib/egress";

export type BingSend = (url: string, opts: SafeFetchOpts) => Promise<FetchOutcome>;

const API = "https://ssl.bing.com/webmaster/api.svc/json";
const OPTS = { respectRobots: false, timeoutMs: 15000, maxBytes: 8_000_000 } as const;

/** Bing's `/Date(1760000000000)/`, as epoch milliseconds; `null` for none
 *  (Bing answers the epoch itself for a page it never crawled). */
export function bingDate(value: unknown): number | null {
  const ms = typeof value === "string" ? Number(/\/Date\((-?\d+)/.exec(value)?.[1]) : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function bingClient(key: string | undefined = env.BING_WEBMASTER_API_KEY, send: BingSend = safeFetch) {
  if (key === undefined) return null;

  async function call(method: string, query: Record<string, string>, body?: unknown): Promise<{ ok: boolean; d: unknown }> {
    const url = new URL(`${API}/${method}`);
    url.searchParams.set("apikey", key as string);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    const outcome = await send(url.toString(), {
      ...OPTS,
      method: body === undefined ? "GET" : "POST",
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch(() => null);
    if (outcome === null || !outcome.ok || outcome.status < 200 || outcome.status >= 300) return { ok: false, d: null };
    try {
      return { ok: true, d: (JSON.parse(outcome.html) as { d?: unknown }).d ?? null };
    } catch {
      return { ok: true, d: null };
    }
  }

  return {
    /** Adds the host (a site already held answers an error, which is the
     *  same standing) and returns its meta code and whether it is
     *  verified, or `null`. */
    async standing(siteUrl: string): Promise<{ code: string; verified: boolean } | null> {
      await call("AddSite", {}, { siteUrl });
      const { d } = await call("GetUserSites", {});
      if (!Array.isArray(d)) return null;
      const site = d.find((row) => (row as { Url?: unknown }).Url === siteUrl) as
        | { AuthenticationCode?: unknown; IsVerified?: unknown }
        | undefined;
      if (typeof site?.AuthenticationCode !== "string") return null;
      return { code: site.AuthenticationCode, verified: site.IsVerified === true };
    },
    async verify(siteUrl: string): Promise<boolean> {
      const { d } = await call("VerifySite", {}, { siteUrl });
      return d === true;
    },
    async submitSitemap(siteUrl: string, feedUrl: string): Promise<boolean> {
      return (await call("SubmitFeed", {}, { siteUrl, feedUrl })).ok;
    },
    /** Per page and day: impressions, clicks and the average place the
     *  page was shown at. */
    async pageStats(siteUrl: string): Promise<{ page: string; at: number; impressions: number; clicks: number; position: number }[] | null> {
      const { ok, d } = await call("GetPageStats", { siteUrl });
      if (!ok) return null;
      if (!Array.isArray(d)) return [];
      return d.flatMap((row) => {
        const r = row as { Query?: unknown; Date?: unknown; Impressions?: unknown; Clicks?: unknown; AvgImpressionPosition?: unknown };
        const at = bingDate(r.Date);
        if (typeof r.Query !== "string" || at === null) return [];
        return [{ page: r.Query, at, impressions: Number(r.Impressions) || 0, clicks: Number(r.Clicks) || 0, position: Number(r.AvgImpressionPosition) || 0 }];
      });
    },
    /** When Bing last crawled the page, or `null` where it has not. */
    async lastCrawl(siteUrl: string, url: string): Promise<number | null> {
      const { d } = await call("GetUrlInfo", { siteUrl, url });
      return bingDate((d as { LastCrawledDate?: unknown } | null)?.LastCrawledDate);
    },
  };
}

export type BingClient = NonNullable<ReturnType<typeof bingClient>>;
