// BUILD §4.6 — how the body's own markup is dressed, and nothing else.
//
// §2.2: "Custom CSS is allowed only for: the calendar grid, the day panel,
// the AI dot-matrix, chart SVGs, and the sidebar — nothing else." A draft
// body is none of those, so this screen ships no stylesheet: the table
// below is stock Tailwind and daisyUI utilities, handed to the one Markdown
// renderer (`markdown.ts`'s `toHtml`) as a class map. The copy-out passes
// no map and gets the same elements unclassed — the bytes that publish.
//
// §2.3 is why `code` carries `.num`: "Every numeral, date, URL, search
// query and **code-like string** is JetBrains Mono with tabular-nums", and
// `.num` is the one mechanism that rule is applied through (`src/ui/type.css`).
//
// `pre` carries `overflow-x-auto` because §2.2 already makes a horizontal
// scroll wrap the answer for content wider than its box, and the layout
// conformance suite names `.overflow-x-auto` as a declared scroll container
// — a long code line scrolls inside its own box rather than pushing the
// document sideways.
import type { HtmlClasses } from "@/lib/publish/render/markdown";

/** The heading scale inside a body. It starts below the screen's own `h1`
 *  (the page title) on purpose: a body's `#` is a heading *within* the
 *  page, and rendering it at the page title's size would give the document
 *  two titles. */
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
