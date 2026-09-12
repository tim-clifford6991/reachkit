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
// **`hasActiveAccess` is the billing leaf's, since #133.** It is ADR-050's
// rule — `users.paid_through > now()` alone — and `src/lib/account/billing`
// owns it; the port below now defaults to that read instead of refusing,
// because this store is what `POST /api/setup` actually runs and a port
// that answers `false` would be a paywall nobody can get past. The port
// itself stays: it is the seam the suites drive.
//
// **The provider hands this store out, since #133.** Which account a
// request belongs to is `currentSession()`'s (issue #35), which landed, so
// `POST /api/setup` resolves the founder from the session and this store
// reads and writes that founder's own rows. The two are one switch —
// `provider.ts` says why.
import { sendJobEvent } from "@/jobs/client";
import { hasActiveAccess } from "@/lib/account/billing";
import { dbAdmin } from "@/lib/db";
import { resolvesInDns } from "@/lib/egress/dns";
import { applySetupChoice } from "@/lib/publish/setup/apply";
import type { SetupProgressState, SetupStore, SetupSubmission } from "../submit";

/** ADR-050's rule, as a port. The default is now the billing leaf's own
 *  `hasActiveAccess()` — the one export `CLAUDE.md` lets anything outside
 *  `src/lib/account/billing` import, and THE access gate ADR-050 rules is
 *  `users.paid_through > now()` alone. It fails closed for the same reason
 *  the port did: "we cannot tell whether this customer has paid" and "they
 *  have" are not the same answer, and only one of them is safe to guess.
 *
 *  The port stays a port because it is the seam the suites drive: a real
 *  read here needs a `users` row and a `sites` row, and what
 *  `completeSetup`'s refusal order is about is the order the facts become
 *  knowable, not where they come from. */
export type ActiveAccessReader = (userId: string) => Promise<boolean>;

/** `hasActiveAccess` is keyed by site and this store is keyed by account,
 *  so the site is resolved first — the same one read `readProgress` makes,
 *  and the same row `commitSetup` writes. A user with no site row has not
 *  been provisioned and therefore has no access to be active: that is a
 *  refusal, not a throw, because `completeSetup` asks this before it asks
 *  anything else and "no account" is exactly what it wants to hear. */
const billingAccess: ActiveAccessReader = async (userId) => {
  let site: SiteSetupRow;
  try {
    site = await siteFor(userId);
  } catch {
    return false;
  }
  return hasActiveAccess(site.id);
};

let activeAccess: ActiveAccessReader = billingAccess;

export function setActiveAccessReader(next: ActiveAccessReader): void {
  activeAccess = next;
}

export function resetActiveAccessReader(): void {
  activeAccess = billingAccess;
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

/**
 * The site's own address, for the screen that draws it.
 *
 * `readProgress` answers the completion predicate and a site id; §4.3's
 * market card needs the *domain*, to look up the report the account will
 * use (REQ-021 c6). Both come off the same one row, so this exposes it
 * rather than making the provider read `sites` a second time with its own
 * spelling of the query (issue #169).
 *
 * `null` where provisioning has not run — the screen then opens with an
 * empty address field, which is REQ-021 c7's arm, rather than throwing a
 * founder off their own setup page.
 */
export async function siteAddressFor(
  userId: string
): Promise<{ siteId: string; domain: string } | null> {
  try {
    const site = await siteFor(userId);
    return { siteId: site.id, domain: site.domain };
  } catch {
    return null;
  }
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

      // SPEC.md §5 (2026-09-12): the voice the founder confirmed or
      // edited. Written through the profile leaf's own writer, which is
      // what stamps `sites.voice_edited_at` — and it is called only where
      // the text actually differs from what the scan read. Submitting the
      // summary unchanged is a confirmation, not an edit: stamping it
      // would freeze the voice against every weekly refresh, and §5's
      // rule is the narrower one — a customer's *edit* survives a
      // refresh. A failure here never un-completes a setup the founder
      // has finished answering.
      try {
        const { readSiteProfile, saveVoiceText } = await import("@/lib/site-profile");
        const profile = await readSiteProfile(a.submission.domain);
        const asRead = profile?.voice?.text ?? "";
        if (a.submission.voiceText !== asRead) {
          await saveVoiceText({ siteId: a.siteId, text: a.submission.voiceText });
        }
      } catch {
        // Swallowed for `enqueueDeepPass`'s reason: the three decisions
        // are committed, and a voice that did not store is the next
        // refresh's or Settings' to fix, never this founder's to answer
        // again.
      }

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
