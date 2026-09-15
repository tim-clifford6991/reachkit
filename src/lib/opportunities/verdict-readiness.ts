// SPEC §6 — a Monday "not working" recorded on the rows still open.
//
// The sibling of `fix-page.ts`'s `assessFixPages`: one read of what the
// verdicts imply (`suppressionOf`), then readiness written on each open
// Write, Improve and Earn row it changes. A Write in a suppressed cluster
// carries `cluster_suppressed`; any row targeting a retired URL carries
// `url_retired`. A row this module held back is released to `not_assessed`
// — the column's default, and what every other open row carries until
// readiness is derived for it — once its window has passed.
//
// Run after a pass has derived its rows, so a row written into a suppressed
// cluster this week carries the suppression from the moment it exists, and
// after `judgeWeek`, so this Monday's verdict holds back this week's supply.
import { opportunityStore, readOpportunity } from "./store";
import { suppressionOf, verdictReason, VERDICT_REASONS } from "./suppression";

export async function assessVerdictReadiness(
  siteId: string,
  a: { at: Date }
): Promise<{ suppressed: number; retired: number }> {
  const store = opportunityStore();
  const rows = await store.openRankable(siteId);
  if (rows.length === 0) return { suppressed: 0, retired: 0 };

  const suppression = suppressionOf(await store.notWorkingVerdicts(siteId), a.at);
  let suppressed = 0;
  let retired = 0;
  for (const row of rows) {
    const opportunity = readOpportunity(row);
    const reason = verdictReason(opportunity, suppression);
    if (reason === "cluster_suppressed") suppressed += 1;
    if (reason === "url_retired") retired += 1;

    const current = opportunity.unreadyReason;
    if (reason !== null && current !== reason) {
      await store.setReadiness(opportunity.id, reason);
    } else if (reason === null && current !== null && VERDICT_REASONS.includes(current)) {
      await store.setReadiness(opportunity.id, "not_assessed");
    }
  }
  return { suppressed, retired };
}
