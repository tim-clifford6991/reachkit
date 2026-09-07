// BUILD §9 — the one place a hosted address is composed.
//
// §9: "**Hosted CMS:** `content.{customer-domain}` by CNAME → our edge
// route serves static-rendered pages by Host header." Three addresses come
// out of that one sentence — the host a customer points, the address a page
// is publicly readable at, and the preview host ADR-002 keeps out of every
// index — and all three are composed here and nowhere else. A second
// composer is how a link in the calendar, a link in the published mail and
// the address the 24-hour check fetches come to disagree, and each of those
// is a statement to the customer about their own page.
//
// **The DNS record itself is not composed here.** `src/lib/publish/setup/
// cards.ts` already owns it (two shapes and no third, REQ-028 c2), and this
// module's whole contribution is the deployment-scoped target the record
// points at — `HOSTED_EDGE_CNAME_TARGET`, a binding rather than a constant
// because it differs per deployment. `hostedDnsRecord` below is that one
// substitution and no more; it re-implements nothing.
//
// The archived plan is WO-228.
import { HOSTED_SUBDOMAIN_LABEL, PREVIEW_HOST_SUFFIX } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { dnsRecordFor, type DnsPending, type DnsRecord } from "../../setup/cards";

export type { DnsPending, DnsRecord };

/** The host a customer points at us: `content.{their domain}`. */
export function hostedHostFor(domain: string): string {
  return `${HOSTED_SUBDOMAIN_LABEL}.${domain}`;
}

/** The preview host for a slug: `{slug}.reachkit.app` (§9). `noindex`
 *  forever, and never composed into a `live_url` — a preview address is
 *  the owner's own view of a page, never the address a page is published
 *  at (ADR-002). */
export function previewHostFor(slug: string): string {
  return `${slug}.${PREVIEW_HOST_SUFFIX}`;
}

/** The address a hosted page is publicly readable at. Always on the
 *  customer's own domain: there is no argument to this function that
 *  produces a ReachKit address, which is the property the canonical link,
 *  the sitemap entry and `publications.live_url` all rest on. */
export function liveUrlFor(a: { domain: string; slug: string }): string {
  return `https://${hostedHostFor(a.domain)}/${a.slug}`;
}

/** The record a founder sets, with this deployment's edge as its value.
 *  The two shapes are `cards.ts`'s and are not widened here. */
export function hostedDnsRecord(siteDomain: string | null): DnsRecord | DnsPending {
  return dnsRecordFor({ siteDomain, cnameTarget: env.HOSTED_EDGE_CNAME_TARGET });
}
