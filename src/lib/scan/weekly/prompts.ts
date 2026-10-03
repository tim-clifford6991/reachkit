// SPEC §4 (D22) · §6 (D19, #1162) — the tracked prompts' rolling window,
// read from stored weekly passes. It measures nothing and buys nothing.
//
// One read for the window, never one per week. A week whose pass stored no
// prompts section is absent, not empty: an empty week would lower the rate
// as though its prompts had been asked and every answer ignored the site.
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import type { PromptSample, PromptWeek, PromptWindow } from "@/lib/market/prompts/rate";
import type { PromptsSection } from "../report";
import { previousWeekStart } from "./movement";
import { readWeekScans } from "./store";

/** One stored section as samples: each answer beside its prompt's kind. An
 *  answer whose prompt has since left the stored set is left out. */
export function samplesOf(section: PromptsSection): PromptSample[] {
  const kinds = new Map(section.asked.map((prompt) => [prompt.id, prompt.kind]));
  const samples: PromptSample[] = [];
  for (const answer of section.answers) {
    const kind = kinds.get(answer.promptId);
    if (kind === undefined) continue;
    samples.push({
      promptId: answer.promptId,
      kind,
      named: answer.named,
      linked: answer.linked,
      ownUrls: answer.ownUrls,
      rivals: answer.rivals,
    });
  }
  return samples;
}

/** The window's Mondays ending at `weekStart`, oldest first. */
export function promptWindowWeeks(weekStart: string): string[] {
  const weeks = [weekStart];
  for (let back = 1; back < ANSWER_RATE_WEEKS; back += 1) weeks.unshift(previousWeekStart(weeks[0] as string));
  return weeks;
}

export async function readPromptWindow(a: { siteId: string; weekStart: string }): Promise<PromptWindow> {
  const weekStarts = promptWindowWeeks(a.weekStart);
  const scans = await readWeekScans({ siteId: a.siteId, weekStarts });
  const weeks: PromptWeek[] = [];
  let prompts: PromptWindow["prompts"] = [];
  for (const weekStart of weekStarts) {
    const section = scans.get(weekStart)?.report?.prompts;
    if (section === undefined) continue;
    weeks.push({ weekStart, asks: section.asks, samples: samplesOf(section) });
    prompts = section.asked;
  }
  return { weeks, prompts };
}
