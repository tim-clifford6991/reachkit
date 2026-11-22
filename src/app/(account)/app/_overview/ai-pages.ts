// SPEC §4 (plate O3) — each live page whose own question was asked: the
// question, what the answers did with it over the window, and one mark per engine. Pure; the
// pages are the AI tile's own window (`tiles.ts`); the tile's figure is `aiAnswersOf`, these rows are its page-question marks.
import { pageLadderOf } from "@/lib/measure/page-ladder";
import { addressOf, type PlaceReport } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";
import type { AnswerEngine } from "@/lib/opportunities/types";
import type { GeneratedText } from "@/lib/presentation/generated";
import type { AnswerQuestion } from "./answers-model";
import { bestMark, enginesAsked, type AiMark } from "./ai-mark";
import { inAiWindow, namesSite, type AiWindow, type TilePass } from "@/lib/measure/results";

export interface AiPageRow {
  id: string;
  title: string;
  titleLabel?: string;
  href: string | null;
  address: string;
  /** The page's own question as the pass asked it; `null` where the pass kept none for its address. */
  question: AnswerQuestion | null;
  /** What the answers did with it over the window: the one count it is in. */
  mark: Exclude<AiMark, "unchecked">;
}

export interface AiPages {
  rows: readonly AiPageRow[];
  /** The weeks every count here and on the tile is read over. */
  weeks: number;
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
      address,
      question: byAddress.get(address) ?? null,
      mark: linked.has(address) ? "links" : mentioned.has(address) ? "mentions" : "none",
    };
  });
  rows.sort((a, b) => MARK_RANK[a.mark] - MARK_RANK[b.mark] || a.title.localeCompare(b.title));
  return { rows, weeks: window.weeks };
}

/** One page question on the AI tile's detail: its marks are each engine's best over the window. */
export interface AiQuestionRow {
  page: AiPageRow;
  wording: GeneratedText | null;
  search: string;
  lastAsked: Date;
  marks: Readonly<Partial<Record<AnswerEngine, AiMark>>>;
  best: AiMark;
  /** The rivals the latest answers named; `null` where their text was not read, which is not "no one". */
  rivals: readonly string[] | null;
}

export interface AiQuestions {
  /** The engines the window's questions were asked of, in the plate's column order. */
  engines: readonly AnswerEngine[];
  rows: readonly AiQuestionRow[];
  weeks: number;
  checkedAt: Date | null;
}

type Row = NonNullable<PlaceReport["pageQuestions"]>["rows"][number];
type Cell = Row["cell"] & { citedDomains?: readonly string[]; named?: boolean };
type Asked = { engine: string; cell: Cell; rivals?: readonly string[] };

const ENGINE_ORDER: readonly AnswerEngine[] = ["chatgpt", "ai_overview", "ai_mode"];
const SORT: Readonly<Record<AiMark, number>> = { links: 0, mentions: 1, none: 2, unchecked: 3 };

// A row stored before per-engine cells carries the AI Overview's cell alone.
const cellsOf = (row: Row): readonly Asked[] => (row.engines.length === 0 ? [{ engine: "ai_overview", cell: row.cell }] : (row.engines as readonly Asked[]));

function markOf(cell: Cell, address: string, domain: string): AiMark {
  if (cell.kind === "unmeasured") return "unchecked";
  if (cell.kind === "answered" && (cell.ownUrls ?? []).some((url) => addressOf(url) === address)) return "links";
  return namesSite(cell, domain) ? "mentions" : "none";
}

/** The AI tile's detail: one row per page the tile counts, with each engine's best mark over the window's healthy passes. */
export function aiQuestionsOf(pages: AiPages | null, passes: readonly TilePass[], domain: string): AiQuestions | null {
  const sorted = [...passes].sort((x, y) => x.weekStart.localeCompare(y.weekStart));
  const week = sorted.at(-1)?.weekStart;
  if (pages === null || week === undefined) return null;
  const inWindow = sorted.filter((pass) => inAiWindow(pass, week));
  const asked = inWindow.flatMap((pass) => (pass.report.pageQuestions?.rows ?? []).map((row) => ({ engines: cellsOf(row) })));
  const measured = enginesAsked(asked);
  const engines = ENGINE_ORDER.filter((engine) => measured.includes(engine));
  const rows = pages.rows.flatMap((page): AiQuestionRow[] => {
    const weeks = new Map<string, AiMark[]>();
    let latest: { at: Date; row: Row } | null = null;
    for (const pass of inWindow) {
      for (const row of (pass.report.pageQuestions?.rows ?? []).filter((r) => r.publicationId === page.id)) {
        latest = { at: new Date(pass.at), row };
        for (const { engine, cell } of cellsOf(row)) weeks.set(engine, [...(weeks.get(engine) ?? []), markOf(cell, page.address, domain)]);
      }
    }
    if (latest === null) return [];
    const marks = Object.fromEntries(engines.map((engine) => [engine, bestMark(weeks.get(engine) ?? [])]));
    const read = cellsOf(latest.row).filter((cell) => cell.rivals !== undefined);
    const stored = (latest.row.question as { wording?: GeneratedText }).wording;
    return [
      {
        page,
        wording: page.question?.wording ?? stored ?? null,
        search: page.question?.search ?? latest.row.question.search,
        lastAsked: latest.at,
        marks,
        best: bestMark(Object.values(marks)),
        rivals: read.length === 0 ? null : [...new Set(read.flatMap((cell) => cell.rivals!))],
      },
    ];
  });
  rows.sort((a, b) => SORT[a.best] - SORT[b.best] || b.lastAsked.getTime() - a.lastAsked.getTime());
  return { engines, rows, weeks: pages.weeks, checkedAt: inWindow.length === 0 ? null : new Date(inWindow.at(-1)!.at) };
}
