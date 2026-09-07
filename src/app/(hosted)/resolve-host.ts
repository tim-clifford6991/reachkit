// BUILD §9 — the one place a Host header becomes a customer.
//
// §9: "**Hosted CMS:** `content.{customer-domain}` by CNAME → our edge
// route serves static-rendered pages by Host header." Everything the edge
// answers — a page, a robots document, a sitemap, a 404, a 410 — is decided
// from the disposition this module returns, and nothing on the surface
// re-derives it.
//
// **Resolution is exact and never falls back.** A `content.` label on a
// domain no `sites` row claims is `unknown`, which is a 404 and not a
// ReachKit page: on a stranger's domain the operator is not named, no other
// customer's content is served in its place, and there is no default site
// to land on. `hostedSiteForDomain` is where that property lives — one
// indexed lookup, one exact match — and this module adds no second path.
//
// **`indexable` is a constant of the disposition** (ADR-002 decision 2):
// `true` on the `site` arm, `false` on the `preview` arm, both as literal
// types, so a preview with `indexable: true` is a type error rather than a
// setting somebody could change. `{slug}.reachkit.app` is `noindex`
// **forever** — the site-reputation-abuse guardrail §9 and §14 state, and
// customer content never ranks on our domain. Removing it reads as an
// obvious improvement and is a requirement change.
//
// **This surface writes nothing.** No `POST`, no server action, no
// mutation anywhere under `src/app/(hosted)/`, so no crawler and no visitor
// can advance §9's state machine by fetching a page.
//
// **It fails closed.** A lookup that errors resolves to `unknown`: serving
// a page we could not confirm belongs to this host is the one failure that
// matters here, and 404 is the safe direction.
//
// The archived plan is WO-229. Two departures from it, both forced and both
// stated: the cache tags live in `@/lib/publish/destinations/hosted`
// because their callers are the publish and unpublish paths and `src/lib/`
// may not import `src/app/` (ARCHITECTURE rule 6); and `gone:'unpublished'`
// is produced by the page route rather than here, because whether a *page*
// was taken down is not a fact about a *host* — the disposition is shared
// so that all three reasons still yield one `gone` response and not three.
import { PREVIEW_HOST_SUFFIX, HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { hostedServingState } from "@/lib/account/billing";
import { hostedSiteForDomain } from "@/lib/publish/destinations/hosted";

export { tags } from "@/lib/publish/destinations/hosted";

export type HostDisposition =
  | { kind: "site"; siteId: string; domain: string; indexable: true }
  | { kind: "preview"; slug: string; indexable: false }
  | { kind: "gone"; reason: "unpublished" | "access_ended" | "account_deleted" }
  | { kind: "unknown" };

const CONTENT_PREFIX = `${HOSTED_SUBDOMAIN_LABEL}.`;
const PREVIEW_SUFFIX = `.${PREVIEW_HOST_SUFFIX}`;

/** The Host header as a hostname: lower-cased, port removed, trailing dot
 *  removed. A header is whatever a client sent, and every comparison below
 *  is against a normalised name. */
export function normaliseHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  const withoutPort = trimmed.startsWith("[")
    ? trimmed // an IPv6 literal is never one of ours; left whole and unmatched
    : (trimmed.split(":")[0] ?? "");
  return withoutPort.endsWith(".") ? withoutPort.slice(0, -1) : withoutPort;
}

/** This deployment's own address. Subtracted from the preview suffix's
 *  children so that `dev.reachkit.app` — and the apex at go-live — is never
 *  read as a customer's preview host. */
function appHost(): string {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** REQ-076 c10 and REQ-079 c6, through one predicate: a departed
 *  customer's pages stop being served, and both endings answer 410. The
 *  reason travels so an operator can tell which ending it was; it never
 *  changes the response. */
function goneFor(because: "retention_elapsed" | "account_deleted"): HostDisposition {
  return { kind: "gone", reason: because === "account_deleted" ? "account_deleted" : "access_ended" };
}

/**
 * What this Host is, to us.
 *
 * One lookup on `sites.domain` for a `content.` host, then one lifecycle
 * question. Nothing here is cached: a `gone` disposition must not outlive
 * the request that found it, because a takedown is immediate (WO-028's
 * NFR) and a cached "serve" would keep a departed customer's pages up.
 */
export async function resolveHost(host: string): Promise<HostDisposition> {
  const name = normaliseHost(host);
  if (name === "") return { kind: "unknown" };

  // The deployment's own address is not a customer and not a preview.
  if (name === appHost()) return { kind: "unknown" };

  if (name.startsWith(CONTENT_PREFIX)) {
    const domain = name.slice(CONTENT_PREFIX.length);
    if (domain === "") return { kind: "unknown" };

    let site: Awaited<ReturnType<typeof hostedSiteForDomain>>;
    try {
      site = await hostedSiteForDomain(domain);
    } catch {
      return { kind: "unknown" };
    }
    if (site === null) return { kind: "unknown" };

    let serving: Awaited<ReturnType<typeof hostedServingState>>;
    try {
      serving = await hostedServingState(site.siteId);
    } catch {
      // `hostedServingState` already fails closed on a deletion it cannot
      // read; a throw here is the same direction, one level out.
      return goneFor("account_deleted");
    }
    if (!serving.serve) return goneFor(serving.because);

    return { kind: "site", siteId: site.siteId, domain: site.domain, indexable: true };
  }

  if (name.endsWith(PREVIEW_SUFFIX)) {
    const slug = name.slice(0, -PREVIEW_SUFFIX.length);
    // One label only: `a.b.reachkit.app` is not a preview of anything.
    if (slug === "" || slug.includes(".")) return { kind: "unknown" };
    return { kind: "preview", slug, indexable: false };
  }

  return { kind: "unknown" };
}
