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
  // §2.5: the grounded passage is the customer's evidence, not their
  // problem, so it is marked in the warn family and never in red — red
  // "appears only for *the customer's problem being shown to them*".
  mark: "bg-warning/25 rounded px-1",
  strong: "font-bold",
  em: "italic",
});
