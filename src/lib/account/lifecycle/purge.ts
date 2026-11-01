// BUILD §10, §11, §14 — the 30-day purge: the only deleter in this schema.
//
// REQ-079 criterion 7: "when 30 days have passed, then the account and the
// sign-in address it was reached at, the site, its pages, drafts,
// measurements, destination credentials and every copy ReachKit holds of the
// customer's own page content — including the passages copied from their
// live pages and kept as a draft's grounding evidence … whose retention ends
// here — are no longer present in ReachKit's stored data at all."
//
// **ADR-051 point 6: the purge is the only deleter.** Nothing else in this
// product issues a `DELETE` against a customer's rows, and no foreign key
// in this schema carries a cascade that could do it by accident — which is
// what makes this file's order the whole of the deletion sequence rather
// than one arm of it.
//
// **Idempotent and resumable, by order rather than by transaction.** The
// steps run children-first, so a run interrupted part-way leaves a
// consistent prefix done and the next run completes it: every step deletes
// whatever is still there and a step with nothing to delete is a no-op. A
// second run on a purged account removes nothing and reports the same
// success. That is what "resumable" costs here, and it is why no step
// depends on a previous one having run.
//
// **A row that cannot be deleted is an alert, not a warning.** It means data
// promised gone at thirty days is still present, which is the one failure in
// this file that a customer was given a date for.
//
// The schedule is not here. `src/jobs/account-maintenance.ts` ticks, and
// this module takes an explicit `now`, so no test needs a scheduler and no
// cadence is stated twice.
import { AUTH_USERS_TABLE, lifecycleStore } from "./store";

/** Children first. Each row is one table, the column that reaches it, and
 *  which set of ids fills that column — so the order is a value a reader can
 *  check against the foreign keys rather than a sequence of calls to follow.
 *
 *  `email_suppressions` is deliberately absent. An address-wide suppression
 *  is a person saying "do not mail me", not a fact about an account
 *  (ADR-042: the two mechanisms never merge), and criterion 7's enumeration
 *  does not name it. Purging it would turn a departure into permission to
 *  mail them again. */
const PURGE_ORDER: readonly {
  readonly table: string;
  readonly column: string;
  readonly from: "publicationIds" | "draftIds" | "scanIds" | "siteIds" | "userIds";
}[] = Object.freeze([
  // The danger-zone ticket and its record of the action that ended the
  // account.
  { table: "danger_tickets", column: "site_id", from: "siteIds" },
  // The customer's corrections to what we read off their site (#926) —
  // what they removed, added, reworded and switched off. It carries no
  // cascade (ADR-051 point 7), so this row is what removes it, and it must
  // stand before `sites` for the same reason every row here does.
  //
  // `site_profiles` itself is deliberately **not** here: it is keyed by
  // domain, not by site, and is shared with every free scan of the same
  // domain, so purging it would delete a reading that is nobody's account
  // (its own migration says why it is keyed that way).
  { table: "site_profile_edits", column: "site_id", from: "siteIds" },
  // The answer engines' own record of this site (#1004): the mentions
  // first, then the weeks that hold them — `llm_mentions` references
  // `(site_id, week_start)` on `llm_mention_reads`, and neither foreign key
  // carries a cascade (ADR-051 point 7), so both are deleted here and in
  // this order or neither can be.
  { table: "llm_mentions", column: "site_id", from: "siteIds" },
  { table: "llm_mention_reads", column: "site_id", from: "siteIds" },
  // The weekly verdict on each published page.
  { table: "page_verdicts", column: "publication_id", from: "publicationIds" },
  // How often an answer engine read each hosted page, and how many visitors
  // an AI answer sent (#921). Counts, never a reader — but they are this
  // customer's counts about this customer's pages, and the retention the
  // writer enforces is a ceiling on age, not a replacement for a purge.
  { table: "publication_reads", column: "publication_id", from: "publicationIds" },
  // The page records: what went live, where, and when it came down.
  { table: "publications", column: "site_id", from: "siteIds" },
  // The ledger-cache-raw-store in one: every byte fetched for a measurement
  // of this customer's pages. Before the pages, because a draft's calls name
  // its row (issue 1478); every one of them is keyed to one of this site's
  // scans.
  // What the re-score read off those rows (`fetch_facts`): keyed to its
  // read with no cascade, so it goes first, by the scan its read is under.
  { table: "fetch_facts", column: "scan_id", from: "scanIds" },
  { table: "fetches", column: "scan_id", from: "scanIds" },
  // The pages themselves — body and `grounded_fact` alike. REQ-050 c1 keeps
  // a grounding passage "unchanged from then on"; its retention ends here,
  // and it ends because the row goes, not because a column is blanked.
  { table: "drafts", column: "site_id", from: "siteIds" },
  { table: "opportunities", column: "site_id", from: "siteIds" },
  // A lead captured against one of this site's own scans.
  { table: "leads", column: "scan_id", from: "scanIds" },
  { table: "scans", column: "site_id", from: "siteIds" },
  // How each draft day ended and why, and when the owner was told a day had
  // no page (issue 1455). No cascade (ADR-051 point 7), so it goes here,
  // before `sites`.
  { table: "draft_days", column: "site_id", from: "siteIds" },
  // Destination credentials.
  { table: "destinations", column: "site_id", from: "siteIds" },
  { table: "sites", column: "user_id", from: "userIds" },
  // The live sign-in link, sealed; it refers to `users` with no cascade.
  { table: "signin_links", column: "user_id", from: "userIds" },
  // The sign-in address it was reached at: the account, then the Supabase
  // Auth user whose id it is (#468) — last, because `users.id` refers to
  // it and carries no cascade.
  { table: "users", column: "id", from: "userIds" },
  { table: AUTH_USERS_TABLE, column: "id", from: "userIds" },
]);

export class PurgeIncomplete extends Error {
  readonly table: string;
  constructor(table: string, message: string) {
    super(`src/lib/account/lifecycle: the purge could not clear ${table}: ${message}`);
    this.name = "PurgeIncomplete";
    this.table = table;
  }
}

/** Every tombstoned account whose promised date has arrived. One indexed
 *  scan on `purge_due_at`; an account with `deleted_at` and no
 *  `purge_due_at` is never returned, and is reported, because a tombstone
 *  with no promised date is a fault rather than a state. */
export async function accountsDueForPurge(now: Date): Promise<readonly string[]> {
  const read = await lifecycleStore().accountsDueForPurge(now);
  if (!read.ok) {
    throw new PurgeIncomplete("users", "the due-work query could not be read");
  }
  return read.userIds;
}

export async function purgeAccount(userId: string): Promise<{ purged: true }> {
  const store = lifecycleStore();

  const scope = await store.purgeScope(userId);
  if (!scope.ok) throw new PurgeIncomplete("sites", "the account's rows could not be read");

  const ids: Record<(typeof PURGE_ORDER)[number]["from"], readonly string[]> = {
    publicationIds: scope.scope.publicationIds,
    draftIds: scope.scope.draftIds,
    scanIds: scope.scope.scanIds,
    siteIds: scope.scope.siteIds,
    userIds: [userId],
  };

  for (const step of PURGE_ORDER) {
    const done = await store.purgeStep({
      table: step.table,
      column: step.column,
      values: ids[step.from],
    });
    if (!done.ok) {
      console.error(
        JSON.stringify({
          event: "purge_incomplete",
          table: step.table,
          because: done.message,
          promise: "REQ-079 c7 — no longer present in ReachKit's stored data at all",
        })
      );
      throw new PurgeIncomplete(step.table, done.message);
    }
  }

  console.log(JSON.stringify({ event: "account_purged", tables: PURGE_ORDER.length }));
  return { purged: true };
}

export { PURGE_ORDER };
