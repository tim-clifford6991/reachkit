// Google Search Console under ReachKit's own account: verify each live hosted host as a URL-prefix property by meta tag,
// submit its sitemap, read URL Inspection and Search Analytics. Every call is free.
// An account holds 1,000 properties (`GSC_PROPERTIES_PER_ACCOUNT`), so `GOOGLE_SEARCH_CONSOLE_KEYS` is one key or an array;
// a host stays with the account the destination row names. No key means no pool, and nothing is asked.
// No payload leaves this file: each call answers a small typed value or `null`, and no key, token or body is logged;
// a refusal reaches `onRefused` as its step, its status and Google's one-word reason.
// Auth is one JWT signed with `node:crypto`, exchanged for an access token (Google's server-to-server OAuth).
import { createPrivateKey, createSign } from "node:crypto";
import { env } from "@/lib/config/env";
import { safeFetch, type FetchOutcome, type SafeFetchOpts } from "@/lib/egress";
import { statedOf, type Inspection } from "@/lib/measure/page-reading";

export interface GscAccount {
  client_email: string;
  private_key: string;
}

/** The HTTP door; injected by tests, so no suite calls Google. */
export type GscSend = (url: string, opts: SafeFetchOpts) => Promise<FetchOutcome>;

export type GscStep = "token" | "verify" | "add" | "sitemap" | "analytics" | "inspect";
export interface GscRefusal {
  step: GscStep;
  status: number | null;
  googleReason: string | null;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/webmasters";
const VERIFY_API = "https://www.googleapis.com/siteVerification/v1";
const WEBMASTERS_API = "https://www.googleapis.com/webmasters/v3/sites";
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const OPTS = { respectRobots: false, timeoutMs: 15000, maxBytes: 8_000_000 } as const;

function isAccount(value: unknown): value is GscAccount {
  const key = value as Partial<GscAccount> | null;
  if (typeof key?.client_email !== "string" || typeof key.private_key !== "string") return false;
  // The loader signing uses, so a key that would fail to sign is never in the pool.
  try {
    createPrivateKey(key.private_key);
    return true;
  } catch {
    return false;
  }
}

/** The usable accounts, in the binding's order, and how many entries the binding holds (0 where it is not set). */
export function gscPool(raw: string | undefined = env.GOOGLE_SEARCH_CONSOLE_KEYS): { entries: number; accounts: GscAccount[] } {
  if (raw === undefined) return { entries: 0, accounts: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return { entries: entries.length, accounts: entries.filter(isAccount) };
  } catch {
    return { entries: 1, accounts: [] };
  }
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/** The signed assertion Google exchanges for an access token. */
export function assertionFor(account: GscAccount, nowS: number): string {
  const head = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPES, aud: TOKEN_URL, iat: nowS, exp: nowS + 3600 })
  );
  const signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(account.private_key);
  return `${head}.${claims}.${base64url(signature)}`;
}

function json(outcome: FetchOutcome): unknown {
  if (!outcome.ok) return null;
  try {
    return JSON.parse(outcome.html) as unknown;
  } catch {
    return null;
  }
}

const success = (outcome: FetchOutcome): boolean => outcome.ok && outcome.status >= 200 && outcome.status < 300;

/** Google's code for a refusal (`SERVICE_DISABLED`, `PERMISSION_DENIED`, `invalid_grant`); only a bare word, so no text of the body is logged. */
function googleReason(outcome: FetchOutcome | null): string | null {
  const error = outcome === null ? undefined : (json(outcome) as { error?: unknown } | null)?.error;
  const e = error as { status?: unknown; errors?: { reason?: unknown }[]; details?: { reason?: unknown }[] } | undefined;
  const reason = typeof error === "string" ? error : (e?.details?.find((d) => typeof d?.reason === "string")?.reason ?? e?.errors?.[0]?.reason ?? e?.status);
  return typeof reason === "string" && /^[A-Za-z_]{1,64}$/.test(reason) ? reason : null;
}

/** One authorised Google client, for one account. */
export function gscClient(account: GscAccount, send: GscSend = safeFetch, onRefused?: (refusal: GscRefusal) => void) {
  const refuse = (step: GscStep, outcome: FetchOutcome | null): void =>
    onRefused?.({ step, status: outcome?.status ?? null, googleReason: googleReason(outcome) });
  let token: { value: string; until: number } | null = null;

  async function bearer(): Promise<string | null> {
    const nowS = Math.floor(Date.now() / 1000);
    if (token !== null && token.until > nowS + 60) return token.value;
    const outcome = await send(TOKEN_URL, {
      ...OPTS,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertionFor(account, nowS),
      }).toString(),
    }).catch(() => null);
    const body = outcome === null ? null : (json(outcome) as { access_token?: unknown; expires_in?: unknown } | null);
    if (typeof body?.access_token !== "string") return (refuse("token", outcome), null);
    token = { value: body.access_token, until: nowS + (typeof body.expires_in === "number" ? body.expires_in : 3600) };
    return token.value;
  }

  async function call(step: GscStep, url: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<FetchOutcome | null> {
    const auth = await bearer();
    if (auth === null) return null;
    const outcome = await send(url, {
      ...OPTS,
      method,
      headers: { Authorization: `Bearer ${auth}`, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch(() => null);
    if (outcome === null || !success(outcome)) refuse(step, outcome);
    return outcome;
  }

  const site = (siteUrl: string) => ({ type: "SITE", identifier: siteUrl });
  const property = (siteUrl: string) => `${WEBMASTERS_API}/${encodeURIComponent(siteUrl)}`;

  return {
    /** The meta tag's `content` for this property, or `null`. */
    async metaToken(siteUrl: string): Promise<string | null> {
      const outcome = await call("verify", `${VERIFY_API}/token`, "POST", { site: site(siteUrl), verificationMethod: "META" });
      const tag = outcome === null ? null : (json(outcome) as { token?: unknown } | null)?.token;
      if (typeof tag !== "string") return null;
      // Google answers the whole tag; the head prints only its content.
      return /content="([^"]+)"/.exec(tag)?.[1] ?? tag;
    },
    /** Asks Google to check the token on the host. */
    async verify(siteUrl: string): Promise<boolean> {
      const outcome = await call("verify", `${VERIFY_API}/webResource?verificationMethod=META`, "POST", { site: site(siteUrl) });
      return outcome !== null && success(outcome);
    },
    /** Adds the verified property to Search Console and submits its
     *  sitemap. */
    async addWithSitemap(siteUrl: string, sitemapUrl: string): Promise<boolean> {
      const added = await call("add", property(siteUrl), "PUT");
      if (added === null || !success(added)) return false;
      const submitted = await call("sitemap", `${property(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`, "PUT");
      return submitted !== null && success(submitted);
    },
    /** URL Inspection: indexed (`verdict` PASS), when Google last crawled the page, and the coverage line and canonicals
     *  Google states; a field Google leaves out is absent. */
    async inspect(siteUrl: string, url: string): Promise<Inspection | null> {
      const outcome = await call("inspect", INSPECT_URL, "POST", { inspectionUrl: url, siteUrl });
      if (outcome === null || !success(outcome)) return null;
      const status = (json(outcome) as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } } | null)
        ?.inspectionResult?.indexStatusResult;
      if (status === undefined) return null;
      return { indexed: status.verdict === "PASS", lastCrawl: typeof status.lastCrawlTime === "string" ? status.lastCrawlTime : null, ...statedOf(status) };
    },
    /** Search Analytics over `[start, end]` (`YYYY-MM-DD`), by page and query, or by page alone, whose totals keep the
     *  anonymised queries Google drops from rows grouped by query; a page-only row's `query` is "". */
    async performance(
      siteUrl: string,
      start: string,
      end: string,
      byQuery = true
    ): Promise<{ page: string; query: string; impressions: number; clicks: number; position: number }[] | null> {
      const outcome = await call("analytics", `${property(siteUrl)}/searchAnalytics/query`, "POST", {
        startDate: start,
        endDate: end,
        dimensions: byQuery ? ["page", "query"] : ["page"],
        rowLimit: 25000,
      });
      if (outcome === null || !success(outcome)) return null;
      const rows = (json(outcome) as { rows?: unknown } | null)?.rows;
      if (rows === undefined) return [];
      if (!Array.isArray(rows)) return null;
      return rows.flatMap((row) => {
        const r = row as { keys?: unknown; impressions?: unknown; clicks?: unknown; position?: unknown };
        const [page, query = ""] = Array.isArray(r.keys) ? r.keys : [];
        if (typeof page !== "string" || typeof query !== "string" || typeof r.position !== "number") return [];
        return [{ page, query, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0, position: r.position }];
      });
    },
    /** One page's days on one search over `[start, end]`, for the history command. */
    async history(
      siteUrl: string,
      page: string,
      query: string,
      start: string,
      end: string
    ): Promise<{ date: string; impressions: number; clicks: number; position: number }[] | null> {
      const filters = [
        { dimension: "page", operator: "equals", expression: page },
        { dimension: "query", operator: "equals", expression: query },
      ];
      const outcome = await call("analytics", `${property(siteUrl)}/searchAnalytics/query`, "POST", {
        startDate: start,
        endDate: end,
        dimensions: ["date"],
        dimensionFilterGroups: [{ filters }],
        rowLimit: 25000,
      });
      if (outcome === null || !success(outcome)) return null;
      const rows = (json(outcome) as { rows?: unknown } | null)?.rows;
      if (!Array.isArray(rows)) return rows === undefined ? [] : null;
      return rows.flatMap((row) => {
        const r = row as { keys?: unknown; impressions?: unknown; clicks?: unknown; position?: unknown };
        const date = Array.isArray(r.keys) ? r.keys[0] : undefined;
        if (typeof date !== "string" || typeof r.position !== "number") return [];
        return [{ date, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0, position: r.position }];
      });
    },
  };
}

export type GscClient = ReturnType<typeof gscClient>;
