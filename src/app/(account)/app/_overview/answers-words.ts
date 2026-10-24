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
import { CircleDashed, CircleMinus, Link, MessageSquare, Minus, Users } from "lucide-react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { AnswerMark } from "./answers-model";

export const MARK_COPY_KEY: Readonly<Record<AnswerMark, CopyKey>> = Object.freeze({
  links_to_you: "overview.answers.mark.links",
  names_you: "overview.answers.mark.names",
  names_others: "overview.answers.mark.others",
  names_no_one: "overview.answers.mark.no-one",
  no_answer: "overview.answers.mark.no-answer",
  not_measured: "overview.answers.mark.not-measured",
});

/**
 * The glyph each mark wears, at lucide's house stroke (docs/DESIGN.md rule
 * 3), one glyph per concept across the product: a link, a speech bubble
 * for a mention without one, the crowd for someone else, the empty dashed
 * circle for no one, the struck circle for no answer; an engine nobody
 * reached is the em-dash, which is REQ-004's own mark for a reading that
 * was never taken and is the one the issue asks for by name.
 */
export const MARK_ICON: Readonly<Record<AnswerMark, LucideIcon>> = Object.freeze({
  links_to_you: Link,
  names_you: MessageSquare,
  names_others: Users,
  names_no_one: CircleDashed,
  no_answer: CircleMinus,
  not_measured: Minus,
});

/**
 * The tone each mark is painted in.
 *
 * Only two of the six are coloured at all, and neither is red: §2.5 keeps
 * red for the customer's own problem being shown to them, and an engine
 * that named somebody else or nobody, served no answer or was never
 * reached is not one of those — it is what was measured. Painting three of five red would
 * turn a record of the week into a wall of failure.
 */
export const MARK_TONE: Readonly<Record<AnswerMark, string>> = Object.freeze({
  links_to_you: "text-(--chart-you)",
  names_you: "text-(--chart-you)",
  names_others: "text-base-content/70",
  names_no_one: "text-base-content/70",
  no_answer: "text-base-content/40",
  not_measured: "text-base-content/30",
});
