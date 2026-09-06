// BUILD §12 — "`published` (live URL + 24h checks)". The occasion and the
// payload; the sending is BP-016's.
//
// **One message, on the same occasion, whichever of the three outcomes was
// recorded.** REQ-062 criterion 5: a failed check is never a reason to send
// nothing — and neither is an absent page nor an unconfirmed check. Nothing
// in this module branches on the outcome to decide whether there is a
// telling; the outcome decides only what the telling says.
//
// **Three keys, and two of them must stay two — ADR-085 (landmine).**
// `page_not_found` and `could_not_confirm` render as the same grey line and
// have opposite consequences everywhere else in the product: one retires
// the page from weekly judgement for ever, the other leaves it fully judged
// and shown as it was. A reviewer looking at two nearly identical mail
// lines will propose one key. The one-key-per-arm assertion in
// `tests/publish/verify/telling.test.ts` is what fails when they do —
// nothing else in this module would notice, because both arms carry the
// same fields except the discriminant.
//
// **The recorded outcome goes in place of the four outcomes, never
// alongside them.** Criterion 5's last sentence says so in terms. Carrying
// an empty `failed` list beside a `page_not_found` result would read to a
// template as "four checks, none failed", which is the opposite of what was
// recorded. Under those two arms `failed` is empty **because there are no
// check outcomes at all**, and the payload carries no `checks` field for a
// template to reach for — the whole `VerifyOutcome` is there, and its arm
// is the discriminant.
//
// No sentence is written here. Three copy keys are named and the owner owes
// all three: ADR-085's open questions record that the `page_not_found` line
// and the `could_not_confirm` line are two sentences, not one, and that
// neither may name a cause.
//
// The archived plan is WO-235.
import type { CopyKey } from "@/lib/presentation/copy";
import { publishDb } from "../db";
import type { SiteCondition, VerifyOutcome } from "../types";
import { dispositionFor } from "./due";
import { CHECK_IDS, type CheckId } from "./checks";
import { readStoredCheck } from "./stored";

/** One key per arm. Not a key with the arm interpolated into it: that would
 *  make a customer-visible distinction a variable substitution and put half
 *  a sentence in this module. */
export const TELLING_COPY = Object.freeze({
  found: "mail.published.verified",
  page_not_found: "mail.published.not_found",
  could_not_confirm: "mail.published.not_confirmed",
} as const satisfies Record<VerifyOutcome["outcome"], CopyKey>);

export type TellingCopyKey = (typeof TELLING_COPY)[keyof typeof TELLING_COPY];

export interface PublishedTelling {
  publicationId: string;
  liveUrl: string;
  result: VerifyOutcome;
  /** Non-empty only under `found`; possibly empty then. Never a reason not
   *  to send. Under the other two arms it is empty **because there are no
   *  check outcomes at all**. */
  failed: readonly CheckId[];
  /** Criterion 5: named separately from the page's own outcomes, and only
   *  where criterion 6 recorded one. `null` otherwise — and never rendered
   *  as "the site is fine". */
  siteCondition: SiteCondition | null;
  copy: TellingCopyKey;
  /** Who the mail is for. Carried on the telling because the payload is
   *  what the sender is handed, and BP-016 needs the account behind the
   *  site to consult the customer's own notification switch. */
  siteId: string;
}

interface TellingRow {
  id: string;
  site_id: string;
  live_url: string | null;
  verify: unknown;
}

/**
 * The checks whose outcome is a measured `false`.
 *
 * An `unmeasured` check is **not** a failure — it was not observed, and
 * naming it as one is exactly the wrong-thing-blamed criterion 6 exists to
 * stop. The order is `CHECK_IDS`', so the mail lists the four in one order
 * and never in whatever order an object literal happened to be written in.
 */
function failedChecks(result: VerifyOutcome): readonly CheckId[] {
  if (result.outcome !== "found") return [];
  return CHECK_IDS.filter((id) => {
    const check = result.checks[id];
    return check.kind !== "unmeasured" && check.value === false;
  });
}

/**
 * The telling for one publication, or `null` where there is nothing to
 * tell: no address, or no check recorded yet.
 *
 * `null` is not a suppression. It is the absence of the occasion — the
 * outcome never enters the decision to send, and the three arms of a
 * recorded outcome all produce a telling.
 */
export async function tellingFor(publicationId: string): Promise<PublishedTelling | null> {
  const { data, error } = await publishDb()
    .from<TellingRow>("publications")
    .select("id, site_id, live_url, verify")
    .eq("id", publicationId)
    .limit(1);
  if (error !== null) throw new Error(`tellingFor(${publicationId}): ${error.message}`);
  const row = data?.[0];
  if (row === undefined || row.live_url === null) return null;

  const recorded = readStoredCheck(row.verify);
  if (recorded === null) return null;

  return {
    publicationId: row.id,
    liveUrl: row.live_url,
    result: recorded.result,
    failed: failedChecks(recorded.result),
    siteCondition: recorded.siteCondition,
    copy: TELLING_COPY[recorded.result.outcome],
    siteId: row.site_id,
  };
}

/** Re-exported so a caller composing the mail reads the disposition through
 *  the same module it reads the telling from. */
export { dispositionFor };
