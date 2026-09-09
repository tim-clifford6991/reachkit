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

/**
 * The map the **hosted page** renders a published body with (S19,
 * `src/app/(hosted)/hosted-page/[...slug]/page.tsx`). Untouched by #355:
 * that screen has its own stylesheet (`.rk-hosted-doc`) and its own
 * baselines, and the mark's class is pinned by its test.
 *
 * It stays exported from here because that is where its one other caller
 * already imports it from; moving it is that screen's issue, not this one.
 */
export const BODY_CLASSES: HtmlClasses = Object.freeze({
  h1: "mt-5 text-xl",
  h2: "mt-5 text-lg",
  h3: "mt-4 text-base",
  h4: "mt-4 text-base",
  h5: "mt-4 text-base",
  h6: "mt-4 text-base",
  p: "my-2",
  ul: "my-2 list-disc pl-6",
  ol: "my-2 list-decimal pl-6",
  li: "my-1",
  blockquote: "border-base-300 my-3 border-l-4 pl-4 italic",
  pre: "bg-base-200 rounded-box my-3 overflow-x-auto p-3",
  code: "num text-sm",
  hr: "border-base-300 my-4",
  a: "link",
  // The grounded passage, in the mint the approved set draws it in
  // (issue #414). The set's own rule is `.mark{background:var(--ok-bg);
  // box-shadow:0 0 0 1px var(--ok-line);border-radius:var(--s-1);
  // padding:1px 3px;color:var(--ink)}` on S16's body and S19's alike, so
  // the tint is the `--ok` family's own pair and the edge is its line —
  // not `--ok` at an alpha, which is a fifth mint nothing else in the
  // product spends. This was the warn family, on the reading that §2.5
  // rules red out; mint is what the drawing settles, and it says the same
  // thing better — a grounded fact is a check that passed, which is what
  // `--ok` means everywhere else on this screen (the Checks list's ticks
  // are `--ok` too).
  //
  // `--ok-bg` and `--ok-line` reach no daisyUI slot: §2.1 maps `success`
  // to `--ok` and stops, so they are read by name. That is a token
  // reference and not a literal — the value still lives once, in
  // `theme.css`, and flips with the theme there.
  //
  // **The ink is stated, and has to be.** Nothing resets `mark`, so its
  // colour is the UA's `MarkText` — near-black — which the old rule left
  // standing on a dark ground. `text-base-content` is §2.1's own slot for
  // `--ink`, which is what the set writes.
  mark: "bg-[var(--ok-bg)] text-base-content ring-1 ring-[var(--ok-line)] rounded px-1",
  strong: "font-bold",
  em: "italic",
});

/**
 * The map the **draft screen** renders with, and it is almost empty on
 * purpose.
 *
 * The typography of a document is `.rk-doc`'s (`src/ui/idiom/idiom.css`,
 * §10's document idiom, landed for S5) with this screen's `.rk-doc-levelled`
 * modifier over it. A per-element Tailwind class list here would be a
 * second type scale beside the approved ladder and a second rhythm beside
 * the approved spacing steps, written in utilities whose values (18px,
 * 14px) are rungs of neither.
 *
 * Two classes are left, and neither is typography:
 *
 *   `code` carries `.num` because §2.3 is "every numeral, date, URL, search
 *   query and **code-like string** is JetBrains Mono", and `.num` is the one
 *   mechanism that rule is applied through (`src/ui/type.css`).
 *
 *   `pre` carries `overflow-x-auto` because the layout conformance suite
 *   names `.overflow-x-auto` as a **declared** scroll container: a long code
 *   line has to scroll inside its own box rather than push the document
 *   sideways, and the declaration is the class, not the CSS property.
 */
export const DRAFT_BODY_CLASSES: HtmlClasses = Object.freeze({
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
