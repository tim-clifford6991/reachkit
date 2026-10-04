// SPEC §7 (2026-09-20, issue 929) — how a published body is dressed on the
// customer's own domain.
//
// Its own module, beside the route rather than inside it, for two reasons:
// a `page.tsx` is a file Next reads exports off, so it is not a place to
// hang a constant; and a proof or a suite that wants to measure a block
// this map dresses needs somewhere to import it from.
import { MARK_CLASS } from "@/app/(account)/app/draft/[draftId]/present";
import type { HtmlClasses } from "@/lib/publish/render/markdown";

/**
 * What `prose` does not decide, and this page does (issue 929).
 *
 * Everything a body's ordinary elements look like is `prose`'s now, in this
 * theme's own colours — daisyUI 5 maps every `--tw-prose-*` to a
 * `--color-*` slot, so there is no palette here and no class table to keep.
 * What is left is what `prose` has no opinion about:
 *
 *  · `tableWrap` — SPEC §7's table scrolls **inside its own box**, so a
 *    price table on a phone moves rather than taking the page sideways
 *    with it. §2.2's own rule for every table, and the one scroll
 *    container `tests/ui/layout/checks.ts` has always allow-listed.
 *  · `mark` — the grounded passage's mint (`MARK_CLASS`), shared with the
 *    draft screen so the fact reads the same in both places.
 *  · `pre` — stated rather than left to `prose`, whose default ground is
 *    `--color-neutral`, a slot this theme does not define (`themes: false`
 *    plus our own one-theme block). An undefined slot is an invalid
 *    declaration and a code block with no ground at all.
 *  · `answer` and its eyebrow — SPEC §7's short-answer box. The box is
 *    the sunk ground the approved viewer draws (`R2-VW-C`); the eyebrow is
 *    `.eyebrow`, the product's own rung. `not-prose` on the box, because
 *    `prose` would put a paragraph's own top margin inside it.
 *
 * Nothing here is the primary colour: the product's colour would be our
 * branding on a stranger's domain.
 */
export const HOSTED_BODY_CLASSES: HtmlClasses = Object.freeze({
  tableWrap: "overflow-x-auto",
  // **A table keeps a readable width and the box moves.** `prose` sets
  // `width: 100%`, which on a phone does not scroll a table — it squeezes
  // it, and the four-column price table the approved viewer draws
  // (`R2-VW-C`) becomes one word a line at 390.
  //
  // The floor is 36rem because that is the widest that still **fits** the
  // reading column from `md` up (632px of content at 768), so the scroll
  // is a phone's and nowhere else's — which is what SPEC §7 asks for. On a
  // phone it leaves about 144px a column, and every cell wraps rather than
  // being cut, which the proof measures directly.
  table: "min-w-[36rem]",
  pre: "bg-base-200 rounded-box overflow-x-auto p-3",
  mark: MARK_CLASS,
  answer: "not-prose bg-base-200 rounded-box my-6 p-5",
  answerLabel: "eyebrow mb-2",
  // The key takeaways (SPEC §7, 2026-09-29, D4): the same box. Its list is
  // inside `not-prose`, so the markers `prose` would have set are named.
  takeaways: "not-prose bg-base-200 rounded-box my-6 p-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  takeawaysLabel: "eyebrow mb-2",
});

/**
 * Related guides at an article's foot (SPEC §7, 2026-09-29, issue 1140):
 * the block `guidesBlock()` mints, drawn outside `prose` as a row of cards —
 * three across from `sm`, one a line on a phone. The whole card is the
 * link, and it lifts no colour of ours.
 */
export const HOSTED_GUIDES_CLASSES: HtmlClasses = Object.freeze({
  guides: "mt-10",
  guidesLabel: "eyebrow mb-3",
  ul: "grid gap-4 sm:grid-cols-3",
  li: "card card-border bg-base-100",
  a: "card-body text-base-content link-hover p-4 text-sm font-bold",
});
