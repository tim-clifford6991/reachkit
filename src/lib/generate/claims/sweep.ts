// BUILD §8 hard rule 4 — the bounded re-check sweep.
//
// When the customer changes their do-not-claim list, every page of theirs
// short of hand-off is already held by the guard (`outstanding.ts`) — the
// hash comparison is what does that, and it happens on read. The sweep does
// not make pages safe; it makes the telling timely, by running the check so
// the customer learns which entry a held page matched rather than only that
// it is held.
//
// **Bounded, and safe to truncate.** At most `CLAIM_RECHECK_SWEEP_MAX`
// drafts per invocation; the rest are reported as `deferred`. A deferred
// draft is still held by the guard, so truncating the sweep delays a
// telling and can never release a page. That is the whole reason the bound
// is allowed to exist.
//
// A draft already handed to a destination or already live is not in the
// sweep's set at all: §8's gates reach every page short of delivery and no
// further.
import { CLAIM_RECHECK_SWEEP_MAX } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { generateStore } from "../store";
import { claimCheck } from "./check";
import { listHash } from "./hash";
import { readClaimVerdict } from "./outstanding";

export interface SweepOutcome {
  checked: number;
  failed: number;
  deferred: number;
}

/** Observability: verdict counts and the list hash's prefix. **Never** the
 *  draft text and never a list entry — the do-not-claim list is the
 *  customer's most sensitive field and it does not belong in a log. */
function logSweep(siteId: string, hash: string, outcome: SweepOutcome): void {
  console.log(
    JSON.stringify({
      event: "claim_recheck_sweep",
      siteId,
      listHashPrefix: hash.slice(0, 8),
      ...outcome,
    })
  );
}

export async function sweepOutstandingRechecks(
  c: CostContext,
  siteId: string
): Promise<SweepOutcome> {
  const store = generateStore();
  const site = await store.siteFacts(siteId);
  if (site === null) return { checked: 0, failed: 0, deferred: 0 };
  const currentHash = listHash(site.doNotClaim);

  const total = await store.countShortOfHandOff(siteId);
  const candidates = await store.draftsShortOfHandOff(siteId, CLAIM_RECHECK_SWEEP_MAX);

  let checked = 0;
  let failed = 0;
  for (const draft of candidates) {
    const verdict = readClaimVerdict(draft.claim_check);
    // Already current: re-running it would spend money to learn what the
    // hash already says.
    if (verdict !== null && verdict.state !== "unrun" && verdict.listHash === currentHash) continue;
    const outcome = await claimCheck(c, { text: draft.body_md ?? "", list: site.doNotClaim });
    await store.patchDraft(draft.id, { claim_check: serialiseVerdict(outcome) });
    // An unrun check is not a check: it leaves the draft outstanding, so
    // it is not counted as one this sweep completed.
    if (outcome.state === "unrun") continue;
    checked++;
    if (outcome.state === "failed") failed++;
  }

  const outcome: SweepOutcome = {
    checked,
    failed,
    deferred: Math.max(0, total - candidates.length),
  };
  logSweep(siteId, currentHash, outcome);
  return outcome;
}

/** `jsonb` has no `Date`. One projection, used by the sweep and by the
 *  pipeline, so a verdict written by either reads back the same way. */
export function serialiseVerdict(verdict: {
  state: string;
  at: Date;
  listHash?: string;
  matchedEntry?: string;
  reason?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = { state: verdict.state, at: verdict.at.toISOString() };
  if (verdict.listHash !== undefined) out.listHash = verdict.listHash;
  if (verdict.matchedEntry !== undefined) out.matchedEntry = verdict.matchedEntry;
  if (verdict.reason !== undefined) out.reason = verdict.reason;
  return out;
}
