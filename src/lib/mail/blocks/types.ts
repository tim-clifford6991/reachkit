// BUILD §12 — the only vocabulary a mail template may speak: eight arms, no free-string escape hatch.
// Every absent-able value is a `Measured<T>`, so no template formats a number or skips BUILD §12's omission; every sentence is a `CopyKey`.
// `pageBody` carries the draft itself with what `generatedLabel()` needs, so model text never reaches a mail unlabelled (ADR-012).
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";

/** Named slot values a sentence may carry. `copy()`'s own `vars` shape. */
export type CopyVars = Readonly<Record<string, string | number>>;

/** One `list` row. It carries no format of its own, which would be a second numeral formatter. */
export interface ListRow {
  readonly label: CopyKey;
  readonly vars?: CopyVars;
  /** The HTML body links the row; the twin writes the address beside it. */
  readonly href?: string;
  /** Lines under the row's own, in order. */
  readonly detail?: readonly { readonly text: CopyKey; readonly vars?: CopyVars }[];
  /** Links on one line under the row, where it offers more than one thing to do. */
  readonly links?: readonly { readonly label: CopyKey; readonly vars?: CopyVars; readonly href: string }[];
}

/** One row of the shell's mono `dl` between the short line and the button (UI-SPEC S20). */
export interface FactRow {
  readonly label: CopyKey;
  readonly labelVars?: CopyVars;
  /** Already written (a domain, a `formatStat` number, a `copy()` band word): a datum, not a sentence, so not a key. */
  readonly value: string;
}

/** A subject and its band word; band words come from `BAND_LABELS` (ADR-001), never authored here. */
export interface VerdictRow {
  readonly subject: CopyKey;
  readonly subjectVars?: CopyVars;
  readonly verdict: CopyKey;
}

/** How a number is written; a fifth form is a change to this union, not a caller's string. */
export type StatFormat = "integer" | "delta" | "perMonth" | "percent";

/** One number in a `stats` group; an unmeasured number omits its row, never the group (SPEC §8). */
export interface StatRow {
  readonly label: CopyKey;
  readonly labelVars?: CopyVars;
  readonly value: Measured<number>;
  readonly format: StatFormat;
  /** Omitted on its own when unmeasured: a "0" change nobody measured would be a claim. */
  readonly change?: Measured<number>;
  /** A written word that stands before the figure: "at least". */
  readonly before?: CopyKey;
  /** What the figure is read against (range, sample, window); it travels with the figure. */
  readonly note?: { readonly text: CopyKey; readonly vars?: CopyVars };
  /** SPEC §8: an unmeasured row with this line is kept and says so; without it the row is omitted. Never a zero. */
  readonly unmeasuredLine?: CopyKey;
}

export type MailBlock =
  | { readonly block: "heading"; readonly text: CopyKey; readonly vars?: CopyVars }
  | { readonly block: "paragraph"; readonly text: CopyKey; readonly vars?: CopyVars }
  | {
      readonly block: "stat";
      readonly label: CopyKey;
      readonly value: Measured<number>;
      readonly format: StatFormat;
      /** Omitted with its value, so no disclosure stands beside a dropped number. */
      readonly note?: CopyKey;
    }
  | {
      readonly block: "list";
      /** The eyebrow over the rows; absent where a heading above already names them. */
      readonly label?: CopyKey;
      readonly items: Measured<readonly ListRow[]>;
      /** A measured-empty list states this line; an unmeasured one is omitted. */
      readonly emptyLine: CopyKey;
    }
  | {
      readonly block: "verdicts";
      readonly label: CopyKey;
      readonly items: Measured<readonly VerdictRow[]>;
      readonly emptyLine: CopyKey;
    }
  | {
      /** The shell's label/value `dl`; empty drops the block. Not `Measured`: a fact is what the mail is about, and a
       *  row that depends on a measurement is left out by the template that knows it. */
      readonly block: "facts";
      readonly items: readonly FactRow[];
    }
  | {
      /** SPEC §8's one headline number up top. Unmeasured omits the block and its change with it. */
      readonly block: "hero";
      readonly label: CopyKey;
      readonly value: Measured<number>;
      readonly format: StatFormat;
      readonly change?: Measured<number>;
      readonly note?: CopyKey;
    }
  | {
      /** SPEC §8's four Overview numbers with change, as one group laid two to a row so a dropped number leaves no gap. */
      readonly block: "stats";
      readonly items: readonly StatRow[];
    }
  | {
      readonly block: "action";
      readonly label: CopyKey;
      readonly href: string;
      /** `primary` (the default) is S20's one solid fill; `secondary` is the outlined second thing a reader may do. */
      readonly variant?: "primary" | "secondary";
    }
  | { readonly block: "notice"; readonly text: CopyKey; readonly vars?: CopyVars }
  | {
      readonly block: "pageBody";
      readonly pageTitle: string;
      readonly written: boolean;
      readonly markdown: string;
    };

/** The arms that depend on a measurement; `shell/compose.ts`'s nothing-to-report line counts over these.
 *  `facts` is not one: its rows restate the heading, so losing them is not losing the mail's point. */
export const CONDITIONAL_BLOCKS = ["stat", "hero", "stats", "list", "verdicts"] as const;

export type ConditionalBlock = (typeof CONDITIONAL_BLOCKS)[number];

export function isConditional(block: MailBlock): boolean {
  return (CONDITIONAL_BLOCKS as readonly string[]).includes(block.block);
}
