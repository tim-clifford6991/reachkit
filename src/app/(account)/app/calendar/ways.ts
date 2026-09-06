// BUILD §4.6 — REQ-043 criterion 12's ways through a published page, and
// the first of them: the page at its public address, as any visitor sees
// it.
//
// **Decided from what ReachKit already recorded, and never from a look.**
// This module is pure and synchronous. It makes no request — not this call,
// not any call — and imports nothing from `src/lib/egress/**`. REQ-043's
// non-goal says it in the requirement's own words: "Opening the day detail
// fetches neither address, now or ever." A source assertion in
// `tests/app/calendar/ways.test.ts` holds it, so a `HEAD` request added
// "just to check the link" fails a test rather than a review.
//
// **The offered arm is deliberately wide, and that is the load-bearing
// part.** Only two of the record's facts refuse a way: ReachKit unpublished
// the page itself, and the one check found no page at the public address.
// **`could_not_confirm` is not a refusal ground and there is no fourth.**
// That outcome's whole content is *ReachKit does not know*; refusing on it
// takes a page the record says nothing against and tells the customer the
// way leads nowhere — and it renders as exactly the same grey line as the
// correct behaviour, which is why the pair of fixtures in the test differ
// only in the stored outcome. `not_yet`, `due` and both `never`
// dispositions likewise leave the way offered: none of them is an
// observation against the page.
//
// What the offered arm claims is **where the page was put**, never that it
// is there now. ReachKit's one look was the check at 24 hours and nothing
// ever goes back (REQ-062's non-goal).
//
// The archived plans are WO-258 (this file) and WO-259 (the second way,
// inside the customer's own WordPress, which is issue #54's).
import type { CopyKey } from "@/lib/presentation/copy";
import type { PageRecord } from "@/lib/publish/record";

/** Criterion 12's ways through, each offered or refused from what ReachKit
 *  already recorded. Three grounds and no fourth: a `switch` over
 *  `RefusalGround` that misses one does not compile. */
export type RefusalGround = "unpublished_by_us" | "page_not_found" | "no_admin_address";

export type WayThrough =
  | { offered: true; href: string }
  /** The record already says this way leads nowhere: ReachKit unpublished
   *  the page itself, its one check found no page at the public address, or
   *  no address inside that WordPress can be formed for that post. The
   *  detail says so **in place of** the way, never offering it. */
  | { offered: false; because: RefusalGround; copy: CopyKey };

/** The one mapping from a ground to the key its line is written under, so a
 *  refusal cannot be rendered without one and no component picks a key of
 *  its own. Total over the three grounds; the sentences are the owner's. */
export const REFUSAL_COPY = Object.freeze({
  unpublished_by_us: "waythrough.unpublished-by-us",
  page_not_found: "waythrough.page-not-found",
  no_admin_address: "waythrough.no-admin-address",
} as const satisfies Record<RefusalGround, CopyKey>);

function refuse(because: RefusalGround): WayThrough {
  return { offered: false, because, copy: REFUSAL_COPY[because] };
}

/**
 * Criterion 12's first way: the page as a visitor sees it, at its public
 * address.
 *
 * The precedence is the criterion's own order — ReachKit's own act first,
 * then what the one check recorded, then offered — so a page that is both
 * unpublished and recorded as not found is refused on ReachKit's own act,
 * which is the thing the customer can actually account for.
 *
 * `verification` is **destructured**, never tested with a boolean. A
 * `verifyFailed !== null` style test cannot tell "the page failed a check"
 * from "the check did not settle", and those two go opposite ways here.
 */
export function wayAsVisitor(record: PageRecord): WayThrough | null {
  if (record.state === "unpublished") return refuse("unpublished_by_us");

  const { verification } = record;
  if (verification.kind === "done" && verification.result.outcome === "page_not_found") {
    return refuse("page_not_found");
  }

  if (!record.address.offered) {
    // A page ReachKit never made live at its destination has no public
    // address, and criterion 12 names no ground for it — its three are
    // "unpublished by us", "no page found" and "no admin address", and
    // none of them is "ReachKit never made this page live". So there is no
    // way here to offer **and none to refuse**: the record's own address
    // arm already says, in place of an address, that there is none
    // (`record.address.neverMadeLive`), and a refusal beside it would say
    // the same thing twice under a ground that is not this page's.
    //
    // `null` is an absent way, not a refused one — the same distinction
    // issue #54's second way draws for a page at a destination ReachKit
    // serves. Narrowed here rather than defaulted around: the arm carries
    // no `url` field at all, so a component could not be handed an address
    // even if this branch were deleted.
    return null;
  }

  return { offered: true, href: record.address.url };
}
