// BUILD §2.2 — the approved card idiom's barrel (issue #266).
// src/ui/idiom/index.ts
//
// The owner endorsed the card idiom on 2026-09-02 ("A · Six boxes"). These
// are its parts, ported from the live preview code under
// `archive/…/design/previews/app/src/app/idiom/`.
//
// Nothing here is a daisyUI component, and nothing here wraps one: the
// daisyUI component wrappers were deleted in issue 732 (DESIGN.md rule 1),
// and a screen writes daisyUI's classes in the route.
export {
  ActionPanel,
  type ActionPanelProps,
  type ActionPanelRank,
  type ActionPanelTone,
} from "./ActionPanel";
export { CardHead } from "./CardHead";
export { IdiomCard } from "./IdiomCard";
export { ProblemCard, type ProblemCardEdge } from "./ProblemCard";
export { QuestionList, type QuestionItem } from "./QuestionList";
