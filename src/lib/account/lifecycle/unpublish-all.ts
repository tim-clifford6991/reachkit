// BUILD §4.7, §9 — unpublish everything, and publishing stays off.
//
// REQ-079 criterion 4: three observable moments — a page live at a
// destination ReachKit serves is no longer served; a post in the customer's
// own WordPress stands as §9's unpublish left it; and the pages at any
// destination that could not be reached "are listed as still live with one
// written line saying so".
//
// **This loop branches on nothing.** For each live publication it calls
// #131's `unpublish()`, which calls the destination's own adapter, and it
// routes the arm that came back. It reads neither `made_live_by_us` nor
// `live_url` to decide anything: which family of arms applies is the
// adapter's question, asked in exactly one place, and that place is not
// here. Re-deriving it would agree with the adapter today and diverge the
// first time either changes.
//
// **How the five `ok` arms are counted, and why.** `removed`,
// `returned_to_draft`, `named_for_removal` and `already_gone` each count
// once toward `takenDown`: for each of them the product has stopped
// treating the page as one of the customer's live pages and there is
// nothing left at that destination for ReachKit to do. `unreachable` does
// **not**, even though it is `ok: true` — criterion 4 says in terms that
// "the pages at any destination that could not be reached are listed as
// still live", so it goes into `stillLive` and into no other counter. That
// is the one arm where the union's `ok` flag and this module's counting
// deliberately disagree, because the page did reach `unpublished` while the
// write into a site we do not own did not happen. `{ ok: false }` — an
// unpublish that did not complete at all — goes into `stillLive` too: the
// page is still live at its destination, and the only other counter is
// `takenDown`, so the alternative is that a live page is reported in
// neither and vanishes from the one sentence criterion 4 promises about it.
//
// **The switch goes off after the loop, never before.** A failure mid-loop
// then leaves the switch untouched and the retry converges; unpublishing is
// idempotent per publication (§9), so a second run takes nothing down
// twice. And this module contains no write of `true` to
// `publishing_enabled` — only the customer's own Settings toggle turns
// publishing back on (REQ-079 c5), and
// `tests/account/lifecycle/publishing-stays-off.test.ts` is what holds that
// true across this directory, `src/lib/publish/**` and `src/jobs/**`.
import { unpublish } from "@/lib/publish/attempt/unpublish";
import { setPublishing } from "@/lib/publish/switch";
import type { UnpublishOutcome, UnpublishResult } from "@/lib/publish/types";
import { lifecycleStore, type LivePublicationRow } from "./store";

export interface StillLiveDestination {
  readonly destinationId: string;
  readonly kind: string;
  readonly liveUrls: readonly string[];
}

export interface UnpublishAllResult {
  readonly takenDown: number;
  readonly stillLive: readonly StillLiveDestination[];
  /** c5 — and it stays off until the customer switches it on themselves. */
  readonly publishingSwitchedOff: true;
  readonly lineKey: "danger.some-still-live" | "danger.all-taken-down";
  /** Every `ok` arm the run produced, in order, so the deletion mail's four
   *  WordPress sentences are read from this run's own outcomes and no
   *  population is re-derived anywhere else. */
  readonly outcomes: readonly { readonly destination: string; readonly outcome: UnpublishOutcome }[];
}

export type UnpublishAll =
  | { ok: true; result: UnpublishAllResult }
  | { ok: false; reason: "store" };

/** Which counter one arm lands in. Total over `UnpublishResult` and closed
 *  by `const _never: never`: deleting an arm from the union, or dropping
 *  its case here, is a type error rather than a green suite. */
function countsAsTakenDown(result: UnpublishResult): boolean {
  if (!result.ok) return false;
  const outcome: UnpublishOutcome = result.outcome;
  switch (outcome) {
    case "removed":
    case "returned_to_draft":
    case "named_for_removal":
    case "already_gone":
      return true;
    case "unreachable":
      return false;
    default: {
      const _never: never = outcome;
      return _never;
    }
  }
}

function groupStillLive(
  rows: readonly LivePublicationRow[],
  destinationIds: ReadonlyMap<string, string>
): StillLiveDestination[] {
  const byKind = new Map<string, string[]>();
  for (const row of rows) {
    const urls = byKind.get(row.destination);
    const url = row.live_url;
    if (urls === undefined) byKind.set(row.destination, url === null ? [] : [url]);
    else if (url !== null) urls.push(url);
  }
  return [...byKind.entries()].map(([kind, liveUrls]) => ({
    // A destination row that has already gone leaves the kind as the only
    // name there is. It is never invented and never blank.
    destinationId: destinationIds.get(kind) ?? kind,
    kind,
    liveUrls,
  }));
}

export async function unpublishEverything(a: {
  siteId: string;
  userId: string;
  now?: Date;
}): Promise<UnpublishAll> {
  const store = lifecycleStore();
  const live = await store.livePublications(a.siteId);
  if (!live.ok) return { ok: false, reason: "store" };

  const destinations = await store.destinations(a.siteId);
  const destinationIds = new Map(
    (destinations.ok ? destinations.destinations : []).map((row) => [row.kind, row.id])
  );

  const by = { kind: "customer", userId: a.userId } as const;
  let takenDown = 0;
  const stillLiveRows: LivePublicationRow[] = [];
  const outcomes: { destination: string; outcome: UnpublishOutcome }[] = [];

  for (const row of live.publications) {
    const result = await unpublish({
      draftId: row.draft_id,
      by,
      ...(a.now === undefined ? {} : { at: a.now }),
    });
    if (result.ok) outcomes.push({ destination: row.destination, outcome: result.outcome });
    if (countsAsTakenDown(result)) takenDown += 1;
    else stillLiveRows.push(row);
  }

  // After the loop, so a failure part-way leaves the switch where it was and
  // the retry converges.
  await setPublishing(a.siteId, false, by);

  const stillLive = groupStillLive(stillLiveRows, destinationIds);
  return {
    ok: true,
    result: {
      takenDown,
      stillLive,
      publishingSwitchedOff: true,
      lineKey: stillLive.length === 0 ? "danger.all-taken-down" : "danger.some-still-live",
      outcomes,
    },
  };
}
