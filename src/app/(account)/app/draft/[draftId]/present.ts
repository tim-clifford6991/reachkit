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
import type { Block, HtmlClasses } from "@/lib/publish/render/markdown";

export const BODY_CLASSES: HtmlClasses = Object.freeze({
  pre: "overflow-x-auto",
  code: "num",
});

/**
 * Every heading in the body, one level down.
 *
 * **A body's `#` is a heading *within* the page.** The page's own title is
 * the screen's `<h1>`, above the body, and a second `<h1>` inside it gives
 * the document two titles. The approved set draws it the same way: its
 * `.doc h2` — the body's `##` — sits at `--h3`, one rung under the screen's
 * head.
 *
 * It is done here, on the *level*, and not in the stylesheet on the size.
 * That is the whole point: `heading-scale.test.ts` renders every route and
 * requires each `h1..h4` on it to compute its own step of the ladder, so a
 * `.doc h2` restyled to `--h3` is an `h2` that is not 25px — the ladder
 * broken rather than a heading placed. Demoting the level asks for the
 * step the set draws instead of overriding one.
 *
 * `h6` stays `h6`: the scale bottoms out and nothing below it exists.
 *
 * **The copy-out is not demoted.** `renderMarkdownHtml` takes the body with
 * no map and no shift — those are the bytes that publish, where the page's
 * own `#` is its title and there is no screen heading above it.
 */
export function demoteHeadings(blocks: readonly Block[]): Block[] {
  return blocks.map((block) =>
    block.kind === "heading" && block.level < 6
      ? { ...block, level: (block.level + 1) as 2 | 3 | 4 | 5 | 6 }
      : block
  );
}
