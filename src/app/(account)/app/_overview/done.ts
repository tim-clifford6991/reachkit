// SPEC §4 (2026-10-10, issue 1395) — what ReachKit did, as stored rows say
// it: the eight steps of the process under Settings › Market.
//
// **This file is pure.** Facts in, steps out; reading the facts is
// `done-provider.ts`'s. Every number a step carries is a field of
// `DoneFacts`, which is a projection of rows another block wrote, or a pin
// in `@/lib/config/constants`. Nothing here counts, measures or words a
// number of its own. A read that could not answer is `undefined`, and its
// figure is not drawn.
import type { CopyKey } from "@/lib/presentation/copy";
import type { AnswerEngine } from "@/lib/opportunities/types";

/** One weekly pass, as its stored report counts it. */
export interface MeasuredFacts {
  /** The searches the pass looked up. */
  searches: number;
  /** The tracked prompts it asked; `0` where the pass asked none. */
  questions: number;
  /** The engines whose answers it stored, in the report's own order. */
  engines: readonly AnswerEngine[];
  at: Date;
}

export interface DoneFacts {
  /** The newest pass of any week — the process's own figure. */
  lastMeasured?: MeasuredFacts | null;
  /** The rivals the site tracks. `null`: no site row. */
  rivals?: number | null;
  /** The topics ready to fill a day. */
  ready?: number;
  /** The pages of the site the knowledge base was read from. */
  pagesRead?: number;
  /** The site's own publish time, as it is stored (`07:00`). */
  publishTime?: string | null;
  /** Whether a page could go live now. Unread is not a yes: no time is named. */
  goLive?: { connected: boolean; publishing: boolean; stopped: boolean };
  /** When the next weekly pass is due. */
  remeasureOn?: Date | null;
  /** How many checks a page is put through — `HARD_RULES`' length. */
  checks: number;
}

/** One sentence, as its key and the values its slots take. `when` slots are
 *  instants the renderer formats in the site's zone. */
export interface Sentence {
  key: CopyKey;
  vars?: Readonly<Record<string, string | number>>;
  /** Slots filled with an instant, formatted by the renderer. */
  at?: Readonly<Record<string, Date>>;
  /** A slot filled with engine names, joined by the renderer. */
  engines?: readonly AnswerEngine[];
}

export type ProcessStepId = "read" | "measure" | "rivals" | "pick" | "write" | "checks" | "publish" | "remeasure";

export interface ProcessStep {
  id: ProcessStepId;
  name: CopyKey;
  /** The customer's own figures, each with the screen it comes from. Empty
   *  for a step that states none. */
  figures: readonly (Sentence & { href: string | null })[];
  /** The step has a figure to state and it has not been read yet. */
  pending: boolean;
}

/** A time is named only where a page could go live: connected, switched on and not stopped (REQ-092 c7). */
function canGoLive(goLive: DoneFacts["goLive"]): boolean {
  return goLive !== undefined && goLive.connected && goLive.publishing && !goLive.stopped;
}

/** The eight steps, in order, each with what the stored rows say of it. */
export function processSteps(facts: DoneFacts): readonly ProcessStep[] {
  const pass = facts.lastMeasured ?? null;
  const step = (id: ProcessStepId, figures: ProcessStep["figures"], pending = figures.length === 0): ProcessStep => ({
    id,
    name: `overview.process.step.${id}`,
    figures,
    pending,
  });
  return [
    step("read", facts.pagesRead ? [{ key: "overview.process.figure.pages", vars: { n: facts.pagesRead }, href: "/app/settings" }] : []),
    step(
      "measure",
      pass === null
        ? []
        : [
            { key: "overview.process.figure.searches", vars: { n: pass.searches }, href: "/app/search" },
            ...(pass.questions > 0
              ? [{ key: "overview.process.figure.questions" as const, vars: { n: pass.questions }, href: "/app/ai-answers" }]
              : []),
          ]
    ),
    step("rivals", facts.rivals ? [{ key: "overview.process.figure.rivals", vars: { n: facts.rivals }, href: "/app/rivals" }] : []),
    step("pick", facts.ready === undefined ? [] : [{ key: "overview.process.figure.ready", vars: { n: facts.ready }, href: "/app/calendar" }]),
    // Writing states no figure of its own: what a page is written from is
    // on that page.
    step("write", [], false),
    step("checks", [{ key: "overview.process.figure.checks", vars: { n: facts.checks }, href: null }]),
    step(
      "publish",
      facts.publishTime && canGoLive(facts.goLive) ? [{ key: "overview.process.figure.publish", vars: { time: facts.publishTime }, href: "/app/settings/publishing" }] : [],
      false
    ),
    step(
      "remeasure",
      facts.remeasureOn ? [{ key: "overview.process.figure.remeasure", at: { on: facts.remeasureOn }, href: null }] : [],
      false
    ),
  ];
}
