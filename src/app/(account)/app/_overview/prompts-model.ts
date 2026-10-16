// SPEC §4 (D22) · §6 (D19, #1162) — the AI mention rate, in one shape.
//
// The rate over the tracked buyer prompts, its 95% range, share of voice
// against the site's rivals and the site's own pages cited, over the
// rolling four weeks. Never an AI position and never sentiment: neither
// has a member here.
//
// **This file is pure.** Facts in, model out. Reading the facts is
// `prompts-provider.ts`'s.
import { measurePrompts, type MentionRate, type PromptMeasure, type PromptWindow } from "@/lib/market/prompts/rate";
import type { PromptKind } from "@/lib/market/prompts/generate";
import { MENTION_RATE_MIN_WEEKS } from "@/lib/config/constants";

export interface PromptRow {
  id: string;
  kind: PromptKind;
  text: string;
  /** Answers read for it in the window, how many named or linked the
   *  site, and how many linked it. */
  answers: number;
  mentioned: number;
  linked: number;
}

export interface CitedPageRow {
  url: string;
  label: string;
  answers: number;
}

export type PromptsModel =
  /** No weekly pass has asked the prompts yet, or none of their answers
   *  could be read. The screens keep what they showed before. */
  | { readonly kind: "none" }
  | {
      readonly kind: "measured";
      readonly rate: MentionRate;
      /** D58 (issue 1287): whether the rate may be shown as a rate. False
       *  until `MENTION_RATE_MIN_WEEKS` weeks of the current prompt set
       *  exist; the count and its sample are shown until then. */
      readonly rateShown: boolean;
      /** D64: the newest pass, shown because no healthy pass exists yet. */
      readonly firstMeasurement: boolean;
      readonly branded: MentionRate | null;
      readonly shareOfVoice: number | null;
      readonly rivals: PromptMeasure["rivals"];
      readonly pages: readonly CitedPageRow[];
      /** The set as the newest pass asked it, with each prompt's window. */
      readonly prompts: readonly PromptRow[];
      /** One point per week that asked, oldest first: that week's rate as
       *  a percentage, `null` where no unbranded answer was read. */
      readonly trend: readonly (number | null)[];
      /** The same counts as `aiSearchesOf`, over the window that ended the
       *  week before — what the AI tile's change is taken against. `null`
       *  where that window held no answer. */
      readonly previous: { readonly mentioned: number; readonly linked: number } | null;
    };

/** A fraction as a whole percentage. */
export function percent(fraction: number): number {
  return Math.round(fraction * 100);
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** D58: a rate is shown once the window holds enough weeks of the set the
 *  newest pass asked. The window already holds that set's weeks alone. */
export function rateShown(window: Pick<PromptWindow, "weeks">): boolean {
  return window.weeks.length >= MENTION_RATE_MIN_WEEKS;
}

function promptRows(window: PromptWindow, prompts: PromptWindow["prompts"]): PromptRow[] {
  const samples = window.weeks.flatMap((week) => week.samples);
  return prompts.map((prompt): PromptRow => {
    const own = samples.filter((sample) => sample.promptId === prompt.id);
    return {
      id: prompt.id,
      kind: prompt.kind,
      text: prompt.text,
      answers: own.length,
      mentioned: own.filter((sample) => sample.named || sample.linked).length,
      linked: own.filter((sample) => sample.linked).length,
    };
  });
}

/** The AI tile's searches (issue 1457): the tracked prompts that are not
 *  the site's own name, those whose answers in the window mention the site,
 *  and those whose answers link it. One selector: the tile counts these
 *  rows and the AI tab's list marks exactly them. */
export function aiSearchesOf(prompts: readonly PromptRow[]): {
  asked: readonly PromptRow[];
  mentioned: readonly PromptRow[];
  linked: readonly PromptRow[];
} {
  const asked = prompts.filter((prompt) => prompt.kind !== "branded");
  return {
    asked,
    mentioned: asked.filter((prompt) => prompt.mentioned > 0),
    linked: asked.filter((prompt) => prompt.linked > 0),
  };
}

/**
 * `previous` is the window that ended the week before the newest week of
 * `window`, read the same way; the counts are over the newest set's prompts
 * alone, so a change is never a change of set.
 */
export function assemblePrompts(window: PromptWindow, previous?: PromptWindow): PromptsModel {
  const samples = window.weeks.flatMap((week) => week.samples);
  const measure = measurePrompts(samples);
  if (measure.rate === null) return { kind: "none" };

  const prompts = promptRows(window, window.prompts);
  const before =
    previous === undefined || previous.weeks.every((week) => week.samples.length === 0)
      ? null
      : aiSearchesOf(promptRows(previous, window.prompts));

  return {
    kind: "measured",
    rate: measure.rate,
    rateShown: rateShown(window),
    firstMeasurement: window.firstMeasurement === true,
    branded: measure.branded,
    shareOfVoice: measure.shareOfVoice,
    rivals: measure.rivals,
    pages: measure.pages.map((page) => ({ url: page.url, label: pathOf(page.url), answers: page.answers })),
    prompts,
    trend: window.weeks.map((week) => {
      const rate = measurePrompts(week.samples).rate;
      return rate === null ? null : percent(rate.rate);
    }),
    previous: before === null ? null : { mentioned: before.mentioned.length, linked: before.linked.length },
  };
}
