// BUILD §9 — the one place a hosted address is composed: the host a customer points, a page's public address, and the
// preview host ADR-002 keeps out of every index. A second composer would let the calendar, the mail and the check disagree.
// The DNS record is `setup/cards.ts`'s (two shapes, REQ-028 c2); this adds only the per-deployment `HOSTED_EDGE_CNAME_TARGET`.
import { PREVIEW_HOST_SUFFIX } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { dnsRecordFor, type DnsPending, type DnsRecord } from "../../setup/cards";
import { hostFor } from "./label";

export type { DnsPending, DnsRecord };

/** The host a customer points at us: `<label>.{their domain}`. The label is the customer's (SPEC §5); omitted, it is
 *  the default. `label.ts`'s `hostFor` composes it, so the record, the edge and the domain list name one string. */
export function hostedHostFor(domain: string, label?: string | null): string {
  return hostFor({ label: label ?? null, domain });
}

/** The preview host for a slug: `{slug}.reachkit.app` (§9). `noindex` forever and never a `live_url` (ADR-002). */
export function previewHostFor(slug: string): string {
  return `${slug}.${PREVIEW_HOST_SUFFIX}`;
}

/** A hosted page's public address, always on the customer's own domain: no argument yields a ReachKit address, which
 *  the canonical link, the sitemap entry and `publications.live_url` rest on. */
export function liveUrlFor(a: { domain: string; slug: string; label?: string | null }): string {
  return liveUrlOnHost({ host: hostedHostFor(a.domain, a.label ?? null), slug: a.slug });
}

/** The same address from a stored host, which delivery and the canonical link read; `liveUrlFor` ends here too. */
export function liveUrlOnHost(a: { host: string; slug: string }): string {
  return `https://${a.host}/${a.slug}`;
}

/** The record a founder sets, valued at this deployment's edge; the two shapes are `cards.ts`'s, not widened. */
export function hostedDnsRecord(
  siteDomain: string | null,
  label?: string | null
): DnsRecord | DnsPending {
  return dnsRecordFor({
    siteDomain,
    cnameTarget: env.HOSTED_EDGE_CNAME_TARGET,
    label: label ?? null,
  });
}
