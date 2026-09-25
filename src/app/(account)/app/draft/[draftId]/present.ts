// SPEC §7 — how the draft body's own markup is dressed, and nothing else.
//
// The maps below are handed to the one Markdown renderer (`markdown.ts`'s
// `toHtml`), so the screen ships no stylesheet: the body is Tailwind's scale
// on each element. The copy-out passes no map and gets the same elements
// unclassed — the bytes that publish.
import type { HtmlClasses } from "@/lib/publish/render/markdown";

/**
 * The grounded passage's tint, in the mint the approved set draws it in
 * (issue #414). The set's own rule is `.mark{background:var(--ok-bg);
 * box-shadow:0 0 0 1px var(--ok-line);border-radius:var(--s-1);
 * padding:1px 3px;color:var(--color-base-content)}` on S16's body and S19's alike, so the
 * tint is the `--color-success` family's own pair and the edge is its line — not
 * `--color-success` at an alpha, which is a fifth mint nothing else in the product
 * spends. This was the warn family, on the reading that §2.5 rules red
 * out; mint is what the drawing settles, and it says the same thing
 * better — a grounded fact is a check that passed, which is what `--color-success`
 * means everywhere else on this screen (the Checks list's ticks are `--color-success`
 * too).
 *
 * `--ok-bg` and `--ok-line` reach no daisyUI slot: §2.1 maps `success` to
 * `--color-success` and stops, so they are read by name. That is a token reference
 * and not a literal — the value still lives once, in `theme.css`, and
 * flips with the theme there.
 *
 * **The ink is stated, and has to be.** Nothing resets `mark`, so its
 * colour is the UA's `MarkText` — near-black — which the old rule left
 * standing on a dark ground. `text-base-content` is §2.1's own slot for
 * `--color-base-content`, which is what the set writes.
 *
 * **It is its own constant since issue 929**, because it is the one class
 * two screens must agree on: the draft screen's map below and the hosted
 * page's (`(hosted)/hosted-page/…/page.tsx`) both take it from here, so a
 * grounded fact reads the same wherever it is read. The rest of what used
 * to be `BODY_CLASSES` went with the hosted page, which is where its own
 * note said it belonged.
 */
export const MARK_CLASS = "bg-[var(--ok-bg)] text-base-content ring-1 ring-[var(--ok-line)] rounded px-1";

/**
 * The map the **draft screen** renders with — the read view's body and the
 * editor's preview alike. Headings arrive one level down (`demoteHeadings`),
 * under the screen's own `<h1>`, so a body starts at `h2`.
 *
 * `code` carries `.num` (the mono face for code-like strings). `pre` carries
 * `overflow-x-auto` so a long code line scrolls inside its own box rather
 * than pushing the document sideways. The grounded passage's `mark` is
 * `MARK_CLASS`, the one both this screen and the hosted page take, so the
 * fact reads the same in both places.
 */
export const DRAFT_BODY_CLASSES: HtmlClasses = Object.freeze({
  h1: "mt-6 mb-2 text-2xl font-semibold",
  h2: "mt-6 mb-2 text-xl font-semibold",
  h3: "mt-5 mb-2 text-lg font-semibold",
  h4: "mt-4 mb-1 text-base font-semibold",
  h5: "mt-4 mb-1 text-base font-semibold",
  h6: "mt-4 mb-1 text-sm font-semibold",
  p: "my-3 leading-relaxed",
  ul: "my-3 list-disc pl-6",
  ol: "my-3 list-decimal pl-6",
  li: "my-1",
  blockquote: "border-base-300 my-4 border-l-4 pl-4 italic",
  pre: "bg-base-200 rounded-box my-4 overflow-x-auto p-3",
  code: "num text-sm",
  hr: "border-base-300 my-6",
  a: "link",
  mark: MARK_CLASS,
  strong: "font-semibold",
  em: "italic",
});

/**
 * Every heading in the body, one level down. It moved to the one Markdown
 * renderer (issue #493) because the legal screen (S5) needs the same shift
 * for the same reason — a body under the screen's own `<h1>` — and a second
 * copy here would be a second rule for one thing. Re-exported so this
 * screen's callers read it from where they always have; `markdown.ts`
 * carries the reasoning.
 */
export { demoteHeadings } from "@/lib/publish/render/markdown";
