// BUILD §4.6, UI-SPEC S16 — how the body's own markup is dressed, and
// nothing else.
//
// §2.2: "Custom CSS is allowed only for: the calendar grid, the day panel,
// the AI dot-matrix, chart SVGs, and the sidebar — nothing else." A draft
// body is none of those, so this screen ships no stylesheet: the map below
// is handed to the one Markdown renderer (`markdown.ts`'s `toHtml`) and the
// **typography** the approved set draws for a page body lives with the
// idiom, on `.rk-doc` (`src/ui/idiom/idiom.css` §13), which `RenderedBody`
// puts on the container. The copy-out passes no map and gets the same
// elements unclassed — the bytes that publish.
//
// **The map shrank when the set landed** (issue #355). It used to carry a
// Tailwind size and margin for every element — `text-xl`, `text-lg`,
// `my-2`, `border-l-4` — which is a second type scale beside the approved
// ladder and a second rhythm beside the approved spacing steps, written in
// utilities whose values (18px, 14px) are not rungs of either. The element
// selectors under `.rk-doc` state the same things in tokens. What is left
// here is the two classes that are not typography:
//
//   `code` carries `.num` because §2.3 is "every numeral, date, URL, search
//   query and **code-like string** is JetBrains Mono", and `.num` is the one
//   mechanism that rule is applied through (`src/ui/type.css`).
//
//   `pre` carries `overflow-x-auto` because the layout conformance suite
//   names `.overflow-x-auto` as a **declared** scroll container: a long code
//   line has to scroll inside its own box rather than push the document
//   sideways, and the declaration is the class, not the CSS property.
import type { HtmlClasses } from "@/lib/publish/render/markdown";

export const BODY_CLASSES: HtmlClasses = Object.freeze({
  pre: "overflow-x-auto",
  code: "num",
});
