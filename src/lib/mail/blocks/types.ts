// BUILD §12 — the only vocabulary a mail template may speak.
//
// Eight arms, and nothing else. A template hands `composeMail()` a list of
// these and holds no conditional of its own: every value that can be
// absent enters as a `Measured<T>` (`src/lib/measure/measured.ts`), so a
// template cannot format a number itself and cannot forget BUILD §12's
// omission rule ("all values conditional: a missing number omits its
// section, never prints 0"). Which blocks are dropped is decided once, in
// `omit.ts`, and both renderers read that one decision.
//
// Every sentence is a `CopyKey`. `pageBody` is the one arm carrying a
// string that is not a key — the draft page itself — and it carries the
// two fields `generatedLabel()` needs, so model text cannot reach a mail
// without the label that identifies it (ADR-012, §8's `GeneratedText`
// rule). There is no ninth arm and no free-string escape hatch.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";

/** Named slot values a sentence may carry. `copy()`'s own `vars` shape. */
export type CopyVars = Readonly<Record<string, string | number>>;

/** One row of a `list` block: a written label and, optionally, one value
 *  measured alongside it. The `value` is already rendered by whoever built
 *  the row — a list row carries no format of its own, because a row that
 *  could format would be a second numeral formatter. */
export interface ListRow {
  readonly label: CopyKey;
  readonly vars?: CopyVars;
}

/** One row of a `facts` block — the `dl` of mono fact rows the approved
 *  shell draws between the short line and the button (UI-SPEC S20). Both
 *  halves are keys: a fact row is a written label and a written value, and
 *  a number reaches it through the value's own slot, already formatted by
 *  `formatStat`, so this arm mints no second numeral formatter either. */
export interface FactRow {
  readonly label: CopyKey;
  /**
   * The value, already written by whoever built the row — a domain, an
   * address, a number through `formatStat`, a band word through `copy()`.
   * A datum and not a sentence, which is why it is the one field on this
   * arm that is not a key: "you@company.com" and "62 · Hard to find" are
   * facts about one mail, and a key per address is not a copy registry.
   */
  readonly value: string;
}

/** One row of a `verdicts` block: the subject of the verdict and the band
 *  word that is the verdict. Both are keys; the band words come from
 *  `BAND_LABELS` (ADR-001), never authored here. */
export interface VerdictRow {
  readonly subject: CopyKey;
  readonly subjectVars?: CopyVars;
  readonly verdict: CopyKey;
}

/** How a `stat` block's number is written. Three forms, closed: a plain
 *  integer, a signed delta, and a per-month rate. A fourth form is a
 *  change to this union, not a caller's string. */
export type StatFormat = "integer" | "delta" | "perMonth";

export type MailBlock =
  | { readonly block: "heading"; readonly text: CopyKey; readonly vars?: CopyVars }
  | { readonly block: "paragraph"; readonly text: CopyKey; readonly vars?: CopyVars }
  | {
      readonly block: "stat";
      readonly label: CopyKey;
      readonly value: Measured<number>;
      readonly format: StatFormat;
      /** Travels with its value or not at all: an omitted stat takes its
       *  note with it, so no measurement disclosure is ever left standing
       *  beside a number that was dropped. */
      readonly note?: CopyKey;
    }
  | {
      readonly block: "list";
      readonly label: CopyKey;
      readonly items: Measured<readonly ListRow[]>;
      /** A measured-empty list states its empty result in one written
       *  line. An unmeasured one is omitted instead — the two are not the
       *  same fact. */
      readonly emptyLine: CopyKey;
    }
  | {
      readonly block: "verdicts";
      readonly label: CopyKey;
      readonly items: Measured<readonly VerdictRow[]>;
      readonly emptyLine: CopyKey;
    }
  | {
      /**
       * The `dl` the approved shell draws: label/value pairs, the value in
       * mono. An empty list drops the whole block, because there is no
       * sentence that says "no facts" — a mail with nothing to state states
       * nothing (`omit.ts`).
       *
       * Not a `Measured`, unlike the three conditional arms. A fact row is
       * what the mail is *about* — the address a link is for, the search a
       * page targets — and none of them is a measurement with an `at`. A
       * row that depends on one is left out by the template that knows the
       * measurement, exactly as `verdicts` rows already are.
       */
      readonly block: "facts";
      readonly items: readonly FactRow[];
    }
  | { readonly block: "action"; readonly label: CopyKey; readonly href: string }
  | { readonly block: "notice"; readonly text: CopyKey; readonly vars?: CopyVars }
  | {
      readonly block: "pageBody";
      readonly pageTitle: string;
      readonly written: boolean;
      readonly markdown: string;
    };

/** The three arms whose presence depends on a measurement. The whole-mail
 *  line (`shell/compose.ts`) counts over exactly these: a mail of headings
 *  and actions alone has nothing conditional in it and says nothing about
 *  having nothing to report.
 *
 *  `facts` is deliberately **not** here, though `omit.ts` can drop it. The
 *  fact rows restate what the heading and the one line already say — the
 *  address a link is for, the search a page targets — so a mail that lost
 *  them has not lost its point, and "nothing to report" would be false. */
export const CONDITIONAL_BLOCKS = ["stat", "list", "verdicts"] as const;

export type ConditionalBlock = (typeof CONDITIONAL_BLOCKS)[number];

export function isConditional(block: MailBlock): boolean {
  return (CONDITIONAL_BLOCKS as readonly string[]).includes(block.block);
}
