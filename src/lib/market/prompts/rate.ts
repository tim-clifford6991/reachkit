// src/lib/market/prompts/rate.ts — the AI mention rate, its margin, share
// of voice and the pages cited (SPEC §4 D22 and §6 D19, #1162).
//
// The rate is answers that name or link the site over answers read, on the
// unbranded prompts: a prompt that names the site is answered about the
// site, so the two branded prompts are counted apart. The margin is
// Wilson's 95% interval, which stays honest at 0 of 92 where a ± would say
// "0% ± 0". Share of voice is the site's mentions over its own and its
// rivals' together.
//
// Pure: no I/O.
import type { PromptKind } from "./generate";

export interface PromptSample {
  promptId: string;
  kind: PromptKind;
  named: boolean;
  linked: boolean;
  ownUrls: readonly string[];
  rivals: readonly string[];
}

/** One weekly pass's answers, as the rolling window reads them. */
export interface PromptWeek {
  weekStart: string;
  /** How many asks the week's set was, answered or not. */
  asks: number;
  samples: readonly PromptSample[];
}

/** The rolling window: declared here, beside the measure, so a screen can
 *  name it without an edge into the scan runner. */
export interface PromptWindow {
  /** The weeks that asked prompts, oldest first. */
  weeks: readonly PromptWeek[];
  /** The set as the newest of those weeks asked it. */
  prompts: readonly { id: string; kind: PromptKind; text: string }[];
  /** D64 (issue 1301): no pass in the window passed its own health checks,
   *  so the one week here is the newest pass as it was measured, shown as a
   *  first measurement rather than as nothing. */
  firstMeasurement?: true;
}

export interface MentionRate {
  /** Answers read. */
  samples: number;
  /** Answers that linked a page of the site. */
  linked: number;
  /** Answers that named the site without linking it. */
  named: number;
  /** 0–1. */
  rate: number;
  low: number;
  high: number;
}

const Z95 = 1.959964;

/** Wilson's score interval for `hits` of `n`, as fractions. */
export function wilson(hits: number, n: number): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = hits / n;
  const z2 = Z95 * Z95;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

function rateOf(samples: readonly PromptSample[]): MentionRate | null {
  if (samples.length === 0) return null;
  const linked = samples.filter((s) => s.linked).length;
  const named = samples.filter((s) => s.named && !s.linked).length;
  const hits = linked + named;
  return { samples: samples.length, linked, named, rate: hits / samples.length, ...wilson(hits, samples.length) };
}

export interface CitedPage {
  url: string;
  /** How many answers cited it. */
  answers: number;
  /** The prompts whose answers cited it. */
  promptIds: readonly string[];
}

export interface PromptMeasure {
  /** `null` where no unbranded answer was read. */
  rate: MentionRate | null;
  /** The branded prompts, apart. `null` where none was read. */
  branded: MentionRate | null;
  /** The site's mentions over its own and its rivals', 0–1. `null` where
   *  no answer named either. */
  shareOfVoice: number | null;
  /** The rivals by how many answers named them, most first. */
  rivals: readonly { domain: string; answers: number }[];
  /** The site's own pages any answer cited, most cited first. */
  pages: readonly CitedPage[];
}

export function measurePrompts(samples: readonly PromptSample[]): PromptMeasure {
  const unbranded = samples.filter((s) => s.kind !== "branded");
  const rate = rateOf(unbranded);

  const byRival = new Map<string, number>();
  for (const sample of unbranded) {
    for (const domain of sample.rivals) byRival.set(domain, (byRival.get(domain) ?? 0) + 1);
  }
  const rivals = [...byRival.entries()]
    .map(([domain, answers]) => ({ domain, answers }))
    .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain));
  const ours = rate === null ? 0 : rate.linked + rate.named;
  const theirs = rivals.reduce((sum, r) => sum + r.answers, 0);

  const byPage = new Map<string, { answers: number; prompts: Set<string> }>();
  for (const sample of samples) {
    for (const url of sample.ownUrls) {
      const held = byPage.get(url) ?? { answers: 0, prompts: new Set<string>() };
      held.answers += 1;
      held.prompts.add(sample.promptId);
      byPage.set(url, held);
    }
  }
  const pages = [...byPage.entries()]
    .map(([url, held]) => ({ url, answers: held.answers, promptIds: [...held.prompts] }))
    .sort((a, b) => b.answers - a.answers || a.url.localeCompare(b.url));

  return {
    rate,
    branded: rateOf(samples.filter((s) => s.kind === "branded")),
    shareOfVoice: ours + theirs === 0 ? null : ours / (ours + theirs),
    rivals,
    pages,
  };
}
