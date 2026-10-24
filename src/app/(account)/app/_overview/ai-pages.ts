// SPEC §4 (board AppAI) — each live page whose own question was asked: the
// question, the page's highest AI step and one mark per engine. Pure; the
// count is Overview's own `aiPagesOf`, so the two screens state one number.
import { aiPagesOf } from "@/lib/measure/figures";
import { pageLadderOf, type StepDot } from "@/lib/measure/page-ladder";
import { addressOf } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";
import type { CopyKey } from "@/lib/presentation/copy";
import type { AnswerQuestion } from "./answers-model";

export interface AiPageRow {
  id: string;
  title: string;
  href: string | null;
  /** The page's own question as the pass asked it; `null` where the pass kept none for its address. */
  question: AnswerQuestion | null;
  /** Its highest AI step; `null` where AI has not read it yet. */
  step: CopyKey | null;
  dots: readonly StepDot[];
}

export interface AiPages {
  rows: readonly AiPageRow[];
  asked: number;
  linked: number;
  /** Asked pages an answer named without linking. */
  mentioned: number;
}

// The tab's subject first: a link, then a visit, then a read.
const STEP_RANK: Readonly<Record<string, number>> = { "draft.ladder.linked": 0, "draft.ladder.visit": 1, "draft.ladder.read": 2 };

/** `null` where no live page's question has been asked yet. */
export function aiPagesFor(all: readonly PublishedPage[], pageQuestions: readonly AnswerQuestion[], now: Date): AiPages | null {
  const pages = aiPagesOf(all.filter((page) => page.publishedAt <= now));
  if (pages === null) return null;
  const ladder = pageLadderOf(pages.asked, now);
  const byAddress = new Map(pageQuestions.flatMap((q) => (q.page === null ? [] : [[addressOf(q.page.url), q] as const])));
  const linked = new Set(pages.linked.map((page) => page.id));
  const rows = pages.asked.map((page): AiPageRow => {
    const row = ladder?.rows.find((r) => r.id === page.id);
    return {
      id: page.id,
      title: page.title,
      href: row?.href ?? null,
      question: page.url === null ? null : (byAddress.get(addressOf(page.url)) ?? null),
      step: row?.ai ?? null,
      dots: row?.dots.ai ?? [],
    };
  });
  const rank = (row: AiPageRow): number => (row.step === null ? 3 : (STEP_RANK[row.step] ?? 3));
  rows.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  return {
    rows,
    asked: pages.asked.length,
    linked: pages.linked.length,
    mentioned: rows.filter((row) => !linked.has(row.id) && (row.question?.marks.includes("names_you") ?? false)).length,
  };
}
