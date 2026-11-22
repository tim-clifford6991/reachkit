// src/lib/market/prompts/generate.ts — the AI panel (SPEC §6, owner ruling 73, 2026-11-22): what the weekly pass asks the AI engines,
// drawn by rule from the searches the site is measured on, never worded by us. Pure: no I/O.
import { TRACKED_PROMPTS } from "@/lib/config/constants";
import type { Language, Place } from "@/lib/locale/locales";
import { askedIn } from "@/lib/locale/place";
import { brandOf, namesAnyOf } from "@/lib/market/questions/select";
import { closestPrompt } from "@/lib/opportunities/intent";

/** A panel item is a `search`; the other kinds are the templates an older set or report asked. */
export const PROMPT_KINDS = Object.freeze(["search", "category", "use-case", "persona", "comparison", "problem", "branded"] as const);
export type PromptKind = (typeof PROMPT_KINDS)[number];

export interface GeneratedPrompt {
  kind: PromptKind;
  /** The search as buyers type it, which AI Mode is asked. */
  text: string;
  /** The stored "People also ask" question closest to it, which ChatGPT is asked in its place. */
  question?: string;
}

const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The panel: the twelve, then the runners-up by the same selection score, to `TRACKED_PROMPTS.PANEL`, with no item that names the
 *  business or a rival. A business that serves one place is asked its question there. */
export function panelOf(a: {
  searches: readonly string[];
  questions: readonly string[];
  siteName: string;
  rivals: readonly { name: string; domain: string }[];
  language: Language;
  place?: Place;
}): GeneratedPrompt[] {
  const names = [a.siteName, ...a.rivals.flatMap((rival) => [rival.name, brandOf(rival.domain)])].filter((name) => clean(name).length > 1);
  const free = (text: string): boolean => text !== "" && !namesAnyOf(text, names, a.language);
  const questions = [...new Set(a.questions.map(clean))].filter(free).map((text) => ({ id: text, text }));
  const out: GeneratedPrompt[] = [];
  for (const text of [...new Set(a.searches.map((search) => clean(search).toLowerCase()))]) {
    if (out.length >= TRACKED_PROMPTS.PANEL) break;
    if (!free(text)) continue;
    const question = closestPrompt(text, questions)?.text;
    out.push({ kind: "search", text, ...(question === undefined ? {} : { question: askedIn(question, a.place) }) });
  }
  return out;
}
