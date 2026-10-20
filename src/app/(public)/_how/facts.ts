// SPEC §1 (2026-10-10, issue 1396) — every figure the public pages state
// about how the product works, read from the constants that run it.
//
// `/how-it-works`, `/about` and the landing's *What happens every day* fill
// their sentences' slots from here, so a figure is never typed into copy:
// change a constant and the page says the new number.
import {
  ADDS,
  BATTERY,
  CROSS_LINKS,
  MARKET_TERMS,
  PACE,
  RESEARCH,
  RIVAL_DEMAND,
  RIVAL_PRESENCE,
  TRACKED_PROMPTS,
  VETO,
  WEEK_PLAN,
} from "@/lib/config/constants";
import { HARD_RULES, type HardRule } from "@/lib/generate/rules/types";
import type { CopyKey } from "@/lib/presentation/copy";

/** The AI answers that are asked, by the name a buyer knows each by. As
 *  many as `TRACKED_PROMPTS.ENGINES`; a test holds the two equal. */
export const ENGINES_NAMED: CopyKey = "how.measure.engines";
export const ENGINES_NAMED_COUNT = 2;

/** The rules a model decides. Every other one is code. */
export const MODEL_DECIDED: readonly HardRule[] = ["fit_claim"];

/** The checks in plain words. Each rule belongs to one line, so a rule
 *  added to `HARD_RULES` does not compile until it is placed here. */
export const CHECK_LINES = ["sources", "invented", "honest", "hidden", "shape", "repeat"] as const;
export type CheckLine = (typeof CHECK_LINES)[number];

export const CHECK_LINE_OF: Readonly<Record<HardRule, CheckLine>> = {
  grounding: "sources",
  rival_source: "sources",
  rival_negative: "honest",
  traceable_numerals: "sources",
  cites_market: "sources",
  no_invented_people: "invented",
  no_unsourced_testimonial: "invented",
  no_invented_test: "invented",
  no_invented_provenance: "invented",
  honest_row: "honest",
  fit_claim: "honest",
  do_not_claim: "honest",
  no_hidden_text: "hidden",
  no_machine_address: "hidden",
  no_placeholder_cell: "hidden",
  no_demo_text: "hidden",
  first_block_answers: "shape",
  required_blocks: "shape",
  distinct_headings: "shape",
  title: "shape",
  plain_prose: "shape",
  near_duplicate: "repeat",
};

export const CHECK_LINE_COPY: Readonly<Record<CheckLine, CopyKey>> = {
  sources: "how.checks.sources",
  invented: "how.checks.invented",
  honest: "how.checks.honest",
  hidden: "how.checks.hidden",
  shape: "how.checks.shape",
  repeat: "how.checks.repeat",
};

/** How many of the rules stand behind one plain line. */
export function checksIn(line: CheckLine): number {
  return HARD_RULES.filter((rule) => CHECK_LINE_OF[rule] === line).length;
}

const prompts = Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0);

export const HOW_FACTS = Object.freeze({
  searches: BATTERY.QUESTIONS,
  prompts,
  runs: TRACKED_PROMPTS.RUNS,
  terms: MARKET_TERMS.MAX,
  rivals: BATTERY.COMPETITORS_MAX,
  rivalsHeld: RIVAL_PRESENCE.FIRST_PAGE_PLACES,
  rivalVolume: RIVAL_DEMAND.MIN_VOLUME,
  newPages: PACE.NEW_PAGES_PER_WEEK,
  weekPages: WEEK_PLAN.days,
  topResults: RESEARCH.topResults,
  researchRivals: RESEARCH.rivals,
  studies: RESEARCH.studies,
  statisticYears: RESEARCH.statisticMaxAgeYears,
  adds: ADDS.min,
  addsBusiness: ADDS.businessMin,
  checks: HARD_RULES.length,
  checksCoded: HARD_RULES.length - MODEL_DECIDED.length,
  siteLinksMin: CROSS_LINKS.SITE_MIN,
  siteLinksMax: CROSS_LINKS.SITE_MAX,
  backLinks: CROSS_LINKS.BACK_PAGES_MAX,
  clusterLinks: CROSS_LINKS.CLUSTER_PAGES_MAX,
  windowHours: VETO.defaultHours,
  windowMinDays: VETO.minDays,
  windowMaxDays: VETO.maxDays,
  /** The setup time the public pages state; setup's three steps take it. */
  setupMinutes: 10,
});
