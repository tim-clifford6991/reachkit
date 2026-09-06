// BUILD §9, §4.7 — what counts as a page ReachKit wrote, and which of
// REQ-078's four states it is in.
//
// **A page is a draft ReachKit has written a body for.** REQ-078 criterion
// 1 counts "how many pages ReachKit has written for them"; a row in
// `planned` or `generating` is an intention, not a page, and counting it
// would tell the customer they have content that no export can contain. The
// test is the body and nothing else — a state list would have to be revised
// every time §9's machine grows an edge.
//
// **The four states are a total map over §9's ten.** REQ-078 names four —
// "published, in review, vetoed and failed alike" — and the machine has ten,
// so the mapping is written once, here, and closed by `const _never: never`.
// An eleventh state added to §9 stops this file compiling rather than
// quietly landing every one of that state's pages in `in_review`.
//
// `unpublished` maps to `published`, not to a fifth state: criterion 4 says
// a page that is no longer published carries the date it was taken down —
// which makes it a published page with one more date, not a different kind
// of page.
import type { State } from "@/lib/publish/types";

/** REQ-078's four, as the manifest states them. */
export type PageState = "published" | "in_review" | "vetoed" | "failed";

export function isWritten(bodyMd: string | null): boolean {
  return bodyMd !== null && bodyMd.length > 0;
}

export function pageStateOf(state: State): PageState {
  switch (state) {
    case "published":
    case "unpublished":
      return "published";
    case "planned":
    case "generating":
    case "in_review":
    case "approved":
    case "publishing":
      return "in_review";
    case "skipped":
      return "vetoed";
    case "failed":
    case "needs_attention":
      return "failed";
    default: {
      const _never: never = state;
      return _never;
    }
  }
}
