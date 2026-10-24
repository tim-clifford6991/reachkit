// SPEC §4 (owner E4, 2026-10-19; board Main) — how far the live pages have
// got: each step's count over the stored readings, and one row per page with
// its highest steps and its label. Pure; a step nothing read is `null`, never 0.
import type { Reached, PageReading } from "@/lib/measure/page-reading";
import type { CopyKey } from "@/lib/presentation/copy";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { verdict } from "@/lib/opportunities/verdicts/verdict";
import type { PublishedPage } from "./published";

type StepKey = keyof Reached | "live";

interface StepDef {
  step: StepKey;
  name: CopyKey;
  line: CopyKey;
  /** Only server logs show it, so a WordPress page cannot be read on it. */
  logs: boolean;
}

const GOOGLE: readonly StepDef[] = [
  { step: "live", name: "draft.ladder.live", line: "overview.ladder.step.live", logs: false },
  { step: "found", name: "draft.ladder.found", line: "overview.ladder.step.found", logs: true },
  { step: "showing", name: "draft.ladder.showing", line: "overview.ladder.step.showing", logs: false },
  { step: "firstPage", name: "draft.ladder.first-page", line: "overview.ladder.step.first-page", logs: false },
];

const AI: readonly StepDef[] = [
  { step: "readByAi", name: "draft.ladder.read", line: "overview.ladder.step.read", logs: true },
  { step: "linkedByAi", name: "draft.ladder.linked", line: "overview.ladder.step.linked", logs: false },
  { step: "aiVisit", name: "draft.ladder.visit", line: "overview.ladder.step.visit", logs: true },
];

export interface StepFigure {
  /** Its place on its own ladder, from 1. */
  n: number;
  name: CopyKey;
  line: CopyKey;
  /** Pages that reached it; `null` where no page it can be read on was read. */
  count: number | null;
  /** The pages it can be read on that have a reading; "live" counts every live page. */
  of: number;
}

export interface LadderRow {
  id: string;
  title: string;
  /** The page's own screen; `null` where the publish kept no draft. */
  href: string | null;
  label: Label | null;
  /** Its highest Google step, and its highest AI step; `null` when none. */
  google: CopyKey;
  ai: CopyKey | null;
  measured: boolean;
  /** Each step the page can be read on, in order, and whether it got there. */
  dots: { google: StepDot[]; ai: StepDot[] };
}

export interface StepDot {
  name: CopyKey;
  reached: boolean;
}

export interface PageLadder {
  live: number;
  /** The newest reading's instant; `null` where no page was read. */
  readAt: Date | null;
  /** Live pages with no reading yet, so a step's `of` can sit below `live`. */
  unread: number;
  google: StepFigure[];
  ai: StepFigure[];
  climbing: number;
  /** Visits from Google search this week, counted on the hosted pages; `null` where none can be counted. */
  visits: number | null;
  /** Before any page shows in results: what has lit up so far. */
  week1: { live: number; found: number | null; read: number | null } | null;
  rows: LadderRow[];
}

function reached(page: PublishedPage, step: StepKey): boolean {
  return step === "live" || page.reading?.reached[step] !== undefined;
}

function figures(defs: readonly StepDef[], pages: readonly PublishedPage[]): StepFigure[] {
  return defs.flatMap((def, i): StepFigure[] => {
    const on = def.logs ? pages.filter((page) => page.wordpress !== true) : pages;
    if (on.length === 0) return [];
    const read = def.step === "live" ? on : on.filter((page) => page.reading != null);
    const count = read.length === 0 ? null : read.filter((page) => reached(page, def.step)).length;
    return [{ n: i + 1, name: def.name, line: def.line, count, of: read.length }];
  });
}

function highest(defs: readonly StepDef[], page: PublishedPage): CopyKey | null {
  const open = defs.filter((def) => !(def.logs && page.wordpress === true) && reached(page, def.step));
  return open.at(-1)?.name ?? null;
}

function dotsOf(defs: readonly StepDef[], page: PublishedPage): StepDot[] {
  return defs.filter((def) => !(def.logs && page.wordpress === true)).map((def) => ({ name: def.name, reached: reached(page, def.step) }));
}

function countOf(list: readonly StepFigure[], name: CopyKey): number | null {
  return list.find((figure) => figure.name === name)?.count ?? null;
}

export function pageLadderOf(all: readonly PublishedPage[], now: Date, visits: number | null = null): PageLadder | null {
  const pages = all.filter((page) => page.publishedAt <= now);
  if (pages.length === 0) return null;
  const readings = pages.map((page) => page.reading).filter((r): r is PageReading => r != null);
  const google = figures(GOOGLE, pages);
  const ai = figures(AI, pages);
  const showing = countOf(google, "draft.ladder.showing");
  return {
    live: pages.length,
    readAt: readings.length === 0 ? null : new Date(Math.max(...readings.map((r) => Date.parse(r.at)))),
    unread: pages.length - readings.length,
    google,
    ai,
    climbing: readings.filter((r) => verdict(r, now) === "climbing").length,
    visits,
    week1:
      (showing ?? 0) === 0 && pages.length > 1
        ? { live: pages.length, found: countOf(google, "draft.ladder.found"), read: countOf(ai, "draft.ladder.read") }
        : null,
    rows: pages.map((page) => ({
      id: page.id,
      title: page.title,
      href: page.draftId === undefined ? null : `/app/draft/${page.draftId}`,
      label: page.reading == null ? null : verdict(page.reading, now),
      google: highest(GOOGLE, page) ?? "draft.ladder.live",
      ai: highest(AI, page),
      measured: page.reading != null,
      dots: { google: dotsOf(GOOGLE, page), ai: dotsOf(AI, page) },
    })),
  };
}
