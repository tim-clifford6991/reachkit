// SPEC §4 (2026-10-10, issue 1395) — what ReachKit did, as stored rows say
// it: the week's work on Overview, and the eight steps of the process.
//
// **This file is pure.** Facts in, lines out; reading the facts is
// `done-provider.ts`'s. Every number a line carries is a field of
// `DoneFacts`, which is a projection of rows another block wrote, or a pin
// in `@/lib/config/constants`. Nothing here counts, measures or words a
// number of its own.
//
// **Three answers, kept apart.** A step that ran is its figures. A step
// the week's rows show did not run is `null` on a field whose read
// answered, and the line says *not measured this week*. A read that could
// not answer is `undefined`, and the line is not drawn: the screen does not
// say "not measured" about a row it failed to look at.
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

/** The topics on file that fill no day, by the stored reason. */
export interface SetAside {
  covered: number;
  tooHard: number;
  lowFit: number;
  resting: number;
}

export interface DoneFacts {
  /** This week's pass. `null`: none has run this week. */
  measured?: MeasuredFacts | null;
  /** The newest pass of any week — the process's own figure. */
  lastMeasured?: MeasuredFacts | null;
  /** The rivals the site tracks. `null`: no site row. */
  rivals?: number | null;
  /** The pages written this week. */
  wrote?: {
    pages: number;
    fresh: number;
    updated: number;
    /** How many the recorded checks held. `null` where a page carries no
     *  record of its checks, and the line then says nothing about them. */
    held: number | null;
  };
  /** The pages that went live this week. */
  published?: number;
  /** When the next page goes live on its own, where one will: the shell's
   *  own next publish, handed in by the screen so the line and the head
   *  above it cannot name two times. */
  nextLiveAt?: Date | null;
  setAside?: SetAside;
  /** The topics ready to fill a day. */
  ready?: number;
  /** The pages of the site the knowledge base was read from. */
  pagesRead?: number;
  /** The site's own publish time, as it is stored (`07:00`). */
  publishTime?: string | null;
  /** When the next weekly pass is due. */
  remeasureOn?: Date | null;
  /** How many checks a page is put through — `HARD_RULES`' length. */
  checks: number;
}

export function setAsideTotal(s: SetAside): number {
  return s.covered + s.tooHard + s.lowFit + s.resting;
}

/** The rows of a set-aside count, largest reason first where they tie on
 *  nothing: the stored order. A reason with no topic draws no row. */
export function setAsideRows(s: SetAside): readonly { key: CopyKey; n: number }[] {
  const rows: readonly { key: CopyKey; n: number }[] = [
    { key: "draft.set-aside.covered", n: s.covered },
    { key: "draft.set-aside.too-hard", n: s.tooHard },
    { key: "draft.set-aside.low-fit", n: s.lowFit },
    { key: "draft.set-aside.resting", n: s.resting },
  ];
  return rows.filter((row) => row.n > 0);
}

export type DoneLineId = "measured" | "rivals" | "wrote" | "published" | "set-aside";

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

export interface DoneLine {
  id: DoneLineId;
  /** Whether the step ran: a tick, or a dash for one that did not. */
  ran: boolean;
  /** The line's parts, joined with a middle dot. */
  parts: readonly Sentence[];
  /** The closed note under it: one sentence, or the set-aside rows. */
  note: Sentence | null;
  rows?: readonly { key: CopyKey; n: number }[];
}

function measuredLine(measured: MeasuredFacts | null): DoneLine {
  if (measured === null) {
    return { id: "measured", ran: false, parts: [{ key: "overview.done.measured.none" }], note: { key: "overview.done.measured.note" } };
  }
  const asked = measured.questions > 0 && measured.engines.length > 0;
  return {
    id: "measured",
    ran: true,
    parts: [
      asked
        ? {
            key: "overview.done.measured",
            vars: { searches: measured.searches, questions: measured.questions },
            engines: measured.engines,
            at: { at: measured.at },
          }
        : { key: "overview.done.measured.searches", vars: { searches: measured.searches }, at: { at: measured.at } },
    ],
    note: { key: "overview.done.measured.note" },
  };
}

/** The week's lines, in the order the work happens. */
export function doneLines(facts: DoneFacts): readonly DoneLine[] {
  const lines: DoneLine[] = [];
  if (facts.measured !== undefined) lines.push(measuredLine(facts.measured));
  if (facts.rivals !== undefined) {
    lines.push(
      facts.rivals === null
        ? { id: "rivals", ran: false, parts: [{ key: "overview.done.rivals.none" }], note: { key: "overview.done.rivals.note" } }
        : { id: "rivals", ran: true, parts: [{ key: "overview.done.rivals", vars: { n: facts.rivals } }], note: { key: "overview.done.rivals.note" } }
    );
  }
  if (facts.wrote !== undefined) {
    const { pages, fresh, updated, held } = facts.wrote;
    const note: Sentence = { key: "overview.done.wrote.note", vars: { checks: facts.checks } };
    if (pages === 0) {
      lines.push({ id: "wrote", ran: false, parts: [{ key: "overview.done.wrote.none" }], note });
    } else {
      const parts: Sentence[] = [{ key: "overview.done.wrote", vars: { pages, fresh, updated } }];
      if (held === 0) parts.push({ key: "overview.done.wrote.passed", vars: { checks: facts.checks } });
      else if (held !== null) parts.push({ key: "overview.done.wrote.held", vars: { held } });
      lines.push({ id: "wrote", ran: true, parts, note });
    }
  }
  if (facts.published !== undefined) {
    const parts: Sentence[] =
      facts.published === 0
        ? [{ key: "overview.done.published.none" }]
        : [{ key: "overview.done.published", vars: { n: facts.published } }];
    if (facts.nextLiveAt != null) parts.push({ key: "overview.done.published.next", at: { when: facts.nextLiveAt } });
    lines.push({ id: "published", ran: facts.published > 0, parts, note: { key: "overview.done.published.note" } });
  }
  if (facts.setAside !== undefined && setAsideTotal(facts.setAside) > 0) {
    lines.push({
      id: "set-aside",
      ran: false,
      parts: [{ key: "overview.done.set-aside", vars: { n: setAsideTotal(facts.setAside) } }],
      note: null,
      rows: setAsideRows(facts.setAside),
    });
  }
  return lines;
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
      facts.publishTime ? [{ key: "overview.process.figure.publish", vars: { time: facts.publishTime }, href: "/app/settings/publishing" }] : [],
      false
    ),
    step(
      "remeasure",
      facts.remeasureOn ? [{ key: "overview.process.figure.remeasure", at: { on: facts.remeasureOn }, href: null }] : [],
      false
    ),
  ];
}
