// BUILD §9 — the one place a Host header becomes a customer.
//
// §9: "**Hosted CMS:** `content.{customer-domain}` by CNAME → our edge
// route serves static-rendered pages by Host header." Everything the edge
// answers — a page, a robots document, a sitemap, a 404, a 410 — is decided
// from the disposition this module returns, and nothing on the surface
// re-derives it.
//
// **Resolution is exact and never falls back.** The Host is matched whole
// against the host stored on a live destination row; a host no row holds is
// `unknown`, which is a 404 and not a ReachKit page.
//
// **No `*.reachkit.app` host serves customer content**: a draft is read on
// the app host (`/app/draft/{draftId}`, `/veto/{token}`), so customer content
// never ranks on our domain and a slug label resolves to `unknown`.
//
// **This surface writes nothing.** No `POST`, no server action, no
// mutation anywhere under `src/app/(hosted)/`, so no crawler and no visitor
// can advance §9's state machine by fetching a page.
//
// **It fails closed, and says so.** A lookup that errors resolves to
// `unavailable`, which serves nothing and answers 503: a 404 or a 410 is a
// claim about the address that a failed read cannot make, and crawlers drop
// a 4xx from the index where they retry a 5xx.
//
// The archived plan is WO-229. Two departures from it, both forced and both
// stated: the cache tags live in `@/lib/publish/destinations/hosted`
// because their callers are the publish and unpublish paths and `src/lib/`
// may not import `src/app/` (ARCHITECTURE rule 6); and `gone:'unpublished'`
// is produced by the page route rather than here, because whether a *page*
// was taken down is not a fact about a *host* — the disposition is shared
// so that all three reasons still yield one `gone` response and not three.
import { HOSTED_UNAVAILABLE_INIT } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { hostedServingState } from "@/lib/account/billing";
import { hostedSiteForHostname } from "@/lib/publish/destinations/hosted";

export { tags } from "@/lib/publish/destinations/hosted";

export type HostDisposition =
  | { kind: "site"; siteId: string; domain: string; host: string; indexable: true }
  | { kind: "gone"; reason: "unpublished" | "access_ended" | "account_deleted"; siteId?: string }
  | { kind: "unknown" }
  | { kind: "unavailable" };

export function unavailableResponse(): Response {
  return new Response(null, HOSTED_UNAVAILABLE_INIT);
}

/** The Host header as a hostname: lower-cased, port removed, trailing dot
 *  removed. A header is whatever a client sent, and every comparison below
 *  is against a normalised name. */
export function normaliseHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  // An IPv6 literal is never one of ours, but its port is still a port:
  // `[::1]:3000` is `[::1]`, the same name `src/middleware.ts` compares.
  const withoutPort = trimmed.startsWith("[")
    ? trimmed.slice(0, trimmed.indexOf("]") + 1 || trimmed.length)
    : (trimmed.split(":")[0] ?? "");
  return withoutPort.endsWith(".") ? withoutPort.slice(0, -1) : withoutPort;
}

/** This deployment's own address, which is never a customer's host. */
function appHost(): string {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Whether a Host header names this deployment itself (issue #326).
 *
 * `resolveHost` folds the app host into `unknown` along with every
 * stranger, which is the right answer for a *page*: no ReachKit surface is
 * ever served from the hosted disposition. It is not the right answer for
 * `/robots.txt` and `/sitemap.xml`, which BUILD §3 lists among the public
 * routes and which the app host must now answer with its own documents.
 * So the distinction `resolveHost` deliberately does not draw is drawn
 * here instead, by the same normalisation and the same `appHost()` — a
 * second reader of `NEXT_PUBLIC_APP_URL` in this file would be a second
 * place the deployment's own name could come from.
 *
 * An unbound or unparseable origin makes `appHost()` the empty string, and
 * an empty name matches nothing: the two documents stay 404 rather than
 * being served on every host at once.
 */
export function isAppHost(host: string): boolean {
  const name = normaliseHost(host);
  if (name === "") return false;
  return name === appHost();
}

/** The lifecycle question, asked once for the site the host names. */
async function dispositionFor(site: {
  siteId: string;
  domain: string;
  host: string;
}): Promise<HostDisposition> {
  const serving = await hostedServingState(site.siteId).catch(() => ({ serve: false, because: "unreadable" }) as const);
  if (!serving.serve) return serving.because === "unreadable" ? { kind: "unavailable" } : goneFor(serving.because, site.siteId);
  return { kind: "site", siteId: site.siteId, domain: site.domain, host: site.host, indexable: true };
}

/** REQ-076 c10 and REQ-079 c6, through one predicate: a departed
 *  customer's pages stop being served, and both endings answer 410. The
 *  reason travels so an operator can tell which ending it was; it never
 *  changes the response. */
function goneFor(because: "retention_elapsed" | "account_deleted", siteId: string): HostDisposition {
  return { kind: "gone", reason: because === "account_deleted" ? "account_deleted" : "access_ended", siteId };
}

/**
 * What this Host is, to us.
 *
 * One lookup of the stored host, then one lifecycle question. Nothing here is cached: a `gone` disposition must not outlive
 * the request that found it, because a takedown is immediate (WO-028's
 * NFR) and a cached "serve" would keep a departed customer's pages up. The
 * cached article (issue 1242) does not change that: `src/middleware.ts`
 * asks this again on every request, before the cache, and sends only a
 * host that is a site now to the cached copy.
 */
export async function resolveHost(host: string): Promise<HostDisposition> {
  const name = normaliseHost(host);
  if (name === "") return { kind: "unknown" };

  // The deployment's own address is not a customer.
  if (name === appHost()) return { kind: "unknown" };

  // The label is the customer's (SPEC §5), so the host is matched whole against the one stored on their row.
  let chosen: Awaited<ReturnType<typeof hostedSiteForHostname>>;
  try {
    chosen = await hostedSiteForHostname(name);
  } catch {
    return { kind: "unavailable" };
  }
  return chosen === null ? { kind: "unknown" } : dispositionFor(chosen);
}
