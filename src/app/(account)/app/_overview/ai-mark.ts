// SPEC §4 *Overview's four tiles* — the one AI mark every Overview detail draws
// for a page: "to you", because an answer's link is recorded for the site, not the page.
import { CircleDashed, CircleMinus, Link, MessageSquare, type LucideIcon } from "lucide-react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { AnswerEngine } from "@/lib/opportunities/types";

export type AiMark = "links" | "mentions" | "none" | "unchecked";

export const AI_MARK: Readonly<Record<AiMark, { icon: LucideIcon; key: CopyKey }>> = {
  links: { icon: Link, key: "overview.mark.links" },
  mentions: { icon: MessageSquare, key: "overview.mark.mentions" },
  none: { icon: CircleMinus, key: "overview.mark.none" },
  unchecked: { icon: CircleDashed, key: "overview.mark.unchecked" },
};

const RANK: Readonly<Record<AiMark, number>> = { links: 0, mentions: 1, none: 2, unchecked: 3 };

/** The best result over the window's weeks: a link, then a mention, then asked and neither; never asked is never "none". */
export function bestMark(weeks: readonly AiMark[]): AiMark {
  return weeks.reduce<AiMark>((best, mark) => (RANK[mark] < RANK[best] ? mark : best), "unchecked");
}

/** The engines a set of answer rows asked: one with a cell that is not `unmeasured` on any row, so no engine nobody asked is named. */
export function enginesAsked(rows: readonly { engines: readonly { engine: string; cell: { kind: string } }[] }[]): AnswerEngine[] {
  const asked: AnswerEngine[] = [];
  for (const row of rows) for (const { engine, cell } of row.engines) if (cell.kind !== "unmeasured" && !asked.includes(engine as AnswerEngine)) asked.push(engine as AnswerEngine);
  return asked;
}
