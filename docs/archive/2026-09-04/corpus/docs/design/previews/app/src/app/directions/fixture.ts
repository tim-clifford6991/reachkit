/**
 * THE ONE FIXTURE. Every direction imports this module and nothing else for
 * data, so two directions can never disagree about a number.
 *
 * It adds no data. It re-exports `src/mock/data.ts` and DERIVES three things
 * from it that more than one direction needs — a joined market table, the
 * per-view state resolution, and the placeholder labels the walkthrough
 * already spends inline. Deriving a rank from values that are already in the
 * fixture is arithmetic, not a measurement (rule 1.2); inventing a rank
 * would be a measurement, and nothing here does that.
 *
 * COPY: not one customer-visible string is written here. `LABELS` below is a
 * gathering of placeholders the walkthrough screens already spend inline —
 * moved into one module so five directions spend the SAME placeholder rather
 * than five near-identical ones. Where a direction wanted a label nothing
 * approved provides, it reuses one of these and the gap is recorded in
 * `RECORDED_GAPS`, which the index route prints.
 */
import { MATRIX_ROWS, OVERVIEW, REPORT, RIVALS } from "@/mock/data";

export {
  CALENDAR,
  DESTINATIONS,
  GROWTH,
  GROWTH_GAPPED,
  MATRIX_ROWS,
  OVERVIEW,
  REPORT,
  RIVALS,
  SHELL,
  STAGES,
  WEEK,
  WHY_KEYS,
} from "@/mock/data";

/* ── the two screens' view states ────────────────────────────────────────
   Rule 7.3 asks every data view for loading, empty and error. Four states
   per screen, identical across all five directions, so a direction that
   only survives the happy path is visible as one.

   The walkthrough's `re-measuring` and `domain-changed` are NOT carried
   here. Both are refinements of `measured` that turn on one registered
   component's own gapped arm; they discriminate between token sets, not
   between structural archetypes, and carrying them across five directions
   would have cost more drawing than judgement. Recorded, not hidden. */
export const REPORT_VIEWS = ["report", "scanning", "degraded", "cooldown"] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

export const OVERVIEW_VIEWS = ["measured", "first-week", "failed", "empty-queue"] as const;
export type OverviewView = (typeof OVERVIEW_VIEWS)[number];

/* ── the market, joined ──────────────────────────────────────────────────
   §4.1 module 2 measures occupancy out of 12; §4.5 module 4 measures the
   gap as a multiple. They are the same set of names measured two ways, and
   every direction draws that set with a different technique. Joining them
   once here is what makes "the numbers are identical across directions" a
   property of the code rather than a promise. */
export const PRESENCE_MAX = 12;

export type MarketRow = {
  name: string;
  you: boolean;
  /** top-10 appearances out of PRESENCE_MAX — §4.1 module 2 */
  presence: number;
  /** the falling gap series — §4.5 module 4. Absent for a rival the
   *  overview does not track; absent is null, never zero. */
  series: readonly number[] | null;
  endpoint: string | null;
  was: string | null;
  first: number | null;
  last: number | null;
  /** cited / asked over the AI questions — derived from MATRIX_ROWS. A
   *  muted cell is a question with no AI answer at all and is NOT counted
   *  in the denominator (§6.2: never as a miss). */
  aiCited: number | null;
  aiAsked: number | null;
};

export const MARKET: readonly MarketRow[] = REPORT.presence.map((p) => {
  const rival = RIVALS.find((r) => r.name === p.name);
  const matrix = MATRIX_ROWS.find((m) => m.name === p.name);
  return {
    name: p.name,
    you: p.you,
    presence: p.value,
    series: rival ? rival.series : null,
    endpoint: rival ? rival.endpoint : null,
    was: rival ? rival.delta : null,
    first: rival ? rival.series[0] : null,
    last: rival ? rival.series[rival.series.length - 1] : null,
    aiCited: matrix ? matrix.cells.filter((c) => c.state === "cited").length : null,
    aiAsked: matrix ? matrix.cells.filter((c) => c.state !== "muted").length : null,
  };
});

/** The tracked rivals only — the rows §4.5 module 4 has a series for. */
export const TRACKED: readonly MarketRow[] = MARKET.filter((r) => r.series !== null);

/** The widest gap ever measured in the fixture: the shared scale every
 *  gap technique plots against, so a slope, a dumbbell and a bar all agree
 *  about how far along the axis `78×` sits. */
export const GAP_MAX = Math.max(...TRACKED.map((r) => r.first ?? 0));
export const GAP_WEEKS = TRACKED[0]?.series?.length ?? 0;

/* ── placeholders, gathered ──────────────────────────────────────────────
   Every one of these already appears verbatim in a walkthrough or variant
   screen. Nothing is new wording; the only change is that it now has one
   home (rule 2.4) instead of five. */
export const LABELS = {
  aiVerdict: "[AI-answers verdict — owner’s]",
  googleVerdict: "[Google-search verdict — owner’s]",
  twelveQuestions: "[the 12 questions — owner’s]",
  absentHead: "[5 biggest searches you are absent from — owner’s]",
  freePageEyebrow: "[free page eyebrow — owner’s]",
  pricingEyebrow: "[pricing eyebrow — owner’s]",
  chartDescription: "[chart description — owner’s]",
  moduleVerdict: "[module verdict — owner’s]",
  waitingFrame: "[waiting-frame line — owner’s]",
  /* The two the console direction's chrome needs and nothing approved
     provides. Written as bracketed placeholders in the app's own
     convention — a customer-visible string only the owner may write — and
     recorded in RECORDED_GAPS below. No copy is drafted for them here, not
     even as a suggestion. */
  commandLabel: "[command field label — owner’s]",
  commandPlaceholder: "[command placeholder — owner’s]",
} as const;

/** The three column heads §4.1 module 2 states verbatim. Transcribed, not
 *  chosen: "5 biggest searches you're absent from" table (search · /mo ·
 *  holds #1). */
export const ABSENT_COLUMNS = ["search", "/mo", "holds #1"] as const;

/* ── the gaps this exploration ran into ──────────────────────────────────
   Duty: a direction that needs a string nothing approved provides reuses an
   existing one and RECORDS the gap. These are those. None of them was
   answered by writing copy. */
export type RecordedGap = {
  where: string;
  needed: string;
  spent: string;
};

export const RECORDED_GAPS: readonly RecordedGap[] = [
  {
    where: "ranked · the board's column heads",
    needed:
      "A head for the occupancy column and the gap column. §4.1 states the absent table's three heads verbatim and states no head for the occupancy bars, because the bars are direct-labelled and need none.",
    spent:
      "LABELS.googleVerdict and OVERVIEW.rivalsLabel, reused as column heads. A board needs a head where a bar set does not — the gap is the board's, not the data's.",
  },
  {
    where: "console · the status column",
    needed:
      "A one-word state for each market row. STAGES holds five stage words, but they are a page's stages (REQ-043 c2), not a rival's state.",
    spent:
      "No word at all. The column carries a glyph and the row's own figure; nothing is captioned with a word nobody wrote.",
  },
  {
    where: "narrative · the section leads",
    needed:
      "One sentence per full-bleed section. This is the direction that most wants prose, and prose is exactly what a preview may not write (rule 7.3: filler copy in a preview is the defect).",
    spent:
      "The module label and the verdict placeholder already in the fixture, set at display size. Every narrative section is therefore short — which is an honest reading of the direction's cost, not a workaround.",
  },
  {
    where: "console · the command field",
    needed:
      "A label and a placeholder for the command field the direction's chrome is built on. Nothing approved names a command surface at all, because no approved artifact has one — §4.4 states a sidebar and top tabs and nothing else.",
    spent:
      "Two new bracketed placeholders, LABELS.commandLabel and LABELS.commandPlaceholder. They are the only two placeholders this exploration added, and they are added as HOLES, not as copy: adopting console means the owner writes two strings that do not exist yet.",
  },
  {
    where: "console · the problems and DIY regions",
    needed:
      "A region label for §4.1 module 3 and module 4. §4.1 gives both modules content and neither a title — a card whose left border is its severity does not need one; a labelled region does.",
    spent:
      "LABELS.moduleVerdict for the problems region and REPORT.methodChip for the DIY region — both existing strings, reused. The gap is the region's, not the data's.",
  },
  {
    where: "ledger · the table of contents",
    needed: "A name for each of the six report modules.",
    spent:
      "The module's own eyebrow where §4.1 gives one (the two source chips), and the section numeral alone where it does not.",
  },
];

/* ── per-view state resolution ───────────────────────────────────────────
   Resolved once, here, so five directions cannot disagree about what
   `degraded` means. A direction decides how a state LOOKS; it does not get
   to decide what the state IS. */
export type ReportState = {
  /** §4.1 states: score `null` renders as "—". */
  scoreText: string;
  /** Whether modules 2–6 render at all. Absent, never a skeleton. */
  showModules: boolean;
  degraded: boolean;
  scanning: boolean;
  cooldown: boolean;
  /** The one written line this state owes the reader, or null. */
  notice: string | null;
};

export function reportState(view: ReportView): ReportState {
  return {
    scoreText: view === "degraded" ? "—" : REPORT.score,
    showModules: view === "report" || view === "degraded",
    degraded: view === "degraded",
    scanning: view === "scanning",
    cooldown: view === "cooldown",
    notice:
      view === "cooldown"
        ? REPORT.cooldownLine
        : view === "degraded"
          ? REPORT.degradedLine
          : view === "scanning"
            ? LABELS.waitingFrame
            : null,
  };
}

export type OverviewState = {
  /** chart · none (no measurement yet) · failed (warn, never bad) */
  growth: "chart" | "none" | "failed";
  scoreState: "measured" | "unmeasured";
  pagesState: "measured" | "measured-zero";
  emptyQueue: boolean;
};

export function overviewState(view: OverviewView): OverviewState {
  return {
    growth: view === "first-week" ? "none" : view === "failed" ? "failed" : "chart",
    scoreState: view === "first-week" ? "unmeasured" : "measured",
    pagesState: view === "first-week" ? "measured-zero" : "measured",
    emptyQueue: view === "empty-queue",
  };
}

/** Rule 7.3: one primary action per screen, named so it is checkable by
 *  looking. The same two actions in every direction — a direction changes
 *  where the action sits, never which action is primary. §4.2 makes the
 *  giveaway the trade the report is built around; the €49 start is drawn
 *  as the secondary everywhere. */
export const PRIMARY_ACTION = {
  report: REPORT.freePage.cta,
  overview: OVERVIEW.alerts[0].action,
} as const;
