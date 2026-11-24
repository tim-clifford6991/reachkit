// BUILD §8 · SPEC §7 (D41 stage 4) — the stage-4 checks.
//
// §8's rules are "enforced in code, not prompts", and this is the one place
// they are all run: the five checks of D41, the guards D27 names and the
// prose check of issue 1390, every one a deterministic pass over finished
// text that costs nothing. The
// never-claim list is matched by its own words (D45). One rule is a model's:
// the fit check, kept by D44 for a listicle or comparison only (about 0.5¢).
//
// **Every rule runs, and the failure list carries all of them** — not the
// first. The one fix call is told every check the page failed.
//
// **An unrun fit check fails every business sentence.** "We could not check"
// is never a pass, and never a stop of its own: the fit drop removes them.
//
// The order is `HARD_RULES`' order, so a failure list is comparable across
// runs.
import type { CostContext } from "@/lib/costs";
import { claimCheck } from "../claims/check";
import type { ClaimVerdict } from "../claims/check";
import {
  checkFirstBlockAnswers,
  checkInventedProvenance,
  checkInventedTest,
  checkTraceableNumerals,
  poolPassages,
  type BriefRuleInputs,
} from "./brief";
import { checkRequiredBlocks, type BlockRuleInputs } from "./blocks";
import { checkCitesMarket, type CitesRuleInputs } from "./cites";
import { checkPlaceholderCell } from "./cells";
import { checkDemoText } from "./demo";
import { brandSentences, fitCheck, type FitVerdict } from "../claims/fit";
import type { PromptKnowledge } from "../voice/profile-block";
import { checkDistinctHeadings } from "./headings";
import { checkHonestRow, checkSelfRanked } from "./honest";
import { checkGrounding } from "./grounding";
import { checkHiddenText, checkMachineAddress } from "./hidden";
import { checkNearDuplicate } from "./nearduplicate";
import { checkInventedPeople, checkUnsourcedTestimonial } from "./people";
import { checkProse, proseText, type ProseRuleInputs } from "./prose";
import { checkRivalNegative, checkRivalScope, checkRivalSource, namedRivals, type NamedRival } from "./rivals";
import { renderOf, withoutReferenceLists } from "./text";
import { checkStandaloneLead } from "./standalone";
import { checkTitle, titleFigures, type TitleRuleInputs } from "./title";
import { stops } from "../record";
import { HARD_RULES, SWITCHED_RULES } from "./types";
import type { ComparisonSet, GroundedFact, HardRule, ModelRule, RuleFailure, SiteRuleInputs } from "./types";
import type { PageType } from "@/lib/opportunities/types";

/** `fit` is the fit verdict the page is held to, carried beside the claim
 *  check's: an unrun check is read as failed on every business sentence.
 *  `failed` holds the warnings too; `passed` reads only the failures that
 *  stop the page. */
export interface BatteryOutcome {
  passed: boolean;
  asked: HardRule[];
  failed: RuleFailure[];
  claim: ClaimVerdict;
  fit: FitVerdict;
}

/**
 * The rules this run asked of the page, in `HARD_RULES` order (issue 1394).
 *
 * A switched rule left off returns no failure, and that is not a pass: the
 * draft screen draws a pass only for a rule named here. Each condition is
 * the input its own check asks nothing without.
 */
export function rulesAsked(a: RuleSwitches, verdicts: { fit: FitVerdict; fitAsked: boolean }): HardRule[] {
  const on: Record<string, boolean> = {
    required_blocks: a.blocks != null,
    distinct_headings: a.distinctHeadings === true,
    fit_claim: verdicts.fitAsked && verdicts.fit.state !== "unrun",
    do_not_claim: a.site.doNotClaim.length > 0 || (a.demoPhrases ?? []).length > 0,
    // An update is asked its description's figures alone (issue 1507).
    title: a.titleRule != null,
    plain_prose: a.prose != null,
    cites_market: a.cites != null,
    standalone_lead: a.prose != null,
  };
  return HARD_RULES.filter((rule) => !SWITCHED_RULES.includes(rule) || on[rule] === true);
}

/** Whether the battery both ran in full and found nothing: the one answer
 *  that lets a page move toward review. */
export function batteryCleared(outcome: BatteryOutcome): boolean {
  return outcome.passed && outcome.claim.state === "passed" && outcome.fit.state === "passed";
}

/** Observability: which rules failed and the duplicated ref. **Never** the
 *  draft body, the grounded passage, or a list entry. */
function logBattery(a: { failed: readonly RuleFailure[]; claimState: string; fitState: string }): void {
  console.log(
    JSON.stringify({
      event: "hard_rules_ran",
      failed: a.failed.map((failure) => failure.rule),
      claim: a.claimState,
      fit: a.fitState,
    })
  );
}

/** What `rulesAsked` reads: whether each switch's input is handed over, so the writer is told the same rules
 *  (`./brief-lines.ts`, issue 2378). */
export type RuleSwitches = Pick<DeterministicInputs, "pageType" | "demoPhrases" | "distinctHeadings"> & {
  site: { doNotClaim: readonly string[] };
  blocks?: unknown;
  titleRule?: unknown;
  prose?: unknown;
  cites?: unknown;
};

/** Everything the deterministic rules read. */
export interface DeterministicInputs {
  /** The writer's words, before code lays out its table, sources, closing and links: what every rule reads but the
   *  page-level ones. */
  markdown: string;
  /** The page as code laid it out, where it differs: what the page-level rules read (unsafe markup, a near duplicate,
   *  its blocks). Absent, they read `markdown`. */
  laid?: string;
  /** The title as written. The honest row and the fit check read it: a
   *  title is the first place a page says what the business is. */
  title: string;
  /** What a reader of the published page meets: `laid` rendered. */
  rendered: string;
  /** The page's type (SPEC §7, issue 1136): a market comparison's table is
   *  held to the business's own row, and its words to no self-ranked "#1".
   *  `null` where the page has none — an Improve page, or a caller that
   *  holds no row — and then neither is read. */
  pageType: PageType | null;
  site: SiteRuleInputs;
  comparison: ComparisonSet;
  grounded: GroundedFact | null;
  /** The rendered text of the customer's own page the grounded fact was
   *  drawn from, as the measurement read it on that fact's read date. The
   *  grounding rule has no other source and no fallback. */
  sourceText: string;
  /** What the brief handed the model — rules 8–12 read nothing else. */
  brief: BriefRuleInputs;
  /** The customer's own pages the business facts were read from: with the
   *  market facts' pages, what a rival's figure may be sourced to (issue
   *  1135). */
  factPages?: readonly string[];
  /** The site's demo phrases and menu lines (issue 1249). Absent, the
   *  demo-text check asks nothing. */
  demoPhrases?: readonly string[];
  /** What the page's structure is held to (issue 1137). Passed only for a
   *  page this product generated; absent, `required_blocks` asks nothing. */
  blocks?: BlockRuleInputs;
  /** Whether the page's H2s must differ (D61, issue 1295). Passed only for
   *  a Q&A this product generated; absent, `distinct_headings` asks nothing. */
  distinctHeadings?: boolean;
  /** What the `<title>` is held to (D51, issue 1266). Passed only for a
   *  page this product generated; absent, `title` asks nothing. */
  titleRule?: TitleRuleInputs;
  /** The page's H1 where it is not its title. The honest row and the
   *  never-claim list read it beside the title. */
  heading?: string;
  /** The site's rivals with the names its market gives them (issue 1485):
   *  what the rival rules recognise beside the domains. Absent, each is
   *  named by its domain alone. */
  rivalsNamed?: readonly NamedRival[];
  /** What the page's wording is held to (issue 1390). Passed only for a
   *  page this product generated; absent, `plain_prose` asks nothing — a
   *  founder's own words are theirs. */
  prose?: ProseRuleInputs;
  /** What the page must cite (issue 1486). Passed only for a generated page
   *  whose type is built from outside facts; absent, `cites_market` asks
   *  nothing. */
  cites?: CitesRuleInputs;
}

/**
 * The deterministic arms, keyed by the rule they answer for. No
 * model and no I/O, so the same call re-measures a stored draft
 * (`scripts/eval-content/rules.ts`, issue 1187).
 *
 * **Total, not partial** (issue #424). A rule with no arm here would be
 * read as one that failed nothing — by the battery's loop, which is how
 * `passed` is decided, and by the record the draft view's Checks list is
 * drawn from. Spelling them as a total record makes an undecided rule
 * a compile error rather than a pass the product hands out for free.
 */
export function runDeterministicRules(
  given: DeterministicInputs
): Record<Exclude<HardRule, ModelRule>, RuleFailure | null> {
  const a = withoutSources(given);
  // The H1 is a heading of the page: read as its first one.
  const headed = a.heading === undefined || a.heading === a.title ? a.markdown : `# ${a.heading}\n\n${a.markdown}`;
  const honest = { title: a.title, markdown: headed, businessName: a.site.businessName, domain: a.site.domain, pageType: a.pageType };
  return {
    grounding: checkGrounding({ grounded: a.grounded, sourceText: a.sourceText }),
    rival_claim:
      checkRivalSource({
        markdown: a.markdown,
        rivals: a.site.rivals,
        ...(a.brief.marketFacts === undefined
          ? {}
          : { factPages: [...(a.factPages ?? []), ...a.brief.marketFacts.map((fact) => fact.url)] }),
      }) ??
      checkRivalScope({ markdown: a.markdown, rivals: rivals(a), facts: a.brief.marketFacts }) ??
      checkRivalNegative({ markdown: a.markdown, faq: a.blocks?.faq ?? [], rivals: rivals(a), facts: a.brief.marketFacts }),
    // A self-ranked "#1" first: the fix note names its sentences only when it is the kind recorded.
    nothing_invented:
      checkSelfRanked(honest) ??
      checkInventedPeople({ markdown: a.markdown, businessName: a.site.businessName }) ??
      checkUnsourcedTestimonial({
        markdown: a.markdown,
        ...(a.brief.marketFacts === undefined ? {} : { quotable: poolPassages(a.brief) }),
      }) ??
      checkInventedTest({ markdown: a.markdown, brief: a.brief }) ??
      checkInventedProvenance({ markdown: a.markdown, brief: a.brief }),
    unsafe_markup: checkHiddenText({ markdown: a.laid ?? a.markdown }) ?? checkMachineAddress({ rendered: a.rendered }),
    near_duplicate: checkNearDuplicate({ rendered: a.rendered, comparison: a.comparison }),
    traceable_numerals: checkTraceableNumerals({ markdown: a.markdown, brief: a.brief }) ?? titleFigure(a),
    first_block_answers: checkFirstBlockAnswers({ markdown: a.markdown }),
    required_blocks:
      checkRequiredBlocks({ markdown: a.laid ?? a.markdown, title: a.title, blocks: a.blocks ?? null }) ??
      (a.blocks == null ? null : checkHonestRow({ ...honest, rivals: a.site.rivals })),
    no_placeholder_cell: checkPlaceholderCell({ markdown: a.markdown }),
    distinct_headings: checkDistinctHeadings({ markdown: a.markdown, apply: a.distinctHeadings === true }),
    title: checkTitle({ title: a.title, ...(a.heading === undefined ? {} : { heading: a.heading }), rule: a.titleRule ?? null }),
    plain_prose: checkProse({ markdown: a.markdown, prose: a.prose ?? null }),
    cites_market: checkCitesMarket({ markdown: a.markdown, cites: a.cites ?? null }),
    standalone_lead: checkStandaloneLead({ markdown: a.markdown, language: a.prose?.language ?? null }),
  };
}

/** A figure the title or its description states that no source holds (issue 1507). */
function titleFigure(a: DeterministicInputs): RuleFailure | null {
  const figure = a.titleRule == null ? undefined : titleFigures(a.title, a.titleRule, a.markdown)[0]?.figure;
  return figure === undefined ? null : { rule: "traceable_numerals", detail: { rule: "traceable_numerals", figure } };
}

function rivals(a: DeterministicInputs): readonly NamedRival[] {
  return a.rivalsNamed ?? namedRivals(a.site.rivals, null);
}

/** The sources list is code's, not the page's own words (issue 1135): the
 *  rules read the page without it. */
function withoutSources(given: DeterministicInputs): DeterministicInputs {
  const markdown = withoutReferenceLists(given.markdown);
  const laid = given.laid === undefined ? undefined : withoutReferenceLists(given.laid);
  if (markdown === given.markdown && laid === given.laid) return given;
  return { ...given, markdown, ...(laid === undefined ? {} : { laid }), rendered: renderOf(laid ?? markdown) };
}

export async function runHardRules(
  c: CostContext,
  given: DeterministicInputs & {
    /** The knowledge base the fit check judges against (D44). Passed only
     *  for a generated listicle or comparison: every other type skips the
     *  check, and so does a founder's own edit — what a founder writes of
     *  their business is the founder's word. */
    knowledge?: PromptKnowledge;
    /** The fit verdict an earlier read of this page reached, where the text
     *  has only been repaired in code since: the one model check is not
     *  bought twice for one page as written. */
    fit?: FitVerdict;
    /** The site's market in force, which the fit check reads beside the
     *  knowledge base. */
    market?: unknown;
  }
): Promise<BatteryOutcome> {
  const read = withoutSources(given);
  // Issue 1390: an English page is also read by `slopless`. Loaded here and
  // nowhere at import, so no browser bundle carries a linter.
  const prose =
    read.prose === undefined || read.prose.language !== "en" || read.prose.flagged !== undefined
      ? read.prose
      : { ...read.prose, flagged: await (await import("./prose-lint")).lintProse(proseText(read.markdown, read.prose.passages)) };
  const a = { ...read, ...(prose === undefined ? {} : { prose }), knowledge: given.knowledge };
  // Assembled in `HARD_RULES` order below rather than in whatever order the
  // calls happen to be written in.
  const deterministic = runDeterministicRules(a);

  // The last two, each owning its own judgement; this file holds no second
  // implementation of either.
  const asking = {
    title: a.title,
    markdown: a.markdown,
    businessName: a.site.businessName,
    domain: a.site.domain,
    titleOwed: (a.titleRule?.business?.length ?? 0) > 0,
    ...(a.prose === undefined ? {} : { language: a.prose.language }),
    ...(a.brief.marketFacts === undefined ? {} : { claims: a.brief.marketFacts }),
  };
  const verdict = given.fit ?? await fitCheck(c, { ...asking, knowledge: a.knowledge, market: given.market });
  // A business sentence the check could not read is never kept as if it had passed.
  const unread = verdict.state === "unrun" ? brandSentences(asking) : [];
  const fit: FitVerdict = verdict.state !== "unrun" ? verdict : unread.length === 0 ? { state: "passed" } : { state: "failed", sentences: unread };
  // D45: a literal match of the list's own words, in the title and the body.
  const claim = claimCheck({ text: [a.title, ...(a.heading === undefined ? [] : [a.heading]), a.markdown].join("\n"), list: a.site.doNotClaim });
  // The site's demo text and the facts the customer switched off are the same no, by whole sentence.
  const demo = checkDemoText({ markdown: a.markdown, phrases: a.demoPhrases });

  const failed: RuleFailure[] = [];
  for (const rule of HARD_RULES) {
    if (rule === "do_not_claim") {
      if (claim.state === "failed") failed.push({ rule: "do_not_claim", detail: { rule: "do_not_claim", matchedEntry: claim.matchedEntry } });
      else if (demo !== null) failed.push(demo);
      continue;
    }
    if (rule === "fit_claim") {
      if (fit.state === "failed") {
        failed.push({ rule: "fit_claim", detail: { rule: "fit_claim", sentences: fit.sentences } });
      }
      continue;
    }
    const failure = deterministic[rule];
    if (failure != null) failed.push(failure);
  }

  logBattery({ failed, claimState: claim.state, fitState: verdict.state });
  const asked = rulesAsked(a, { fit, fitAsked: a.knowledge !== undefined });
  return { passed: !failed.some((failure) => stops(failure)), asked, failed, claim, fit };
}
