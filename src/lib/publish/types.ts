// BUILD §9 — the publishing type leaf.
//
// The one module in `src/lib/publish/` that imports nothing from
// `src/lib/publish/`. Every other leaf of this subsystem names its
// contracts from here, which is what breaks the cycle ADR-092 records at
// file granularity: "the publishing subsystem's six leaves are one
// strongly connected component at node level and acyclic at file level".
//
// Its one import is `Measured<T>` (§5's trichotomy): the four verification
// checks are measured facts and REQ-004 forbids re-inventing the
// trichotomy per module. `src/lib/measure/` imports nothing from here, so
// that import adds no cycle.
//
// The archived plan is WO-206.
import type { Measured } from "@/lib/measure/measured";

// ── The ten states ──────────────────────────────────────────────────────

/** §9's state machine, exactly. Ten members and no eleventh: a page in the
 *  pipeline is in exactly one of them at every moment. "Held" is not here
 *  — a held page is the absence of an edge, not a state (see
 *  `switch/index.ts`). */
export type State =
  | "planned"
  | "generating"
  | "in_review"
  | "approved"
  | "publishing"
  | "published"
  | "skipped"
  | "failed"
  | "needs_attention"
  | "unpublished";

/** Who moved a page. A transition is never anonymous: the record `transition()`
 *  appends carries this, and the `needs_attention → generating` edge is open
 *  only to the customer arm. */
export type Actor =
  | { kind: "customer"; userId: string }
  | { kind: "system"; job: "draft/generate" | "publish/execute" | "publish/verify" };

/** One entry of `drafts.transitions`. Append-only: `transition()` adds one
 *  per move and nothing rewrites an earlier one. No surface renders these. */
export interface TransitionRecord {
  from: State;
  to: State;
  actor: Actor;
  reason?: string;
  at: string;
}

// ── Failure, delivery, unpublish ────────────────────────────────────────

/** Declared here, in the leaf, not in `attempt/`: `DeliveryResult.reason`
 *  names it and this file imports nothing from `src/lib/publish/`.
 *  `attempt/index.ts` re-exports it, so every caller's spelling is
 *  unchanged. `RETRYABLE` stays in `attempt/` — it is policy, not shape.
 *
 *  The first four are reasons a repeated attempt could clear; the last five
 *  need the customer and go straight to `needs_attention`. */
export type FailureReason =
  // repeated attempt could clear it — retried, at most three times (§9)
  | "network"
  | "timeout"
  | "destination_unavailable"
  | "rate_limited"
  // repeated attempt could not clear it — straight to needs_attention
  | "credentials_expired"
  | "credentials_invalid"
  | "dns_not_pointed"
  | "destination_rejected"
  | "no_destination";

export interface DeliveryResult {
  ok: boolean;
  /** The address the page is publicly readable at. Set on every successful
   *  delivery at every destination (ADR-084: content is published complete
   *  everywhere). Optional only because a *failed* delivery has no
   *  address — never because a destination lacks one. */
  liveUrl?: string;
  /** Opaque to us; the post/page id at the destination. Never rendered. */
  remoteId?: string;
  /** Did *this call* make the page live at the destination? ADR-082's
   *  discriminator, carried forward unchanged by ADR-084 Decision 4:
   *  declared by the adapter that did or did not do it, stored by
   *  `publish()` as `publications.made_live_by_us`.
   *
   *  **Required, and that is the point.** An optional member would let a
   *  future adapter omit it and be read as "never made live", which routes
   *  every one of its pages into §9's "named for the customer, not
   *  touched" outcome for a destination ReachKit may well have made live.
   *
   *  It is not `servesPublicly`, not `hostedByUs`, and not
   *  `liveUrl != null`. The last substitution has **changed sign, not
   *  stopped being wrong**: ADR-081 rejected it because `live_url` was null
   *  for every WordPress row; it is now non-null for every WordPress row
   *  and would classify every WordPress page as made-live-by-us, including
   *  one a future draft-delivery option produced, whose post ReachKit would
   *  then write into. */
  madeLive: boolean;
  reason?: FailureReason;
}

/** ADR-082, carried forward unchanged in shape by ADR-084 Decision 4: five
 *  outcomes, never a boolean and no longer three. Each of §9's four
 *  WordPress outcomes has its own written line on the page's record, and
 *  collapsing any pair makes one of those lines unrenderable —
 *  `named_for_removal` tells the customer "removing the post is theirs to
 *  do" and `already_gone` tells them "nothing is theirs to remove", and a
 *  customer sent to delete a post that is not there was told the wrong
 *  one.
 *
 *  `unreachable` is `ok: true` on purpose: the page did reach
 *  `unpublished` and the product did stop treating it as live — what
 *  failed is the write into a site we do not own, and that is the outcome,
 *  not a failure of the action.
 *
 *  **The empty arm has swapped ends.** ADR-082's warning protected
 *  `returned_to_draft`; since ADR-084 that is every WordPress unpublish
 *  that reaches the site, and `named_for_removal` is the arm with no
 *  members — held open against a page ReachKit created but did not make
 *  live. Not one of the five is deleted. */
export type UnpublishResult =
  | { ok: true; outcome: "removed" }
  | { ok: true; outcome: "returned_to_draft" }
  | { ok: true; outcome: "named_for_removal" }
  | { ok: true; outcome: "already_gone" }
  | { ok: true; outcome: "unreachable"; retryOffered: true }
  | { ok: false; reason: FailureReason };

/** The five `ok` arms, as data — the column constraint and the record's
 *  line both enumerate the same five. */
export type UnpublishOutcome = Extract<UnpublishResult, { ok: true }>["outcome"];

// ── Verification (BP-049 owns the behaviour; the shapes live here) ───────

/** Declared here and implemented by the verification leaf (#50) — the same
 *  instrument `FailureReason` uses, for the same reason: the page record
 *  must name the recorded outcome of the one check, and this file imports
 *  nothing from `src/lib/publish/`, so declaring these under `verify/`
 *  would make `record/ → verify/ → types.ts` a node-level cycle. */
export type VerifyChecks = {
  reachable: Measured<boolean>;
  indexable: Measured<boolean>;
  sitemap: Measured<boolean>;
  aiReadable: Measured<boolean>;
};

export type NotConfirmed = "unreachable" | "server_error" | "redirected_away" | "not_our_page";

/** ADR-085: three arms, and `page_not_found` and `could_not_confirm` carry
 *  **different payloads** so they cannot be given one shape without a type
 *  error. They render as the same grey line and have opposite consequences
 *  — one retires a page from judgement forever, the other leaves it fully
 *  judged — which is why the separation is pinned at the type level and
 *  not only in a behavioural test.
 *
 *  `checkedAt` is on all three: no surface may state a page's standing
 *  without carrying what ReachKit saw and when. There is no fourth arm and
 *  no "pending" — a check that has not run is a `VerifyDisposition`. */
export type VerifyOutcome =
  | { outcome: "found"; checks: VerifyChecks; checkedAt: Date }
  | { outcome: "page_not_found"; status: 404 | 410; checkedAt: Date }
  | { outcome: "could_not_confirm"; why: NotConfirmed; checkedAt: Date };

export type VerifyDisposition =
  | { kind: "not_yet"; dueAt: Date }
  | { kind: "due" }
  | { kind: "done"; result: VerifyOutcome }
  | { kind: "never"; because: "taken_down_first" | "no_live_address" };

// ── Destinations ────────────────────────────────────────────────────────

/** §10's `destinations.kind` enum, unchanged. */
export type DestinationKind = "hosted" | "wordpress";

/** §10's `destinations.health` enum, unchanged. A credential that cannot
 *  publish is a `HealthReason` beside one of these three, never a fourth
 *  state (ADR-086) — that reason is #48's. */
export type DestinationHealth = "ok" | "expired" | "error";

/** Opaque here; each adapter narrows it. Encrypted at rest, never logged
 *  (§9). Nothing in this subsystem reads a member of it. */
export type DestinationConfig = Readonly<Record<string, unknown>>;

/** What an adapter is handed to deliver. The rendering is #49's. */
export interface RenderedPage {
  title: string;
  slug: string;
  bodyMd: string;
  meta: Readonly<Record<string, unknown>>;
}

/** The `publications` row (§10, plus this issue's own columns). */
export interface Publication {
  id: string;
  draftId: string;
  siteId: string;
  destination: DestinationKind;
  deliveryState: "claimed" | "delivered" | "failed";
  attemptNo: number;
  claimedAt: Date;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  liveUrl: string | null;
  remoteId: string | null;
  failureReason: FailureReason | null;
  mode: "approved" | "autopilot";
  unpublishOutcome: UnpublishOutcome | null;
  /** `publications.made_live_by_us`. Required, not optional, for the same
   *  reason `DeliveryResult.madeLive` is. It is on `Publication` because
   *  `unpublish` is handed one and reads the arm from it; an adapter that
   *  could not see the column would have to re-read the customer's site,
   *  which ADR-082 rejects. */
  madeLiveByUs: boolean;
  verifyDueAt: Date | null;
}

export interface DestinationAdapter {
  kind: DestinationKind;
  /** Does this destination make the page publicly readable at an address we
   *  can fetch? True for both kinds since ADR-084. It governs whether
   *  `live_url` is set, whether the page is verified at 24 hours, and
   *  whether it receives a weekly verdict — a field on the adapter, not a
   *  `kind === 'hosted'` test at each caller, so a third adapter cannot
   *  join the judged population by defaulting into it. */
  servesPublicly: boolean;
  /** Does ReachKit run this destination, so that it can take the page off
   *  it? True for hosted only. It governs §9's "removed" arm against
   *  "returned to draft".
   *
   *  **ADR-084 Decision 2 — never merge this back into `servesPublicly`.**
   *  The two were one boolean until 2026-09-01 because they had the same
   *  value at every destination that existed; they now differ at
   *  WordPress, and collapsing them either stops verifying live customer
   *  pages or points `unpublish` at a delete call against a site ReachKit
   *  does not own. Neither failure is visible in a test that exists. */
  hostedByUs: boolean;
  /** MUST be idempotent on `idempotencyKey` (the draft id): a second call
   *  with the same key after a delivery whose outcome we never recorded
   *  must find the existing post and return it, never create a second one.
   *  The unique index cannot reach inside a destination we do not own —
   *  ADR-080. */
  deliver(
    page: RenderedPage,
    cfg: DestinationConfig,
    idempotencyKey: string
  ): Promise<DeliveryResult>;
  /** Which family of arms applies is read from `hostedByUs`, and which
   *  arm within the WordPress family from `Publication.madeLiveByUs` —
   *  never from a re-read of the destination. Whether the post is still
   *  there, and whether the site answered at all, are facts only this call
   *  can learn. */
  unpublish(pub: Publication, cfg: DestinationConfig): Promise<UnpublishResult>;
  health(cfg: DestinationConfig): Promise<DestinationHealth>;
}

// ── The draft, as the machine sees it ───────────────────────────────────

/** The pair of publishing mode and veto window governing a draft. §9:
 *  "Autopilot = auto-approve when the veto window … expires without a
 *  veto. Copilot = explicit approve only." */
export interface GoverningPair {
  mode: "autopilot" | "copilot";
  vetoHours: number;
}

/** What the publishable rule and the guards are handed. The last four
 *  members are the draft row's own and are populated by #44's generation
 *  columns; this leaf declares the shape, it does not populate it. */
export interface DraftView {
  id: string;
  siteId: string;
  state: State;
  vetoDeadline: Date | null;
  approvedAt: Date | null;
  approvedBy: Actor | null;
  hasUnsavedEdit: boolean;
  claimRecheckOutstanding: boolean;
  /** Whether the customer has been told, on the pair actually in force,
   *  either the interval they have to stop it or that none exists
   *  (REQ-057 c8). The rule that decides it is #46's. */
  told: boolean;
  governing: GoverningPair;
}
