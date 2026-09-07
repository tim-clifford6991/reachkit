// BUILD §9 — `publish()`: the delivery call after the claim, and the
// outcome written exactly as it happened.
//
// Three properties this file exists to keep, in order of how quietly they
// break:
//
//  1. **The adapter is called after the claim, never inside it.** The
//     `publications` row is written first (ADR-080) — it is what a crashed
//     attempt leaves behind for the next one to find — and only then does
//     anything leave the process.
//  2. **`made_live_by_us` is `result.madeLive` and nothing else.** Not
//     `servesPublicly`, not `hostedByUs`, not `liveUrl != null`, not
//     `kind === 'hosted'`. Those are facts about the *destination*;
//     `madeLive` is a fact about what this call did to this page, declared
//     by the adapter that did or did not do it (ADR-084 Decision 4).
//  3. **`verify_due_at` reads the address, never the kind.** A delivery
//     that came back with a live address is due for the 24-hour check;
//     one that did not is not. Deriving it from the destination kind is
//     how WordPress silently leaves the verified population.
//  4. **`seo_written` keeps "no answer" and "no plugin wrote" apart**
//     (issue #156). `undefined` on the result is a destination with no
//     such answer to give and stores `null`; an empty array is REQ-060
//     criterion 4's answer — delivered, and written into no plugin — and
//     stores `'{}'`. Written on this update and nowhere else: the fact
//     belongs to the delivery that learned it, and a claim that never
//     delivered leaves the column null.
//
// The outcome is written **as it happened**: a page that reached its
// destination is recorded delivered even if the switch was thrown
// mid-flight, and a page that did not is recorded failed. Neither is ever
// inferred from the switch — what the customer reads after switching off
// must never say nothing was published while a page went out, and never
// say a page went out that did not.
//
// The archived plan is WO-213.
import { PUBLISH_DELIVER_TIMEOUT_MS, PUBLISH_VERIFY_DELAY_H } from "@/lib/config/constants";
import { publishDb } from "../db";
import { adapterFor as defaultAdapterFor, withConfig } from "../destinations";
import { NoConfigError } from "../destinations/config";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type {
  Actor,
  DeliveryResult,
  DestinationAdapter,
  DestinationKind,
  FailureReason,
  RenderedPage,
} from "../types";
import { claim, type HeldBy } from "./claim";

export type { FailureReason } from "../types";

/**
 * The reasons a repeated attempt could clear — §9's "retry ×3" applies to
 * these and to no others. The other five members of `FailureReason` need
 * the customer, so a page carrying one goes to `needs_attention` at once
 * rather than failing three times first.
 *
 * Policy, not shape, which is why it lives here and the union lives in the
 * leaf.
 */
export const RETRYABLE: readonly FailureReason[] = Object.freeze([
  "network",
  "timeout",
  "destination_unavailable",
  "rate_limited",
] as const);

export function isRetryable(reason: FailureReason): boolean {
  return RETRYABLE.includes(reason);
}

export type PublishResult =
  | { ok: true; publicationId: string; liveUrl?: string; alreadyPublished: boolean }
  | { ok: false; reason: FailureReason; retryable: boolean; attemptNo: number }
  /** `matchedEntry` rides on the `claim_recheck` hold and on no other —
   *  the do-not-claim entry the page matched, in the customer's own words
   *  (BUILD §8 hard rule 4). */
  | { ok: false; reason: "held"; heldBy: HeldBy; matchedEntry?: string };

export interface PublishArgs {
  draftId: string;
  destination: DestinationKind;
  by: Actor;
  at?: Date;
  deps?: GuardDeps;
  /** The adapter registry. Injected so a caller under test drives a stub
   *  without a destination, and so #49 and #54 supply their adapters by
   *  registering them rather than by editing this file. */
  adapterFor?: (kind: DestinationKind) => DestinationAdapter | null;
}

export async function publish(a: PublishArgs): Promise<PublishResult> {
  const at = a.at ?? new Date();
  const resolve = a.adapterFor ?? defaultAdapterFor;

  const claimed = await claim({
    draftId: a.draftId,
    destination: a.destination,
    by: a.by,
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
  });
  if (!claimed.ok) return claimed;

  // A delivered row already exists: the previous attempt reached the
  // destination and its outcome was never recorded here. There is nothing
  // to deliver — the adapter is not called at all — and the page is
  // reconciled to `published` rather than sent again.
  if (claimed.alreadyPublished) {
    const row = await readOutcome(claimed.publicationId);
    await transition(a.draftId, "published", a.by, {
      at,
      ...(a.deps === undefined ? {} : { deps: a.deps }),
      reason: "already_delivered",
    });
    return {
      ok: true,
      publicationId: claimed.publicationId,
      ...(row?.live_url === null || row?.live_url === undefined ? {} : { liveUrl: row.live_url }),
      alreadyPublished: true,
    };
  }

  const adapter = resolve(a.destination);
  if (adapter === null) {
    return failWith(a, claimed.publicationId, claimed.attemptNo, "no_destination", at);
  }

  const page = await renderedPage(a.draftId);
  if (page === null) {
    return failWith(a, claimed.publicationId, claimed.attemptNo, "destination_rejected", at);
  }

  // Everything above this line has committed. Each byte the adapter sends
  // is bounded by the egress seam it goes through (BUILD §6.4: 8 s default,
  // 15 s hard maximum); `PUBLISH_DELIVER_TIMEOUT_MS` bounds the *attempt* —
  // an adapter makes several requests, and a destination that answers each
  // one slowly would otherwise hold a claimed publication open with no
  // bound at all. Two bounds on two different things, not one number in two
  // places.
  let result: DeliveryResult;
  try {
    result = await withinDeliveryBound(delivered(adapter, page, claimed.destinationId, a.draftId));
  } catch {
    // An adapter that threw told us nothing about what happened at the
    // destination. `timeout` is the retryable reason, and the idempotency
    // key reconciles a delivery that did land on the next attempt.
    result = { ok: false, madeLive: false, reason: "timeout" };
  }

  if (!result.ok) {
    const reason = result.reason ?? "destination_unavailable";
    return failWith(a, claimed.publicationId, claimed.attemptNo, reason, at);
  }

  const publishedAt = at;
  const liveUrl = result.liveUrl ?? null;
  await publishDb()
    .from<{ id: string }>("publications")
    .update({
      delivery_state: "delivered",
      published_at: publishedAt.toISOString(),
      live_url: liveUrl,
      remote_id: result.remoteId ?? null,
      failure_reason: null,
      // ADR-084 Decision 4 — copied straight off the `DeliveryResult` and
      // derived from nothing else.
      made_live_by_us: result.madeLive,
      // REQ-060 criterion 4 (issue #156), and the same discipline: what the
      // adapter *read back* from the destination, copied across as it is.
      // `undefined` and `[]` are two answers and stay two — absent is "this
      // destination has no such answer to give", empty is "delivered, and
      // written into no plugin", and only the second carries criterion 4's
      // line. The explicit `=== undefined` is what keeps them apart: a
      // falsy test would store `null` for both and put the line nowhere,
      // and a `?? []` would store the empty array for both and put it on
      // every hosted page.
      seo_written: result.seoWritten === undefined ? null : [...result.seoWritten],
      // BP-049's rule, landing on the write where `delivery_state` becomes
      // `delivered`: the address decides, never the kind.
      verify_due_at:
        liveUrl === null
          ? null
          : new Date(publishedAt.getTime() + PUBLISH_VERIFY_DELAY_H * 3600_000).toISOString(),
    })
    .eq("id", claimed.publicationId);

  await transition(a.draftId, "published", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason: "delivered",
  });

  return {
    ok: true,
    publicationId: claimed.publicationId,
    ...(liveUrl === null ? {} : { liveUrl }),
    alreadyPublished: false,
  };
}

/** One outcome write and one edge, for every way a delivery did not land.
 *  The reason is written as it happened; whether a retry follows is the
 *  retry policy's question, not this one's. */
async function failWith(
  a: PublishArgs,
  publicationId: string,
  attemptNo: number,
  reason: FailureReason,
  at: Date
): Promise<PublishResult> {
  await publishDb()
    .from<{ id: string }>("publications")
    .update({
      delivery_state: "failed",
      failure_reason: reason,
    })
    .eq("id", publicationId);

  await transition(a.draftId, "failed", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason,
  });

  return { ok: false, reason, retryable: isRetryable(reason), attemptNo };
}

interface OutcomeRow {
  id: string;
  live_url: string | null;
}

async function readOutcome(publicationId: string): Promise<OutcomeRow | null> {
  const { data, error } = await publishDb()
    .from<OutcomeRow>("publications")
    .select("id, live_url")
    .eq("id", publicationId)
    .single();
  if (error !== null || data === null) return null;
  return data;
}

interface DraftPageRow {
  title: string;
  body_md: string | null;
  meta: Record<string, unknown> | null;
  opportunities?: { proposed_slug?: string | null } | null;
}

/** What the adapter is handed. The *rendering* — the one clean typographic
 *  template, the canonical, the `FAQPage` schema — is the hosted edge's
 *  (#49); this assembles the page's own facts and nothing more, and writes
 *  no sentence of its own. */
async function renderedPage(draftId: string): Promise<RenderedPage | null> {
  const { data, error } = await publishDb()
    .from<DraftPageRow>("drafts")
    .select("title, body_md, meta, opportunities(proposed_slug)")
    .eq("id", draftId)
    .single();
  if (error !== null || data === null) return null;
  const slug = data.opportunities?.proposed_slug;
  if (typeof slug !== "string" || slug.length === 0) return null;
  return {
    title: data.title,
    slug,
    bodyMd: data.body_md ?? "",
    meta: data.meta ?? {},
  };
}

/**
 * The delivery, with the credential in plaintext for exactly as long as it
 * takes.
 *
 * The adapter is handed the **decrypted** config, and it is `withConfig`
 * that decrypts it: that function reads the ciphertext, calls this back
 * with the plaintext and returns what this returns — never the config — so
 * a credential cannot leave by the door it came in through. Nothing above
 * this line has ever held one. A destination with no row to read (a kind
 * this build has no destination for) is called with an empty config, which
 * is what the hosted adapter has always been handed.
 */
async function delivered(
  adapter: DestinationAdapter,
  page: RenderedPage,
  destinationId: string,
  idempotencyKey: string
): Promise<DeliveryResult> {
  if (destinationId === "") return adapter.deliver(page, {}, idempotencyKey);
  try {
    return await withConfig(destinationId, (cfg: Record<string, unknown>) =>
      adapter.deliver(page, cfg, idempotencyKey)
    );
  } catch (cause) {
    // A destination with no credential stored is an ordinary destination:
    // the hosted blog has none and never will. The adapter is called with
    // an empty config and says for itself whether it can work without one
    // — which is where that judgement belongs, and it is the same call the
    // hosted adapter has always received.
    if (cause instanceof NoConfigError) return adapter.deliver(page, {}, idempotencyKey);
    throw cause;
  }
}

/**
 * The delivery, bounded.
 *
 * A rejection — the adapter's own or this bound's — is caught by the caller
 * and becomes the retryable `timeout` reason, which is the honest reading:
 * an attempt that ran out of time told us nothing about what happened at
 * the destination, and the idempotency key reconciles a delivery that did
 * land on the next attempt.
 *
 * The timer is cleared on both arms, so a bounded call that returned early
 * does not hold the process open.
 */
function withinDeliveryBound(delivery: Promise<DeliveryResult>): Promise<DeliveryResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("publish: the delivery exceeded PUBLISH_DELIVER_TIMEOUT_MS")),
      PUBLISH_DELIVER_TIMEOUT_MS
    );
  });
  return Promise.race([delivery, bound]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
