// BUILD §4.3 — the closed shape of the one submit, and the one write path
// into setup completion.
//
// The archived plan is WO-146. "Three cards, one submit" (§4.3): a field
// absent from `SetupSubmission` cannot be sent, which is how REQ-025
// criterion 1's "and for nothing else" is enforced rather than reviewed.
// **No field here can carry a duration, an estimate or an engine
// parameter** — no cadence, no cap, no question count, no model choice —
// and `tests/app/setup/submit.test.ts` pins the member list so a fourth
// decision cannot be added by adding a field.
//
// **The writes are a declared interface, and that is why this file never
// changed when they became real.** `SetupStore` is the seam: the account,
// the site row and the deep-pass queue are all written behind it.
// `liveSetupStore` in `_setup/store.ts` is the implementation
// `_setup/provider.ts` returns for every founder; the fixture in
// `_setup/fixture.ts` remains, recording what it was asked to do, for the
// suites that drive `completeSetup` without a database. This file holds
// neither, and nothing here pretends a row was written.
import { BATTERY } from "@/lib/config/constants";
import { registrableDomain } from "@/lib/market/rivals/domains";

/** The closed shape of the one submit (REQ-025 c1, c2). */
export interface SetupSubmission {
  /** Identity, not configuration (REQ-025 c1). */
  domain: string;
  /** The market card supplies it — confirmed or stated (REQ-026 c4). */
  category: string;
  /** At most `BATTERY.COMPETITORS_MAX`; an empty set is legal (REQ-026 c11). */
  competitors: readonly string[];
  /** REQ-028 c3: WordPress can be deferred and setup still completes. */
  destination: { kind: "hosted" } | { kind: "wordpress"; connectLater: true };
}

export type SetupRefusal =
  | "no_active_access"
  | "already_complete"
  | "invalid_domain"
  | "market_missing"
  | "too_many_competitors";

export type SetupResult = { ok: true; siteId: string } | { ok: false; refused: SetupRefusal };

/** Whether setup has been submitted for this account. The one predicate
 *  every account route consults; there is no second copy. */
export type SetupProgressState =
  | { complete: false; siteId: string; paidAt: Date }
  | { complete: true; siteId: string; completedAt: Date };

/**
 * The writes and reads completing setup needs, declared where they are
 * used and implemented elsewhere. `_setup/store.ts`'s `liveSetupStore()`
 * supplies every member, and `_setup/provider.ts` is what hands it to
 * `POST /api/setup` — against the account `currentSession()` names (#133):
 *
 *   hasActiveAccess  → §13 billing's `hasActiveAccess()`, ADR-050's
 *                      `users.paid_through > now()` alone
 *   resolvesInDns    → §6.4's `resolvesInDns` (#22) — passed in rather
 *                      than imported so this function stays decidable
 *                      without a network stub
 *   readProgress     → `sites.setup_completed_at`
 *   commitSetup      → the three decisions plus `setup_completed_at`
 *   enqueueDeepPass  → `scan/run` at tier `deep` (§6.3, §11)
 *
 * It stays an interface the caller passes in: `completeSetup` is a
 * decision about refusal order, and a function that reached for its own
 * store could not be driven through that order in a test.
 */
export interface SetupStore {
  hasActiveAccess(userId: string): Promise<boolean>;
  resolvesInDns(host: string): Promise<boolean>;
  readProgress(userId: string): Promise<SetupProgressState>;
  commitSetup(a: { siteId: string; submission: SetupSubmission }): Promise<void>;
  enqueueDeepPass(siteId: string): Promise<void>;
}

/**
 * REQ-025 c2 and c4, REQ-021 c8, REQ-028 c4.
 *
 * Refusal order is the order the facts become knowable, and it is
 * deliberate: access first (a founder without it is told that, not that
 * their domain is wrong), then completion (a second submit starts no
 * second pass), then the payload.
 *
 * On success the completion is **committed before** the pass is enqueued,
 * and an enqueue failure leaves the founder complete: a queue that dropped
 * a job must never put a founder who answered the three questions back in
 * front of them.
 */
export async function completeSetup(
  store: SetupStore,
  a: { userId: string; submission: SetupSubmission }
): Promise<SetupResult> {
  if (!(await store.hasActiveAccess(a.userId))) {
    return { ok: false, refused: "no_active_access" };
  }

  const progress = await store.readProgress(a.userId);
  if (progress.complete) return { ok: false, refused: "already_complete" };

  const refusal = shapeRefusal(a.submission);
  if (refusal !== null) return { ok: false, refused: refusal };

  const domain = registrableDomain(a.submission.domain);
  // `shapeRefusal` already refused an unparseable domain; this re-read is
  // the narrowing, not a second check.
  if (domain === null) return { ok: false, refused: "invalid_domain" };
  if (!(await store.resolvesInDns(domain))) return { ok: false, refused: "invalid_domain" };

  await store.commitSetup({
    siteId: progress.siteId,
    submission: { ...a.submission, domain },
  });

  // At-least-once, and never before the commit (REQ-028 c4: setup
  // completes and the product still produces their first page).
  try {
    await store.enqueueDeepPass(progress.siteId);
  } catch {
    // Swallowed on purpose: the founder is complete either way, and the
    // pass is idempotent on `(site_id, 'deep')`. The failure is the
    // queue's to report, not this founder's to re-answer.
  }

  return { ok: true, siteId: progress.siteId };
}

/** Everything about the payload that can be decided without I/O. */
function shapeRefusal(submission: SetupSubmission): SetupRefusal | null {
  if (registrableDomain(submission.domain) === null) return "invalid_domain";
  if (submission.category.trim() === "") return "market_missing";
  if (submission.competitors.length > BATTERY.COMPETITORS_MAX) return "too_many_competitors";
  return null;
}
