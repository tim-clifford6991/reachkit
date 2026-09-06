// BUILD §4.3 — the writes and reads completing setup actually makes.
//
// `submit.ts` declares `SetupStore` and issue #14 supplied one honest
// fixture behind it, which recorded what it was asked to do and claimed no
// row was written. This is the implementation that does write them:
//
//   readProgress     `sites.setup_completed_at` — the one predicate every
//                    account route consults, with no second copy
//   commitSetup      the three answers, then `applySetupChoice()`'s
//                    mode-and-destination transaction, then the stamp
//   enqueueDeepPass  `scan/run` at tier `deep`, on the queue
//   resolvesInDns    §6.4's resolver, through the egress seam
//
// **One member is still a seam, and it is named rather than faked.**
// `hasActiveAccess` is ADR-050's rule — `users.paid_through > now()` alone
// — and neither the column nor the `src/lib/account/billing` leaf that
// owns it exists yet (issue #42). A store that answered `true` here would
// be a paywall that lets everyone through, so this one asks the port
// below, which refuses until #42 fills it. Nothing else in this file, in
// `submit.ts` or in `POST /api/setup` changes when it does.
//
// **Why the provider still hands out the fixture.** Which account a
// request belongs to is `currentSession()`'s (issue #35) and no session
// carries an identity yet, so a live store would be reading rows for an
// account this process cannot name. The switch is one line in
// `provider.ts` and it is written there.
import { sendJobEvent } from "@/jobs/client";
import { dbAdmin } from "@/lib/db";
import { resolvesInDns } from "@/lib/egress/dns";
import { applySetupChoice } from "@/lib/publish/setup/apply";
import type { SetupProgressState, SetupStore, SetupSubmission } from "../submit";

/** ADR-050's rule, as a port. Answers `false` until issue #42 supplies
 *  `hasActiveAccess()` — a refusal, because "we cannot tell whether this
 *  customer has paid" and "they have" are not the same answer, and only
 *  one of them is safe to guess. */
export type ActiveAccessReader = (userId: string) => Promise<boolean>;

const billingIsIssue42: ActiveAccessReader = async () => false;

let activeAccess: ActiveAccessReader = billingIsIssue42;

export function setActiveAccessReader(next: ActiveAccessReader): void {
  activeAccess = next;
}

export function resetActiveAccessReader(): void {
  activeAccess = billingIsIssue42;
}

/** The generated `Database` type carries none of the `sites.setup_*`
 *  columns this issue's own migration adds — the same narrow cast
 *  `src/lib/scan/deep/release.ts` documents. */
interface SiteSetupRow {
  id: string;
  domain: string;
  created_at: string;
  setup_completed_at: string | null;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

async function siteFor(userId: string): Promise<SiteSetupRow> {
  const { data, error } = await untyped()
    .from<SiteSetupRow>("sites")
    .select("id, domain, created_at, setup_completed_at")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw new Error(`setup store: could not read the site for ${userId}: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) {
    // Provisioning creates the site row from the payment (§13), so a
    // founder who reached `/setup` has one. Throwing rather than
    // inventing: a store that created a site here would be a second
    // provisioning path, and the first one is the one with the payment
    // behind it.
    throw new Error(`setup store: no site for ${userId} — provisioning has not run`);
  }
  return row;
}

export function liveSetupStore(): SetupStore {
  return {
    hasActiveAccess: (userId) => activeAccess(userId),

    resolvesInDns: (host) => resolvesInDns(host),

    async readProgress(userId): Promise<SetupProgressState> {
      const site = await siteFor(userId);
      return site.setup_completed_at === null
        ? { complete: false, siteId: site.id, paidAt: new Date(site.created_at) }
        : {
            complete: true,
            siteId: site.id,
            completedAt: new Date(site.setup_completed_at),
          };
    },

    /**
     * The three answers, the mode-and-destination transaction, and the
     * stamp — in that order, and the stamp last on purpose.
     *
     * `setup_completed_at` is what the gate, the reminders and the release
     * deadline all read, so it is written only once everything it stands
     * for is on disk. A crash before it leaves a founder who is still
     * asked the three questions, with the answers they already gave
     * pre-filled — which is the recoverable half of the two.
     */
    async commitSetup(a: { siteId: string; submission: SetupSubmission }): Promise<void> {
      const answers = await untyped()
        .from<SiteSetupRow>("sites")
        .update({
          domain: a.submission.domain,
          category: a.submission.category,
          competitors: [...a.submission.competitors],
        })
        .eq("id", a.siteId);
      if (answers.error) throw new Error(`commitSetup: ${answers.error.message}`);

      await applySetupChoice({
        siteId: a.siteId,
        mode: a.submission.mode,
        destinationKind: a.submission.destination.kind,
      });

      const stamped = await untyped()
        .from<SiteSetupRow>("sites")
        .update({ setup_completed_at: new Date().toISOString() })
        .eq("id", a.siteId);
      if (stamped.error) throw new Error(`commitSetup: ${stamped.error.message}`);
    },

    /**
     * Queues the onboarding pass. One event, the same `scan/run` every
     * other tier goes through, with `tier: 'deep'` as its parameter —
     * §4.3 has no pipeline of its own to start.
     *
     * `scanId` is the delivery's idempotency key and is minted here so
     * that a second delivery of this founder's submit starts no second
     * pass. The pipeline mints the scan row's own id; these two are the
     * same kind of thing and never the same value, which is why the key
     * is a fresh one rather than a guess at the row's.
     */
    async enqueueDeepPass(siteId: string): Promise<void> {
      const site = await untyped()
        .from<SiteSetupRow>("sites")
        .select("id, domain, created_at, setup_completed_at")
        .eq("id", siteId)
        .limit(1);
      if (site.error) throw new Error(`enqueueDeepPass: ${site.error.message}`);
      const row = site.data?.[0];
      if (row === undefined) throw new Error(`enqueueDeepPass: no site ${siteId}`);

      await sendJobEvent("scan/run", {
        scanId: `setup-${siteId}`,
        domain: row.domain,
        tier: "deep",
        siteId,
      });
    },
  };
}
