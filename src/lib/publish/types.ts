// BUILD §9 — the publishing type leaf: the one module here that imports nothing from `src/lib/publish/`, so every leaf
// names its contracts from it and the subsystem is acyclic at file level (ADR-092).
// It imports `Measured<T>` (REQ-004 forbids a per-module trichotomy), `CopyKey` and `Language`, none of which imports back.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import type { Language } from "@/lib/locale/locales";

// ── The ten states ──────────────────────────────────────────────────────

/** §9's ten states and no eleventh; "held" is the absence of an edge, not a state (`switch/index.ts`). */
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

/** Who moved a page; a transition is never anonymous, and some edges are open to the customer only. */
export type Actor =
  | { kind: "customer"; userId: string }
  | { kind: "system"; job: "draft/generate" | "draft/recheck" | "publish/execute" | "publish/retry" | "publish/verify" | "content/recheck" };

/** One entry of `drafts.transitions`, append-only: one per move, never rewritten, rendered by no surface. */
export interface TransitionRecord {
  from: State;
  to: State;
  actor: Actor;
  reason?: string;
  at: string;
}

// ── Failure, delivery, unpublish ────────────────────────────────────────

/** Here because `DeliveryResult.reason` names it; `RETRYABLE` is policy and stays in `attempt/`. */
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
  /** The public address, set on every successful delivery (ADR-084); optional only because a failure has none. */
  liveUrl?: string;
  /** Opaque to us; the post/page id at the destination. Never rendered. */
  remoteId?: string;
  /** The SEO plugins the site actually wrote, read back, never inferred (REQ-060 c3, c4). Absent: no such answer (we
   *  write hosted metadata ourselves). Empty: delivered with no plugin written, which carries c4's line. Collapsing
   *  absent into empty would put that line on every hosted page. Strings, as only emptiness matters here. */
  seoWritten?: readonly string[];
  /** Did this call make the page live? The discriminator (ADR-084 decision 4), declared by the adapter and stored as
   *  `publications.made_live_by_us`. Required, so no adapter's omission reads as "never made live". Never
   *  `servesPublicly`, `hostedByUs` or `liveUrl != null`, which is non-null for every WordPress row. */
  madeLive: boolean;
  reason?: FailureReason;
}

/** What a put-back's write at the destination answered. */
export type RestoreResult = { ok: true } | { ok: false; reason: FailureReason };

/** Five outcomes, never a boolean (ADR-084 decision 4). Each WordPress outcome has its own line, so none may merge:
 *  `named_for_removal` says removing the post is the customer's to do, `already_gone` that nothing is.
 *  `unreachable` is `ok: true`: the page is `unpublished`; only the write into a site we do not own failed.
 *  `named_for_removal` has no members today and is kept for a page we created but did not make live. */
export type UnpublishResult =
  | { ok: true; outcome: "removed" }
  | { ok: true; outcome: "returned_to_draft" }
  | { ok: true; outcome: "named_for_removal" }
  | { ok: true; outcome: "already_gone" }
  | { ok: true; outcome: "unreachable"; retryOffered: true }
  | { ok: false; reason: FailureReason };

/** The five `ok` arms, as the column constraint and the record's line enumerate them. */
export type UnpublishOutcome = Extract<UnpublishResult, { ok: true }>["outcome"];

// ── Verification (BP-049 owns the behaviour; the shapes live here) ───────

/** Here, implemented by `verify/`, since the page record names the outcome and declaring it there would close a cycle. */
export type VerifyChecks = {
  reachable: Measured<boolean>;
  indexable: Measured<boolean>;
  sitemap: Measured<boolean>;
  aiReadable: Measured<boolean>;
};

export type NotConfirmed = "unreachable" | "server_error" | "redirected_away" | "not_our_page";

/** ADR-085: `page_not_found` and `could_not_confirm` carry different payloads so they cannot share a shape: one retires a
 *  page from judgement for ever, the other leaves it judged. `checkedAt` is on all three; a check not yet run is a
 *  `VerifyDisposition`, never a fourth "pending" arm. */
export type VerifyOutcome =
  | { outcome: "found"; checks: VerifyChecks; checkedAt: Date }
  | { outcome: "page_not_found"; status: 404 | 410; checkedAt: Date }
  | { outcome: "could_not_confirm"; why: NotConfirmed; checkedAt: Date };

/** REQ-062 c6: the sitemap and the robots policy, two kinds and no third; reachability is c4's, not a site condition.
 *  Recorded only from an answer the site gave: otherwise the check is `unmeasured` for that page alone. */
export type SiteConditionKind = "publishes_no_sitemap" | "robots_blocks_site";

/** `foundAt`, as criterion 6 requires the date; a condition is only as fresh as the last check, as nothing goes back to look. */
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

/** §10's `destinations.health` enum; a credential that cannot publish is a `HealthReason`, never a fourth state (ADR-086). */
export type DestinationHealth = "ok" | "expired" | "error";

/** What the last check concluded, closed: the customer reads three states, and this selects the line and action under
 *  one. `cannot_publish` is a reason under `error`, never a fourth state, which would change §10's column (ADR-086). */
export type HealthReason =
  | "never_connected"
  | "dns_unset"
  | "dns_elsewhere"
  | "credentials_expired"
  | "credentials_invalid"
  | "unreachable"
  | "destination_rejected"
  | "cannot_publish";

/** The one thing a surface offers, a closed union so every exhaustive map must handle each arm.
 *  `reconnect_other_account` is its own member (ADR-086): re-entering a valid credential changes nothing, so the
 *  ordinary Reconnect there must fail to typecheck. `connect` is its own too: a never-connected destination is not broken. */
export type DestinationAction =
  | "none"
  | "connect"
  | "reconnect"
  | "reconnect_other_account"
  | "set_dns";

/** Everything a surface may see about a destination. No field can hold a vendor string, so §9's "never logged" is a
 *  property of the type, and no `config`. `copy.line` is `null` where the state adds no line. */
export interface DestinationView {
  id: string;
  kind: DestinationKind;
  /** Rendered as working / needs reconnecting / failing. */
  health: DestinationHealth;
  reason: HealthReason | null;
  /** Never older than `DESTINATION_HEALTH_MAX_AGE_H` when read. */
  lastCheckedAt: Date;
  /** Pages waiting on this destination now: a derived count, never a sentence. */
  heldPages: number;
  action: DestinationAction;
  /** The customer's own host the pages are served at (SPEC §5), or `null` where we do not host. */
  hostname: string | null;
  /** The domain list's word: "waiting for DNS" then "live" (SPEC §5); `null` with no host. */
  hostnameState: "pending_dns" | "live" | null;
  copy: {
    state: CopyKey;
    line: CopyKey | null;
    /** The key for `hostnameState`, or `null` with no host. */
    hostname: CopyKey | null;
  };
}

/** Opaque here; each adapter narrows it. Encrypted at rest, never logged (§9). */
export type DestinationConfig = Readonly<Record<string, unknown>>;

/** What an adapter is handed, rendered by `render/markdown.ts`, the one renderer every surface shares. */
export interface RenderedPage {
  title: string;
  slug: string;
  bodyMd: string;
  meta: Readonly<Record<string, unknown>>;
  /** SPEC §7: the byline as generation recorded it (`drafts.attribution`), or none. */
  byline?: string | null;
  /** SPEC §7: the site's domain and language (D66), for the made-with note where no template of ours prints it. */
  site?: { domain: string; language: Language };
  /** The existing page this updates (§7's third asset kind); an adapter changes that address and never mints a second. */
  updateOf?: string;
  /** SPEC §7: a retarget's new slug, beside `updateOf` only; hosted moves there with a 301, WordPress keeps its address. */
  moveTo?: string;
  /** SPEC §9: change only the title and/or SEO description, beside `updateOf` only; an adapter that cannot, refuses. */
  metadataOnly?: { title: string | null; description: string | null };
}

/** The `publications` row. */
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
  /** `publications.made_live_by_us`, required as `DeliveryResult.madeLive` is, so `unpublish` never re-reads the site. */
  madeLiveByUs: boolean;
  verifyDueAt: Date | null;
}

export interface DestinationAdapter {
  kind: DestinationKind;
  /** Publicly readable at an address we can fetch (both kinds, ADR-084): governs `live_url`, the 24-hour check and the
   *  weekly verdict, as a field so a new adapter never defaults into judgement. */
  servesPublicly: boolean;
  /** Do we run it and can take a page off it? Hosted only: §9's "removed" arm against "returned to draft". Never merged
   *  with `servesPublicly` (ADR-084 decision 2): they differ at WordPress, and merging stops verification or deletes
   *  from a site we do not own. */
  hostedByUs: boolean;
  /** MUST be idempotent on `idempotencyKey` (the draft id): a repeat finds the existing post, never a second (ADR-080). */
  deliver(
    page: RenderedPage,
    cfg: DestinationConfig,
    idempotencyKey: string
  ): Promise<DeliveryResult>;
  /** The family from `hostedByUs`, the WordPress arm from `madeLiveByUs`, never a re-read; only gone or unreachable is learned here. */
  unpublish(pub: Publication, cfg: DestinationConfig): Promise<UnpublishResult>;
  /** SPEC §7: the customer's put-back of a page their take-down left `removed`. Absent at WordPress, as setting a post
   *  to publish is a call ADR-084 decision 1 keeps out of its client. */
  restore?(pub: Publication, cfg: DestinationConfig): Promise<RestoreResult>;
  /** The destination's own end now, with the reason only it knows (ADR-086 decision 2). It never writes to the
   *  customer's site, which could interfere with a delivery in flight. */
  health(cfg: DestinationConfig): Promise<{ health: DestinationHealth; reason: HealthReason | null }>;
  /** Can this credential publish, not merely create? (REQ-060 c7, ADR-084 decision 3.) Hosted has no such question.
   *  A separate call from `health`, and must stay one (ADR-086): `false` outranks every answer on `publish_capable`.
   *  `false` is an answer; a failed read rejects and records nothing. It never writes to the customer's site. */
  canPublish?(cfg: DestinationConfig): Promise<boolean>;
  /** Can this site carry ADR-083's findability stamp? (REQ-060 c6, ADR-083 decision 4.) Never merged or returned with
   *  `canPublish`: that one holds the queue, while `false` here only loses c6's list. Not a health input, recorded on
   *  `stamp_capable`. `false` is an answer, a failed read is not, and it never writes to the customer's site. */
  canStamp?(cfg: DestinationConfig): Promise<boolean>;
}

// ── The draft, as the machine sees it ───────────────────────────────────

/** The governing pair: four members, since REQ-073 c4's change is "mode, veto window, publish time or time zone" and
 *  the last two decide when a page goes out (REQ-057 c8). No fifth: destination health is not one (BP-046 decision 5). */
export interface GoverningPair {
  mode: "autopilot";
  vetoHours: number;
  /** `HH:mm`, 24-hour, read in `timezone`. */
  publishTime: string;
  /** IANA name, or `null` where none is stated (REQ-073 c1): such a page is held, never published in a zone nobody chose. */
  timezone: string | null;
}

/** The stop link a telling carries, here since `veto.ts` imports `transition()` and would close a cycle. `expiresAt` is
 *  `null` at a zero window, where none is issued (REQ-057 c7). */
export interface VetoLink {
  token: string;
  expiresAt: Date | null;
}

/** `drafts.told`: what was last said. `pair` is compared; `kind` and `publishesAt` are what was said; the destination
 *  clause is not compared (BP-046 decision 5). */
export interface ToldRecord {
  pair: GoverningPair;
  /** `approval_only` is only read, from older rows; nothing writes it. */
  kind: "interval" | "no_interval" | "approval_only";
  publishesAt: string | null;
  sentAt: string;
  /** Whether a mail left with it; `false` with the mail off, absent on older rows. */
  mailed?: boolean;
}

/** What the publishable rule and the guards are handed; this leaf declares the shape and populates nothing. */
export interface DraftView {
  id: string;
  siteId: string;
  state: State;
  vetoDeadline: Date | null;
  approvedAt: Date | null;
  approvedBy: Actor | null;
  hasUnsavedEdit: boolean;
  claimRecheckOutstanding: boolean;
  /** What the customer was last told, or `null`: the record, not a verdict, which `toldCurrentPair` decides against
   *  `governing`, never a second copy of the rule (REQ-057 c8). */
  told: ToldRecord | null;
  governing: GoverningPair;
}
