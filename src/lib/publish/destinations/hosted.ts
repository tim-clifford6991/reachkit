// BUILD §9 — the hosted destination adapter, declared and stubbed honestly.
//
// §9's hosted CMS is `content.{customer-domain}` by CNAME to an edge route
// that serves static-rendered pages by Host header. **That route does not
// exist yet** — it is issue #49, together with the sitemap, the canonical,
// the `FAQPage` schema and the robots policy served there.
//
// So this adapter ships its two booleans, which are facts and not stubs,
// and refuses to deliver. It does not return an address: a delivery that
// reported a live URL nothing answers at would put a link on the calendar,
// in the published mail and in the 24-hour check, and every one of them
// would be a statement this product cannot support. `destination_unavailable`
// is the true reason, it is retryable, and after §9's three retries the page
// comes to rest in `needs_attention` where it is visible — which is what a
// destination that cannot take a page is supposed to look like.
//
// When #49 lands, `deliver` calls the edge and this file changes; nothing
// that reads `servesPublicly` or `hostedByUs` changes with it.
import type {
  DeliveryResult,
  DestinationAdapter,
  DestinationHealth,
  HealthReason,
  UnpublishResult,
} from "../types";

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

  async deliver(): Promise<DeliveryResult> {
    return { ok: false, madeLive: false, reason: "destination_unavailable" };
  },

  async unpublish(): Promise<UnpublishResult> {
    // Nothing this adapter delivered is live, so there is nothing to take
    // down. The arm is `ok: false` rather than `removed`: `removed` is a
    // statement that the page is no longer served, and this adapter has
    // never served one.
    return { ok: false, reason: "destination_unavailable" };
  },

  async health(): Promise<{ health: DestinationHealth; reason: HealthReason }> {
    // The edge route is unbuilt, so nothing answers at the address a
    // pointed record would point to. `error`/`unreachable` is that fact,
    // stated as what it is; `ok` would be a claim.
    //
    // When #49 lands, this call learns the one distinction DNS resolution
    // alone cannot make — a record pointing at our edge against a record
    // pointing at somebody else's — and returns `ok` or
    // `expired`/`dns_elsewhere`. Nothing that reads this changes with it:
    // the reason travels with the state, so the caller never maps one
    // back into the other.
    return { health: "error", reason: "unreachable" };
  },
});
