// `Canvas: DailyAction` — how the body's own markup is dressed, and
// nothing else.
//
// The draft body ships no stylesheet: the maps below are handed to the one
// Markdown renderer (`markdown.ts`'s `toHtml`), and every step in them is a
// Tailwind utility over an approved token rather than a class in a sheet.
// The copy-out passes no map and gets the same elements unclassed — the
// bytes that publish.
import type { HtmlClasses } from "@/lib/publish/render/markdown";

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
 * The map the **draft screen** renders its body with. The typography is
 * the approved ladder and the approved spacing steps, spent as utilities
 * over the tokens themselves, so the body carries no stylesheet.
 */
export const DRAFT_BODY_CLASSES: HtmlClasses = Object.freeze({
  h2: "mt-(--s-5) mb-(--s-3) text-(length:--h2) font-bold text-base-content",
  h3: "mt-(--s-5) mb-(--s-3) text-(length:--h3) font-bold text-base-content",
  h4: "mt-(--s-4) mb-(--s-2) text-(length:--h4) font-bold text-base-content",
  h5: "mt-(--s-4) mb-(--s-2) font-bold text-base-content",
  h6: "mt-(--s-4) mb-(--s-2) font-bold text-base-content",
  p: "mb-(--s-3)",
  ul: "mb-(--s-3) list-disc ps-(--s-5)",
  ol: "mb-(--s-3) list-decimal ps-(--s-5)",
  li: "mb-(--s-1)",
  blockquote: "mb-(--s-3) border-s border-base-300 ps-(--s-4) text-(color:--ink-3)",
  pre: "mb-(--s-3) overflow-x-auto rounded-(--r-field) bg-(--bg) p-(--s-3)",
  code: "num text-(length:--t-sm)",
  hr: "my-(--s-5) border-0 border-t border-base-300",
  a: "text-primary underline",
  mark: "rounded-(--s-1) border border-(--ok-line) bg-(--ok-bg) px-(--s-1) text-base-content",
  strong: "font-bold text-base-content",
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
