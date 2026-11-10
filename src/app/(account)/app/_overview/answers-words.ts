// SPEC §6 (2026-09-20, #908) — the AI answers tab's handles, and the words
// and the marks each one is drawn with.
//
// Three maps, all keyed by `ANSWER_MARKS`, so a new mark is a compile
// error here — beside its word and beside its glyph — rather than a cell
// nobody can read. The engine names are `_shell/page-target-words.ts`'s,
// which are the report screen's own keys: a second spelling of "Google AI
// Overview" would be the second place the product speaks.
//
// **No sentence is composed here.** Every value is a `CopyKey`; the strings
// are `src/lib/presentation/copy/keys/overview.ts`'s, which is the owner's
// file.
//
// **Identity is never colour-alone** (docs/DESIGN.md, §2.4). Each mark
// carries a lucide glyph as well as a theme colour, and every cell carries
// its own written name, so a reader who sees neither colour still reads the
// grid.
import type { LucideIcon } from "lucide-react";
import { CircleDashed, Link, MessageSquare, Minus } from "lucide-react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { AnswerMark } from "./answers-model";

/** Three marks a reader sees; the stored six stay, and every count reads those. */
export const MARK_COPY_KEY: Readonly<Record<AnswerMark, CopyKey>> = Object.freeze({
  links_to_you: "overview.answers.mark.links",
  names_you: "overview.answers.mark.names",
  names_others: "overview.answers.mark.not-you",
  names_no_one: "overview.answers.mark.not-you",
  no_answer: "overview.answers.mark.not-you",
  // Never a miss: an engine nobody reached is its own grey state, never 0.
  not_measured: "overview.answers.mark.not-measured",
});

/** The marks the legend always draws, one per word; "Not checked" joins only where a cell is one. */
export const LEGEND_MARKS: readonly AnswerMark[] = ["links_to_you", "names_you", "names_others"];

/** One lucide glyph per mark at the house stroke (docs/DESIGN.md rule 3); the em-dash is REQ-004's reading never taken. */
export const MARK_ICON: Readonly<Record<AnswerMark, LucideIcon>> = Object.freeze({
  links_to_you: Link,
  names_you: MessageSquare,
  names_others: CircleDashed,
  names_no_one: CircleDashed,
  no_answer: CircleDashed,
  not_measured: Minus,
});

/** Only the customer's own marks are coloured, and none red: §2.5 keeps red for the customer's own problem. */
export const MARK_TONE: Readonly<Record<AnswerMark, string>> = Object.freeze({
  links_to_you: "text-(--chart-you)",
  names_you: "text-(--chart-you)",
  names_others: "text-base-content/70",
  names_no_one: "text-base-content/70",
  no_answer: "text-base-content/70",
  not_measured: "text-base-content/30",
});
