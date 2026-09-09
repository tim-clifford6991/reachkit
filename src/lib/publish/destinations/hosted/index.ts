// BUILD §9 — the hosted destination adapter.
//
// §9's hosted CMS is `content.{customer-domain}` by CNAME to an edge route
// that serves static-rendered pages by Host header. That route is
// `src/app/(hosted)/**` and it lands with this file (#49), which is why
// this adapter now delivers where #131's stub refused.
//
// **It writes no external system, and that is the whole shape of it.** The
// page *is* the `publications` row: there is no second system to reconcile,
// no destination-side marker to leave (ADR-080 — the unique index alone is
// this adapter's at-most-once guarantee, and the marker exists only for
// WordPress), and no byte leaves the process. `deliver` composes the one
// address the page will be readable at, clears the edge's cache tags, and
// says what it did.
//
// **`madeLive` follows the delivery's own success**, never `servesPublicly`
// and never `kind`: a delivery that failed made nothing live, and
// `unpublish` reads that arm back off the row.
//
// The archived plan is WO-228.
import type {
  DeliveryResult,
  DestinationAdapter,
  DestinationConfig,
  DestinationHealth,
  HealthReason,
  Publication,
  RenderedPage,
  UnpublishResult,
} from "../../types";
import { liveUrlFor } from "./address";
import { invalidateHosted } from "./cache";
import { siteForDraft } from "./store";

export { hostedDnsRecord, hostedHostFor, liveUrlFor, previewHostFor } from "./address";
export type { DnsPending, DnsRecord } from "./address";
export { invalidateHosted, tags } from "./cache";
export {
  hostedSiteForDomain,
  livePageBySlug,
  livePagesForSite,
  readFaq,
  siteForDraft,
  wasEverLive,
} from "./store";
export type {
  FaqEntry,
  HostedGrounding,
  HostedPage,
  HostedPublisher,
  HostedSite,
  PublishedPageRecord,
} from "./store";

export const HOSTED_ADAPTER: DestinationAdapter = Object.freeze({
  kind: "hosted" as const,

  /** The hosted blog serves the page publicly at an address we can fetch,
   *  so its pages are verified at 24 hours and receive a weekly verdict. */
  servesPublicly: true,

  /** ReachKit runs this destination, so it can take a page off it — which
   *  is why an unpublish here is §9's `removed` arm and not one of the four
   *  WordPress ones. Never merged back into `servesPublicly` (ADR-084
   *  Decision 2): the two agree here and differ at WordPress. */
  hostedByUs: true,

  /**
   * Makes the page live at `content.{customer-domain}/{slug}`.
   *
   * Idempotent on the draft id without doing anything to be: the address
   * is a pure function of the site's domain and the page's slug, so a
   * second call with the same key composes the same address and the unique
   * index refuses the second row. Nothing is created twice because nothing
   * is created at all.
   */
  async deliver(
    page: RenderedPage,
    _cfg: DestinationConfig,
    idempotencyKey: string
  ): Promise<DeliveryResult> {
    const site = await siteForDraft(idempotencyKey);
    if (site === null) {
      // A site with no address of its own has nowhere for a hosted page to
      // be. `destination_rejected` and not one of the four retryable
      // reasons: no repeated attempt gives the customer a domain, and the
      // page comes to rest in `needs_attention` where they can see it.
      return { ok: false, madeLive: false, reason: "destination_rejected" };
    }
    if (page.slug.trim() === "") {
      return { ok: false, madeLive: false, reason: "destination_rejected" };
    }

    // Immediately, and never on a TTL: the address answers with this page
    // on the next request rather than after a window (WO-028's NFR).
    invalidateHosted({ siteId: site.siteId });

    return {
      ok: true,
      madeLive: true,
      liveUrl: liveUrlFor({ domain: site.domain, slug: page.slug }),
    };
  },

  /**
   * Takes the page off the destination ReachKit serves.
   *
   * `removed` is the one arm this destination can take (ADR-081 decision
   * 3): the page is the row, and the row's `unpublished_at` is what the
   * edge reads to answer 410. This call sets nothing itself — `unpublish()`
   * writes the row — and clears the two tags so the 410 is answered at the
   * moment the row changes.
   *
   * It never reads `made_live_by_us`: the hosted page *is* the row, and
   * removing it is the same act whoever made it live.
   */
  async unpublish(pub: Publication): Promise<UnpublishResult> {
    invalidateHosted({ siteId: pub.siteId, publicationId: pub.id });
    return { ok: true, outcome: "removed" };
  },

  /**
   * What this destination's own end can be seen to be.
   *
   * The edge is this deployment: if this code is running, the thing a
   * pointed record points at is answering. So `ok` is not a claim here —
   * it is the same fact as the process being alive.
   *
   * **The one distinction it cannot make is `dns_elsewhere`.** #48's
   * comment expected this call to learn it; it cannot, and saying so is
   * better than a guess. Telling "the record points at our edge" from "the
   * record points at somebody else's server" needs the addresses a name
   * resolves to, and `resolvesInDns` — the product's one meaning of
   * "reachable" (BP-006 decision 2) — answers a boolean and exposes no
   * address by design. Widening it is issue #22's, not this adapter's, and
   * until it happens `check.ts`'s `dns_unset` arm carries every DNS
   * finding this product can honestly make.
   */
  async health(): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
    return { health: "ok", reason: null };
  },
});
