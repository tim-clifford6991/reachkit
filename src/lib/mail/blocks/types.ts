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
  /** Where the row leads, where it leads anywhere: the HTML body links the
   *  row and the twin writes the address beside it. */
  readonly href?: string;
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

/** One number in a `stats` group: the same three fields a `stat` carries,
 *  plus the change beside it. Its own interface because the group holds
 *  several and each is omitted on its own — an unmeasured number omits its
 *  row, never the group (SPEC §8, 2026-09-20). */
export interface StatRow {
  readonly label: CopyKey;
  readonly value: Measured<number>;
  readonly format: StatFormat;
  /** The change since the measurement before it. Omitted on its own where
   *  it was not measured: a number with no comparison is still a number,
   *  and a "0" change nobody measured would be a claim. */
  readonly change?: Measured<number>;
}

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
  | {
      /**
       * SPEC §8 (2026-09-20, #933) — the one number up top.
       *
       * The mail's headline figure, above everything the mail then says
       * about it: the searches a month a page was written for, the
       * visibility score a week moved. One per mail by construction of the
       * templates, not by a rule here.
       *
       * Unmeasured omits the whole block — including its change, which
       * travels with it for the reason a `stat`'s note does: a change
       * standing beside a number that was dropped is a movement of
       * nothing.
       */
      readonly block: "hero";
      readonly label: CopyKey;
      readonly value: Measured<number>;
      readonly format: StatFormat;
      readonly change?: Measured<number>;
      readonly note?: CopyKey;
    }
  | {
      /**
       * SPEC §8 (2026-09-20, #933) — "the four Overview numbers with
       * change", as one group.
       *
       * A group and not four `stat` blocks, because the four are read
       * together: the renderer lays them two to a row, and a mail that
       * dropped one of them keeps the shape rather than leaving a gap.
       * Each row is omitted on its own; the group goes when none is left.
       */
      readonly block: "stats";
      readonly items: readonly StatRow[];
    }
  | {
      readonly block: "action";
      readonly label: CopyKey;
      readonly href: string;
      /** How the button is drawn. `primary` is the one solid fill S20
       *  gives a mail; `secondary` is the outlined one beside it, for the
       *  second thing a reader may do — *Stop this page* beside *Read the
       *  full page*. Absent is `primary`, so every mail written before
       *  #933 draws exactly what it drew. */
      readonly variant?: "primary" | "secondary";
    }
  | { readonly block: "notice"; readonly text: CopyKey; readonly vars?: CopyVars }
  | {
      readonly block: "pageBody";
      readonly pageTitle: string;
      readonly written: boolean;
      readonly markdown: string;
    };

/** The arms whose presence depends on a measurement. The whole-mail line
 *  (`shell/compose.ts`) counts over exactly these: a mail of headings and
 *  actions alone has nothing conditional in it and says nothing about
 *  having nothing to report.
 *
 *  `hero` and `stats` join them with #933: they are numbers, they are
 *  dropped when nothing measured them, and a mail whose headline figure
 *  and four numbers all went *has* lost what it was about.
 *
 *  `facts` is deliberately **not** here, though `omit.ts` can drop it. The
 *  fact rows restate what the heading and the one line already say — the
 *  address a link is for, the search a page targets — so a mail that lost
 *  them has not lost its point, and "nothing to report" would be false. */
export const CONDITIONAL_BLOCKS = ["stat", "hero", "stats", "list", "verdicts"] as const;

export type ConditionalBlock = (typeof CONDITIONAL_BLOCKS)[number];

export function isConditional(block: MailBlock): boolean {
  return (CONDITIONAL_BLOCKS as readonly string[]).includes(block.block);
}
