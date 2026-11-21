// SPEC §4 (board AppAI) — each live page whose own question was asked: the
// question, what the answers did with it over the window, and one mark per engine. Pure; the
// pages are Linked by AI's own window (`tiles.ts`); every count is a count of these rows, so the tile, the lead and the list state one number.
import { pageLadderOf, type StepDot } from "@/lib/measure/page-ladder";
import { addressOf } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";
import type { AnswerQuestion } from "./answers-model";
import type { AiMark } from "./ai-mark";
import type { AiWindow } from "./tiles";

export interface AiPageRow {
  id: string;
  title: string;
  titleLabel?: string;
  href: string | null;
  /** The page's own question as the pass asked it; `null` where the pass kept none for its address. */
  question: AnswerQuestion | null;
  /** What the answers did with it over the window: the one count it is in. */
  mark: Exclude<AiMark, "unchecked">;
  dots: readonly StepDot[];
}

export interface AiPages {
  rows: readonly AiPageRow[];
  /** The weeks every count here and on the tile is read over. */
  weeks: number;
  /** Every row: the tile's and the lead's total. */
  asked: number;
  /** Rows marked `links`: the tile's and the lead's figure. */
  linked: number;
  /** Rows marked `mentions`. */
  mentioned: number;
}

const MARK_RANK: Readonly<Record<AiPageRow["mark"], number>> = { links: 0, mentions: 1, none: 2 };

/** The window's pages, one row per address; `null` where none was asked. */
export function aiPagesFor(all: readonly PublishedPage[], pageQuestions: readonly AnswerQuestion[], now: Date, window: AiWindow | null): AiPages | null {
  if (window === null) return null;
  const asked = new Set(window.asked);
  const one = new Map<string, PublishedPage>();
  for (const page of all) {
    const address = page.url === null ? null : addressOf(page.url);
    if (address !== null && page.publishedAt <= now && asked.has(address) && !one.has(address)) one.set(address, page);
  }
  if (one.size === 0) return null;
  const linked = new Set(window.linked);
  const mentioned = new Set(window.mentioned);
  const ladder = pageLadderOf([...one.values()], now);
  const byAddress = new Map(pageQuestions.flatMap((q) => (q.page === null ? [] : [[addressOf(q.page.url), q] as const])));
  const rows = [...one].map(([address, page]): AiPageRow => {
    const row = ladder?.rows.find((r) => r.id === page.id);
    return {
      id: page.id,
      title: page.title,
      ...(page.titleLabel === undefined ? {} : { titleLabel: page.titleLabel }),
      href: row?.href ?? null,
      question: byAddress.get(address) ?? null,
      mark: linked.has(address) ? "links" : mentioned.has(address) ? "mentions" : "none",
      dots: row?.dots.ai ?? [],
    };
  });
  rows.sort((a, b) => MARK_RANK[a.mark] - MARK_RANK[b.mark] || a.title.localeCompare(b.title));
  return {
    rows,
    weeks: window.weeks,
    asked: rows.length,
    linked: rows.filter((row) => row.mark === "links").length,
    mentioned: rows.filter((row) => row.mark === "mentions").length,
  };
}
