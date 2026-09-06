// src/lib/presentation/copy/keys/danger.ts — BP-020 decision 5, WO-041
//
// The destructive-action surfaces' sentences. Empty on purpose at WO-041:
// no string was seeded here. The block that owns each destructive-action
// surface fills this file and touches no other partition.
//
// 2026-09-05: issue #18 (BUILD §4.7) fills the danger zone Settings carries.
// The split is the same one `keys/settings.ts` states: a word or sentence
// §4.7 itself prints is transcribed verbatim; a sentence nothing in the spec
// writes stays owner-owed and empty.
//
// The two consequence lines are the owner-owed half, and deliberately so.
// §4.7 states the danger zone's standing promise — "pages are exported to
// you first, never silently destroyed" — and that line is transcribed below
// and rendered on the card at rest. What each of the two actions does to
// *this* customer, stated before it runs (REQ-078/REQ-079, issue #52), is a
// sentence no clause writes, so it is not composed here. The screen renders
// the consequence step regardless: the two-step disclosure is structural, so
// filling either key turns a written line on inside a step that already
// exists, rather than adding the step.
import type { CopyPartition } from "../registry.ts";

export const DANGER_COPY = Object.freeze({
  "danger.zone.title": ["Danger zone", { slots: {}, fixedBy: "BUILD §4.7" }],
  "danger.unpublish-all": ["unpublish all", { slots: {}, fixedBy: "BUILD §4.7" }],
  "danger.delete-account": ["delete account", { slots: {}, fixedBy: "BUILD §4.7" }],
  // §4.7 verbatim, including its lower-case opening.
  "danger.export-first": [
    "pages are exported to you first, never silently destroyed",
    { slots: {}, fixedBy: "BUILD §4.7" },
  ],
  "danger.unpublish-all.consequence": ["", { slots: {}, fixedBy: "REQ-079 c1" }],
  "danger.delete-account.consequence": ["", { slots: {}, fixedBy: "REQ-079 c1" }],
}) satisfies CopyPartition;
