// BUILD §2.5 — model output, branded at the point it is read out of storage.
// src/lib/presentation/generated/text.ts — BP-020, WO-279 (supersedes WO-043)
//
// Model output, wrapped at the point it is read out of storage. `fromStored`
// is this module's only exported constructor of `GeneratedText`, no
// overload accepts a literal, and no widening cast appears in this file —
// that closes a cast-based or second-constructor mint *inside this
// module*. Corrected per TST-028 finding 2: `GeneratedText` is a plain,
// unbranded interface (BP-020's declared shape), so TypeScript's structural
// typing accepts a hand-written object literal shaped `{ source: 'model',
// text: <any string> }`, written in *any* file — including a real surface —
// wherever a `GeneratedText` is expected, with no cast and no second
// constructor at all. This module does not close that path. `GeneratedText`
// is BP-020's declared interface (rule 2.4 — one claim, one home), so the
// gap and its disposition are BP-020's to carry, not restated as a second
// copy here; see `tests/presentation/generated/text.test.ts`'s matching
// describe for a reproduction of the exact construction TST-028's
// validator used.
//
// `renderGenerated` is the one sink for model text (REQ-093 criterion 2):
// it cannot be called without the identity of the page the text belongs
// to, and it returns the label and the text as one value, so a caller
// cannot render the text and drop the label. This file imports nothing
// under `src/lib/llm/` — REQ-093 criterion 5 holds because nothing here
// ever reaches for a model at render time; `renderGenerated` renders
// whatever `fromStored` read from storage, untouched.
import { copy } from "@/lib/presentation/copy";

/** The seven stored columns a language model can produce (BP-020 `## Public
 *  interface`). `tests/presentation/generated/flow-gate.test.ts` gates
 *  every value read from one of these against reaching a surface any other
 *  way than through `renderGenerated` or `renderQuestion`. */
export type GeneratedColumn =
  | "drafts.body"
  | "drafts.title"
  | "drafts.slug"
  | "drafts.description"
  | "opportunities.proposed_title"
  | "opportunities.proposed_slug"
  | "questions.wording";

/** Model output, wrapped at the point it is read out of storage. */
export interface GeneratedText {
  readonly source: "model";
  readonly text: string;
}

/** This module's only exported constructor of a `GeneratedText`. No
 *  overload accepts a literal and no widening cast appears in this file —
 *  that closes a cast-based or second-constructor mint inside this module.
 *  It does not, and structurally cannot, prevent a differently-typed
 *  object literal built outside this module and passed in anywhere a
 *  `GeneratedText` is expected (TST-028 finding 2; see the module header
 *  comment above — the gap is BP-020's to carry, since the interface is
 *  its declared shape). */
export function fromStored(column: GeneratedColumn, value: string): GeneratedText {
  return Object.freeze({ source: "model", text: value });
}

/** REQ-093 criterion 2. A written page carries all four fields; a proposed
 *  page carries a title and a slug and has no description arm at all — the
 *  requirement admits none, so none is representable. */
export type PageIdentity =
  | {
      state: "written";
      pageId: string;
      title: GeneratedText;
      slug: GeneratedText;
      body: GeneratedText;
      description?: GeneratedText;
    }
  | {
      state: "proposed";
      opportunityId: string;
      title: GeneratedText;
      slug: GeneratedText;
    };

/** One label producer (rule 7.1): both `renderGenerated` and
 *  `generatedLabel` delegate here, so there is exactly one place that
 *  chooses between the two `generated.page.*` keys. */
function labelFor(pageTitle: string, written: boolean): string {
  return written
    ? copy("generated.page.written", { pageTitle })
    : copy("generated.page.proposed", { pageTitle });
}

/** The one sink for model text. It cannot be called without the identity of
 *  the page the text belongs to, and it returns the label and the text as
 *  one value, so a caller cannot render the text and drop the label.
 *  `text` is returned untruncated — the decision to truncate belongs to
 *  the surface (BP-020 `## Error & edge behavior`, tenth bullet). */
export function renderGenerated(
  field: GeneratedText,
  page: PageIdentity
): { label: string; text: string; proposed: boolean } {
  const proposed = page.state === "proposed";
  return { label: labelFor(page.title.text, !proposed), text: field.text, proposed };
}

/** BP-019's declared helper, unchanged: the label alone, for a caller that
 *  already holds a `renderGenerated` result and needs its label
 *  separately. */
export function generatedLabel(a: { pageTitle: string; written: boolean }): { label: string } {
  return { label: labelFor(a.pageTitle, a.written) };
}
