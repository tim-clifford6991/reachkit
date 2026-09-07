// BUILD §9 — the publishing type leaf.
//
// The one module in `src/lib/publish/` that imports nothing from
// `src/lib/publish/`. Every other leaf of this subsystem names its
// contracts from here, which is what breaks the cycle ADR-092 records at
// file granularity: "the publishing subsystem's six leaves are one
// strongly connected component at node level and acyclic at file level".
//
// Its two imports are `Measured<T>` (§5's trichotomy) and `CopyKey`. The
// four verification checks are measured facts and REQ-004 forbids
// re-inventing the trichotomy per module; `DestinationView` names the
// sentences a surface renders and every sentence the product speaks is a
// key. Neither `src/lib/measure/` nor `src/lib/presentation/copy/` imports
// anything from here, so neither adds a cycle.
//
// The archived plan is WO-206.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";

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
  /** Which SEO plugins the destination's site **actually wrote** the title
   *  and description into, read back from what the destination returned
   *  and never inferred from what was sent (REQ-060 criteria 3 and 4,
   *  issue #156).
   *
   *  **Three states, and the third is the whole point of the field being
   *  optional.** Absent is "this destination has no such answer to give" —
   *  a destination ReachKit runs writes the metadata itself and has no
   *  plugin to find. An **empty array** is an answer, and the one criterion
   *  4 is about: the delivery happened, the site had neither plugin (or
   *  accepted the post and dropped the meta), and its page record carries
   *  one written line saying so. A non-empty array is the ordinary case and
   *  carries no line.
   *
   *  Collapsing absent into empty would put criterion 4's line on every
   *  hosted page, which is the one place REQ-060 says it must never appear.
   *
   *  Typed as strings rather than as the WordPress leaf's `SeoPlugin`
   *  deliberately: the vocabulary belongs to the adapter that knows it, and
   *  every reader in this subsystem needs only to know whether the list is
   *  empty. */
  seoWritten?: readonly string[];
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

/** REQ-062 criterion 6, narrowed by the 2026-09-01 fold to the sitemap and
 *  the robots policy alone — reachability moved into criterion 4's third
 *  outcome and is **not** a site condition. Exactly two kinds and no third.
 *
 *  Declared in the leaf for the same reason the verification shapes are:
 *  the page record, the published mail and the verification leaf all name
 *  it, and declaring it under `verify/` would make `record/ → verify/ →
 *  types.ts` a node-level cycle. `verify/site.ts` re-exports it, so every
 *  caller's spelling is that module's.
 *
 *  **Recorded only from an answer the site gave.** Where ReachKit could not
 *  reach what it went to read, or could not read what came back, no
 *  condition is written — the affected check is `unmeasured` for that one
 *  page and no later page's check is suppressed. */
export type SiteConditionKind = "publishes_no_sitemap" | "robots_blocks_site";

/** `foundAt` is on it because criterion 6 requires the date a condition was
 *  found, and because a condition is only ever as fresh as the last page
 *  checked on that site — nothing ever goes back to look (REQ-062's
 *  non-goal). */
export interface SiteCondition {
  kind: SiteConditionKind;
  foundAt: Date;
}

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
 *  state (ADR-086). */
export type DestinationHealth = "ok" | "expired" | "error";

/** What the last check concluded. Eight members, closed.
 *
 *  The three states above are what the customer *reads* — working, needs
 *  reconnecting, failing — and this is what selects the written line and
 *  the action underneath one of them. Three occasions land different lines
 *  inside `expired` alone (a record never pointed, a record pointed
 *  elsewhere, a credential that has run out), and `cannot_publish` lands
 *  its own inside `error`.
 *
 *  **`cannot_publish` is a reason and not a fourth health state**
 *  (ADR-086): a credential that can create a post and cannot publish it is
 *  `error` — failing — with a line of its own and an action that leads to
 *  a different account. Widening `DestinationHealth` instead would change
 *  a column §10 specifies and turn three states the customer reads into a
 *  mapping every surface has to know. */
export type HealthReason =
  | "never_connected"
  | "dns_unset"
  | "dns_elsewhere"
  | "credentials_expired"
  | "credentials_invalid"
  | "unreachable"
  | "destination_rejected"
  | "cannot_publish";

/** The one thing a surface offers against a destination.
 *
 *  **`reconnect_other_account` is a member of its own** and not
 *  `reconnect` with a different label (ADR-086): re-entering the same,
 *  perfectly valid credential is the one action guaranteed to change
 *  nothing, so a surface that rendered the ordinary Reconnect control in
 *  that state must fail to typecheck rather than fail a copy review. A
 *  copy key is a string a surface may route around; a union member is
 *  not. */
export type DestinationAction = "none" | "reconnect" | "reconnect_other_account" | "set_dns";

/**
 * Everything a surface may see about a destination, and nothing more.
 *
 * A state, a reason token, a date, a count, an action and two copy keys.
 * **There is no field on it that can hold a vendor string** — no message,
 * no status line, no payload — which is what makes §9's "credentials …
 * never logged" hold on the read path as a property of the type rather
 * than as care taken at each call site. The credential itself is not here
 * either: the `select` list this is built from does not name `config`.
 *
 * `copy.line` is `null` where the state has no line to add — a working
 * destination says its state and stops.
 */
export interface DestinationView {
  id: string;
  kind: DestinationKind;
  /** Rendered as working / needs reconnecting / failing. */
  health: DestinationHealth;
  reason: HealthReason | null;
  /** Never more than `DESTINATION_HEALTH_MAX_AGE_H` old when a surface
   *  reads it: the freshness promise is kept on the read path. */
  lastCheckedAt: Date;
  /** How many pages are waiting on this destination right now. A true
   *  count, derived; never a sentence. */
  heldPages: number;
  action: DestinationAction;
  copy: { state: CopyKey; line: CopyKey | null };
}

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
  /** What this destination's own end can be seen to be, right now.
   *
   *  It returns the **reason** as well as the state, because the adapter
   *  is the only thing that knows one: "the record points somewhere that
   *  is not us" and "the credential has run out" are answers only the
   *  destination's own end can give, and a caller that mapped a bare
   *  `error` back into a reason would be guessing at what the check
   *  found (ADR-086 decision 2 — the reason is what the check concluded
   *  and cannot be recovered later).
   *
   *  **It makes no write to the customer's site.** A health check that
   *  proved a capability by creating something could interfere with a
   *  delivery in flight, and a credential that may create is not the
   *  question being asked. */
  health(cfg: DestinationConfig): Promise<{ health: DestinationHealth; reason: HealthReason | null }>;
  /** **Can this credential publish, not merely create?** (REQ-060 c7,
   *  ADR-084 Decision 3.) Optional, and its absence is a fact rather than
   *  an omission: a destination ReachKit runs draws no such distinction —
   *  there is no account there whose permission to publish could differ
   *  from its permission to create — so `hosted` has none to declare.
   *
   *  It is a **separate call from `health`, and must stay one.** A site can
   *  answer its REST index perfectly and refuse to publish; folding the two
   *  would make one answer stand for both, and re-entering the same, valid
   *  credential would then appear to clear a state the probe decided
   *  (ADR-086). The check calls this beside `health`, records what it found
   *  on `destinations.publish_capable`, and `false` outranks every other
   *  answer.
   *
   *  **`false` is an answer; a read that failed is not.** An adapter that
   *  could not put the question rejects, and the check records nothing —
   *  mapping a network blip to `false` would hold a working customer's
   *  publishing while telling them their account lacks a permission it has.
   *
   *  **It makes no write to the customer's site**, for the same reason
   *  `health` makes none: it runs in line on the read path, and a
   *  capability proved by creating something leaves a post behind whenever
   *  the tidy-up fails. */
  canPublish?(cfg: DestinationConfig): Promise<boolean>;
  /** **Can this site carry ADR-083's findability stamp?** (REQ-060 c6,
   *  ADR-083 Decision 4.) Optional for the same reason `canPublish` is: a
   *  destination ReachKit runs has no such question to answer.
   *
   *  **Never merged with `canPublish`, and never returned together with
   *  it.** They gate different things — `canPublish` false holds the queue
   *  and decides `error`/`cannot_publish`; `canStamp` false is a *working*
   *  destination that publishes normally and only loses criterion 6's
   *  list — so one capability set would invite a caller to gate on the
   *  wrong member, and the caller that did would either hold a healthy
   *  customer's publishing or tell them to look in a list that is not
   *  there.
   *
   *  **It is not a health input.** The check records what it found on
   *  `destinations.stamp_capable` and lets the destination's state alone:
   *  a site that will not take a term is not a broken destination.
   *
   *  **`false` is an answer; a read that failed is not**, and **it makes no
   *  write to the customer's site** — both for the reasons `canPublish`
   *  gives. */
  canStamp?(cfg: DestinationConfig): Promise<boolean>;
}

// ── The draft, as the machine sees it ───────────────────────────────────

/** The pair of publishing mode and veto window governing a draft. §9:
 *  "Autopilot = auto-approve when the veto window … expires without a
 *  veto. Copilot = explicit approve only."
 *
 *  **Four members, and the name is still "the pair".** REQ-057 c8 tracks
 *  "the pair of publishing mode and veto window governing it" and points at
 *  REQ-073 c4 for what a change to it is — and c4's change is "a change to
 *  mode, veto window, publish time or time zone". The publish time and the
 *  zone decide *when* the page goes out, so a change to either makes what
 *  the customer was last told stop being true, which is the whole test c8
 *  states. Comparing two of the four would let a customer move the publish
 *  hour and have a page go out at a time they were never told.
 *
 *  There is no fifth member, and destination health is deliberately not one
 *  (BP-046 decision 5): a health flap would re-open the telling on a
 *  precondition c8 never names, and what holds a page against a destination
 *  that cannot publish is the `destination_working` guard. */
export interface GoverningPair {
  mode: "autopilot" | "copilot";
  vetoHours: number;
  /** `HH:mm`, 24-hour, read in `timezone`. */
  publishTime: string;
  /** IANA name, or `null` where the customer has not stated one. Nullable
   *  by design — REQ-073 c1 forbids a zone the customer never stated, and
   *  no read path falls back to the server's. A page whose site has no zone
   *  is held, never published in a zone nobody chose. */
  timezone: string | null;
}

/** The stop link a telling carries. Declared here, in the leaf that imports
 *  nothing from `src/lib/publish/`, for the reason `FailureReason` is: the
 *  telling names it and the veto module (which issues and redeems it)
 *  imports `transition()`, so declaring it there would put
 *  `machine/guards.ts → publishable/rule.ts → publishable/telling.ts →
 *  publishable/veto.ts → machine/index.ts` in the graph. `expiresAt` is
 *  `null` at a veto window of zero, where no interval exists in which a
 *  link could be used and none is issued (REQ-057 c7). */
export interface VetoLink {
  token: string;
  expiresAt: Date | null;
}

/** What was last said to the customer about whether and when a page
 *  publishes — `drafts.told`, as the rule reads it.
 *
 *  `pair` is what the comparison is against; `kind` and `publishesAt` are
 *  what was said, kept so the record can be read back without recomposing
 *  it. The destination clause is stored as sent and is not part of the
 *  comparison (BP-046 decision 5). */
export interface ToldRecord {
  pair: GoverningPair;
  kind: "interval" | "no_interval" | "approval_only";
  publishesAt: string | null;
  sentAt: string;
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
  /** What the customer was last told about this page, or `null` where they
   *  have never been told anything about it. It is the **record**, not the
   *  answer: whether the telling still stands is decided by comparing this
   *  record's pair against `governing`, and that comparison is
   *  `toldCurrentPair`'s (#46). A boolean here would have to be computed by
   *  whoever loaded the row, which is a second copy of the rule.
   *
   *  REQ-057 c8: "no page publishes at all without their having been told,
   *  on the pair it actually publishes under, either the interval they have
   *  to stop it or that no interval exists." */
  told: ToldRecord | null;
  governing: GoverningPair;
}
