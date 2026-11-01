// BUILD §9 — the hosted destination adapter: `content.{customer-domain}` by CNAME to the edge route
// `src/app/(hosted)/**`, which serves pages by Host header.
// It writes no external system: the page is the `publications` row, whose unique index is the at-most-once guarantee
// (ADR-080), and no byte leaves the process. `deliver` composes the address and clears the cache tags.
// `madeLive` follows the delivery's own success, never `servesPublicly` or `kind`.
import type {
  DeliveryResult,
  DestinationAdapter,
  DestinationConfig,
  DestinationHealth,
  HealthReason,
  Publication,
  RenderedPage,
  RestoreResult,
  UnpublishResult,
} from "../../types";
import { liveUrlOnHost } from "./address";
import { invalidateHosted } from "./cache";
import { addressesOwnPage } from "./own-page";
import { livePagesForSite, siteForDraft } from "./store";

export { hostedDnsRecord, hostedHostFor, liveUrlFor, previewHostFor } from "./address";
export type { DnsPending, DnsRecord } from "./address";
export { invalidateHosted, taggedForHosted, tags } from "./cache";
export type { HostedOwnPages } from "./own-page";
export type { LabelCheck, LabelRefusal } from "./label";
export { slugDescribesTitle } from "./moved";
export {
  hostedAddressNow,
  hostedIdentity,
  hostedSiteForDomain,
  hostedOwnPagesOfSite,
  hostedSiteForHostname,
  livePageBySlug,
  livePagesForSite,
  readDescription,
  readFaq,
  retiredSlugsForSite,
  hostedAddress,
} from "./store";
export type {
  AddressNow,
  HostedAddress,
  FaqEntry,
  HostedGrounding,
  HostedIdentity,
  HostedListing,
  HostedPage,
  HostedPublisher,
  HostedSite,
  PublishedPageRecord,
} from "./store";

export const HOSTED_ADAPTER: DestinationAdapter = Object.freeze({
  kind: "hosted" as const,

  /** Served publicly at an address we can fetch, so pages are verified at 24 hours and judged weekly. */
  servesPublicly: true,

  /** We run it, so an unpublish is §9's `removed` arm. Never merged with `servesPublicly` (ADR-084 decision 2): they
   *  agree here and differ at WordPress. */
  hostedByUs: true,

  /** Makes the page live at `content.{customer-domain}/{slug}`. Idempotent by construction: the address is a pure
   *  function of host and slug, and the unique index refuses a second row. */
  async deliver(
    page: RenderedPage,
    _cfg: DestinationConfig,
    idempotencyKey: string
  ): Promise<DeliveryResult> {
    const site = await siteForDraft(idempotencyKey);
    if (site === null) {
      // No address of its own: not retryable, since no attempt gives the customer a domain.
      return { ok: false, madeLive: false, reason: "destination_rejected" };
    }
    if (page.slug.trim() === "") {
      return { ok: false, madeLive: false, reason: "destination_rejected" };
    }
    // §7's update: only one of our own live publications on this host, as a new version at the same address; a page on
    // the customer's own site is never published a second time beside it. Readiness reads the same predicate.
    if (page.updateOf !== undefined) {
      const slugs = (await livePagesForSite(site.siteId, site.host)).map((live) => live.slug);
      if (!addressesOwnPage(page.updateOf, { host: site.host, slugs })) {
        return { ok: false, madeLive: false, reason: "destination_rejected" };
      }
      // SPEC §7: a retarget moves to its new search's address, never onto another live page, already that search's.
      if (page.moveTo !== undefined && slugs.includes(page.moveTo)) {
        return { ok: false, madeLive: false, reason: "destination_rejected" };
      }
    }
    // A metadata-only update has no body to serve; hosted pages get no Fix opportunity (SPEC §9), so this is a guard.
    if (page.metadataOnly !== undefined) {
      return { ok: false, madeLive: false, reason: "destination_rejected" };
    }

    // Immediately, never on a TTL: the next request answers with this page.
    invalidateHosted({ siteId: site.siteId });

    return {
      ok: true,
      madeLive: true,
      // The host read off the site, never recomposed, so the recorded address and the edge's cannot disagree.
      liveUrl: liveUrlOnHost({ host: site.host, slug: page.moveTo ?? page.slug }),
    };
  },

  /** `removed`, the one arm here (ADR-081 decision 3): `unpublish()` writes the row's `unpublished_at`, which the edge
   *  answers 410 from, and this clears the tags. It never reads `made_live_by_us`: the page is the row. */
  async unpublish(pub: Publication): Promise<UnpublishResult> {
    invalidateHosted({ siteId: pub.siteId, publicationId: pub.id });
    return { ok: true, outcome: "removed" };
  },

  /** The customer's put-back: `putBack()` clears `unpublished_at`, and this clears the tags so no cached 410 is served. */
  async restore(pub: Publication): Promise<RestoreResult> {
    invalidateHosted({ siteId: pub.siteId, publicationId: pub.id });
    return { ok: true };
  },

  /** The edge is this deployment, so `ok` is the same fact as the process being alive. It cannot tell `dns_elsewhere`:
   *  `resolvesInDns` (BP-006 decision 2) exposes no address, so the DNS findings are `check.ts`'s. */
  async health(): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
    return { health: "ok", reason: null };
  },
});
