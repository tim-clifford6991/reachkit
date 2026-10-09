// SPEC §7 (2026-10-07, issue 1325) — where the review screen's three regions
// stand, spelled once so the screen and its waiting state cannot differ.
//
// The page, the Decide panel, the notes — in that order in the document,
// which is the order a phone and a tablet draw them in: the decision is
// under the article and never under the notes. From `xl` the panel leaves
// the column for one of its own, beside both, and the notes stay on the
// page's side.
export const SHAPE = Object.freeze({
  grid: "grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]",
  page: "flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-1",
  decide: "min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1",
  notes: "flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-2",
});
