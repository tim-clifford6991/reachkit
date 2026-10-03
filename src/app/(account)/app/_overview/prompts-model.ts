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

export interface PromptRow {
  id: string;
  kind: PromptKind;
  text: string;
  /** Answers read for it in the window, and how many named or linked the
   *  site. */
  answers: number;
  mentioned: number;
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
      readonly branded: MentionRate | null;
      readonly shareOfVoice: number | null;
      readonly rivals: PromptMeasure["rivals"];
      readonly pages: readonly CitedPageRow[];
      /** The set as the newest pass asked it, with each prompt's window. */
      readonly prompts: readonly PromptRow[];
      /** One point per week that asked, oldest first: that week's rate as
       *  a percentage, `null` where no unbranded answer was read. */
      readonly trend: readonly (number | null)[];
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

export function assemblePrompts(window: PromptWindow): PromptsModel {
  const samples = window.weeks.flatMap((week) => week.samples);
  const measure = measurePrompts(samples);
  if (measure.rate === null) return { kind: "none" };

  const prompts = window.prompts.map((prompt): PromptRow => {
    const own = samples.filter((sample) => sample.promptId === prompt.id);
    return {
      id: prompt.id,
      kind: prompt.kind,
      text: prompt.text,
      answers: own.length,
      mentioned: own.filter((sample) => sample.named || sample.linked).length,
    };
  });

  return {
    kind: "measured",
    rate: measure.rate,
    branded: measure.branded,
    shareOfVoice: measure.shareOfVoice,
    rivals: measure.rivals,
    pages: measure.pages.map((page) => ({ url: page.url, label: pathOf(page.url), answers: page.answers })),
    prompts,
    trend: window.weeks.map((week) => {
      const rate = measurePrompts(week.samples).rate;
      return rate === null ? null : percent(rate.rate);
    }),
  };
}
