// BUILD §2.2 — the approved card idiom's barrel (issue #266).
// src/ui/idiom/index.ts
//
// The owner endorsed the card idiom on 2026-09-02 ("A · Six boxes"). These
// are its parts, ported from the live preview code under
// `archive/…/design/previews/app/src/app/idiom/`.
//
// **Deliberately not `src/ui/components/`'s barrel.** That barrel is
// BUILD §2.2's closed set of fifteen daisyUI components, and
// `tests/ui/design/component-registry.test.ts` asserts it exports exactly
// those fifteen and no more. Nothing here is a daisyUI component: `CardHead`
// and `IdiomCard` are the registered `Card`'s widened arms and
// `ActionPanel` is the idiom's one new row. `Progress`'s own widening is a
// prop on the registered component itself (`onAccent`) rather than a second
// component here — it needed no new markup, only a second ground. Putting them
// here keeps §2.2's list closed and still gives them one home.
export {
  ActionPanel,
  type ActionPanelProps,
  type ActionPanelRank,
  type ActionPanelTone,
} from "./ActionPanel";
export { CardHead } from "./CardHead";
export { OptionCard } from "./OptionCard";
export { RemovableTag } from "./RemovableTag";
export { IdiomCard } from "./IdiomCard";
