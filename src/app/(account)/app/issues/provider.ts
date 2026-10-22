// Issue 1550 — the one read the Technical issues view makes.
//
// The checks waiting on the customer, from the report Overview's needs-you
// reads them from (`readWaitingIssues`), so an item there and this view hold
// the same issues. The fixture answers for the reserved fixture account and
// nothing else; the store is imported at the call, because it resolves
// `@/lib/db` and the reserved account reaches no database.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { issuesReading, type IssuesReading } from "../_overview/alerts";
import { FIXTURE_MEASURED_AT, FIXTURE_SITE_ISSUES } from "./fixture";

/** `null` where the stored report could not be read. The session is read
 *  first and outside that, so its redirect to sign-in or setup stands. */
export const readIssues = cache(async function readIssues(): Promise<IssuesReading | null> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return issuesReading(FIXTURE_SITE_ISSUES, FIXTURE_MEASURED_AT);

  try {
    const { readWaitingIssues } = await import("../_overview/store");
    return await readWaitingIssues({ siteId: account.siteId, timeZone: account.timeZone, domain: account.domain });
  } catch {
    return null;
  }
});
