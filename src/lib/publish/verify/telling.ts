// BUILD §12 — "`published` (live URL + 24h checks)": the occasion and the payload; the sending is BP-016's.
// One message whichever outcome was recorded (REQ-062 c5): the outcome decides what the telling says, never whether.
// `page_not_found` and `could_not_confirm` stay two keys (ADR-085): they look alike but one retires the page from weekly
// judgement and the other leaves it judged; `tests/publish/verify/telling.test.ts` fails if they merge.
// The recorded outcome goes in place of the four checks, never beside them, so no template reads "none failed".
// No sentence is written here, and neither line may name a cause.
import type { CopyKey } from "@/lib/presentation/copy";
import { publishDb } from "../db";
import { hostedAddressNow } from "../destinations/hosted";
import type { SiteCondition, VerifyOutcome } from "../types";
import { dispositionFor } from "./due";
import { CHECK_IDS, type CheckId } from "./checks";
import { readStoredCheck } from "./stored";

/** One key per arm, never one key with the arm interpolated, which would put half a sentence here. */
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
  /** Possibly non-empty only under `found`; never a reason not to send. */
  failed: readonly CheckId[];
  /** Criterion 5: apart from the page's outcomes, where criterion 6 recorded one; `null` is never "the site is fine". */
  siteCondition: SiteCondition | null;
  copy: TellingCopyKey;
  /** Who the mail is for: BP-016 needs the account behind the site to ask the notification switch. */
  siteId: string;
}

interface TellingRow {
  id: string;
  site_id: string;
  destination: string;
  live_url: string | null;
  verify: unknown;
}

/** The checks measured `false`, in `CHECK_IDS` order. An `unmeasured` check is not a failure (criterion 6). */
function failedChecks(result: VerifyOutcome): readonly CheckId[] {
  if (result.outcome !== "found") return [];
  return CHECK_IDS.filter((id) => {
    const check = result.checks[id];
    return check.kind !== "unmeasured" && check.value === false;
  });
}

/** The telling for one publication, or `null` with no address or no check yet: no occasion, never a suppression. */
export async function tellingFor(publicationId: string): Promise<PublishedTelling | null> {
  const { data, error } = await publishDb()
    .from<TellingRow>("publications")
    .select("id, site_id, destination, live_url, verify")
    .eq("id", publicationId)
    .limit(1);
  if (error !== null) throw new Error(`tellingFor(${publicationId}): ${error.message}`);
  const row = data?.[0];
  if (row === undefined || row.live_url === null) return null;

  const recorded = readStoredCheck(row.verify);
  if (recorded === null) return null;

  return {
    publicationId: row.id,
    // SPEC §7: where the page is live now; a hosted page follows its site's current host.
    liveUrl:
      row.destination === "hosted"
        ? await hostedAddressNow({ siteId: row.site_id, liveUrl: row.live_url })
        : row.live_url,
    result: recorded.result,
    failed: failedChecks(recorded.result),
    siteCondition: recorded.siteCondition,
    copy: TELLING_COPY[recorded.result.outcome],
    siteId: row.site_id,
  };
}

/** Re-exported so the mail reads the disposition beside the telling. */
export { dispositionFor };
