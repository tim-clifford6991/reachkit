// BUILD §8 — one page per opportunity, gated by the battery.
//
// The order is fixed and every part of it is §8's:
//
//   1. the ceiling, read before anything runs;
//   2. the facts read — passages of the customer's own live pages, out of
//      the measurement ledger, never fetched again;
//   3. brief (nano), handed a closed projection, choosing facts by index →
//      outline (nano) over the type's fixed skeleton → grounded draft
//      (Haiku) → answerability + SEO pass (Haiku), which returns operations
//      that code applies inside SPEC §7's bound (issue 475);
//   4. the draft row, written with the grounded fact and the body;
//   5. the comparison set, and the hard-rule battery over the finished text
//      — including the claim check, which is step five;
//   6. `passed: true` and nothing else lets the item move toward review.
//
// **A failing draft is never queued and takes no day.** Nothing partial is
// published or handed to a destination. The row is written before the
// battery because the failure has to have somewhere to live — the cause a
// rejected day carries has to survive the run that produced it — and the
// row it is written to stays in `generating`, which is not a state anything
// publishes from.
//
// **A step that failed is not a rule that failed.** A model that did not
// answer, and the ceiling stopping a step, both give `step_failed`: they do
// not populate `failed`, they do not increment `hard_rule_attempts`, and
// they do not consume the one automatic regeneration — regenerating would
// not make an unavailable model available.
//
// **The hard rules bind what ReachKit generates, never what the customer
// writes.** This function is on the generation path only; an edit the
// customer saves does not come through here.
import type { CostContext } from "@/lib/costs";
import type { Opportunity } from "@/lib/opportunities";
import { recordedFactValue } from "../fact";
import { recoveryOutcome, type Recovery } from "../claims/recovery";
import { recordedRulesValue, recordedVerdictValue } from "../record";
import { runHardRules } from "../rules";
import { renderOf } from "../rules/text";
import type { GroundedFact, RuleFailure, SiteRuleInputs } from "../rules/types";
import { generateStore } from "../store";
import { applyLinks } from "../links/apply";
import type { LinkTarget } from "../links/select";
import { buildPromptInputs } from "../voice/inputs";
import { buildComparisonSet } from "./comparison";
import { applyAnswerability } from "./answerability";
import { readFacts } from "./grounding";
import { SKELETONS } from "./skeletons";
import {
  answerability,
  brief,
  briefProjection,
  draft,
  outline,
  selectedFactIndexes,
  type PipelineStep,
} from "./steps";

/** The state a row this function writes is left in. §9's transition table
 *  belongs to the publishing engine: this pipeline writes a page and stops,
 *  and the edge into `in_review` — with the veto clock it starts — is that
 *  engine's to take. A row that never gets there is a row in `generating`,
 *  which is not a state anything publishes from. */
const GENERATING = "generating";

export type GenerateOutcome =
  /** `grounded` is `null` for a `fix_page` draft (#690): a metadata-only
   *  update carries no body, so it stands on the page's own words and on no
   *  passage. */
  | { ok: true; draftId: string; grounded: GroundedFact | null }
  | {
      ok: false;
      reason: "rules";
      draftId: string | null;
      failed: RuleFailure[];
      /** `drafts.hard_rule_attempts` after this run — automatic only. */
      attempt: number;
      recovery: Recovery;
    }
  | { ok: false; reason: "step_failed"; draftId: string | null; step: PipelineStep };

/** Observability: per-step outcome, which rules failed, the attempt number.
 *  **Never** the prompt, the voice text, the draft body or the grounded
 *  passage. */
function logRun(detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ event: "draft_generated", ...detail }));
}

export async function generateDraft(
  c: CostContext,
  a: {
    siteId: string;
    /** The opportunity the page is written for, evidence included. Passed
     *  rather than looked up: the caller already holds it (§7's
     *  `nextForDay` returned it), and a second read could return a row the
     *  ranking has since moved. */
    opportunity: Opportunity;
    /** The site-local calendar date this page is for. §8: the day's page is
     *  generated the evening before its publish date. */
    scheduledFor: string;
    site: SiteRuleInputs;
    voiceText: string | null;
    category: string;
    /** The customer's own pages the page links to — the inventory's and the
     *  cluster's, chosen by `../links/select.ts` (SPEC §7, 2026-09-12). */
    links: readonly LinkTarget[];
    /** The scan whose measured pages ground the page. */
    scanId?: string;
  }
): Promise<GenerateOutcome> {
  const store = generateStore();

  // 1. The ceiling, before anything runs.
  if (c.capHit()) {
    logRun({ siteId: a.siteId, step: "brief", outcome: "cap" });
    return { ok: false, reason: "step_failed", draftId: null, step: "brief" };
  }

  // 2. The facts read. No fallback: §8's fact is the customer's own live
  //    page or the draft does not ship. A site with nothing readable fails
  //    hard rule 1 — and it fails it here, before a cent is spent writing a
  //    page that cannot pass.
  const facts = await readFacts({ siteId: a.siteId, scanId: a.scanId });
  if (facts.length === 0) return noFact(a.siteId);

  // The page's shape is its type's, never the model's (issue 475).
  const skeleton = SKELETONS[a.opportunity.type];
  if (skeleton === null) return stepFailed(a.siteId, "outline");

  // 3. The brief, handed the closed projection and nothing else. It picks
  //    facts by index; a brief that picks none stops here, before any draft
  //    call, with only its own call ledgered.
  const briefResult = await brief(
    c,
    briefProjection({
      opportunity: a.opportunity,
      facts: facts.map((sourced) => sourced.fact.passage),
      doNotClaim: a.site.doNotClaim,
      voice: a.voiceText,
    })
  );
  if (briefResult.kind === "unmeasured") return stepFailed(a.siteId, "brief");
  const selected = selectedFactIndexes(briefResult.value, facts.length).map((index) => facts[index]!);
  const grounding = selected[0];
  if (grounding === undefined) return noFact(a.siteId);
  const passages = selected.map((sourced) => sourced.fact.passage);

  const inputs = buildPromptInputs({
    businessName: a.site.businessName,
    domain: a.site.domain,
    category: a.category,
    voiceText: a.voiceText,
    opportunity: a.opportunity,
    grounded: grounding.fact,
    links: a.links,
  });

  // 4. The skeleton's outline, the draft, and the bounded answerability
  //    pass. Each re-reads the ceiling; an `unmeasured` result from any of
  //    them is that step's failure and never a rule's.
  const outlineResult = await outline(c, inputs, { brief: briefResult.value, skeleton });
  if (outlineResult.kind === "unmeasured") return stepFailed(a.siteId, "outline");

  const draftResult = await draft(c, inputs, {
    brief: briefResult.value,
    outline: outlineResult.value,
    facts: selected.map((sourced) => ({ url: sourced.fact.url, passage: sourced.fact.passage })),
  });
  if (draftResult.kind === "unmeasured") return stepFailed(a.siteId, "draft");

  const ops = await answerability(c, inputs, { body: draftResult.value, facts: passages });
  if (ops.kind === "unmeasured") return stepFailed(a.siteId, "answerability");

  // SPEC §7: the page links to the chosen pages of the customer's own site
  // and to none it guessed — held in code after the bounded answerability
  // pass, before the row is written, so the battery reads and the store
  // keeps the body a reader will meet.
  const answered = applyAnswerability(draftResult.value, ops.value, passages);
  const body = {
    ...answered,
    bodyMarkdown: applyLinks(answered.bodyMarkdown, {
      domain: a.site.domain,
      targets: a.links,
      groundedUrl: grounding.fact.url,
    }),
  };
  const rendered = renderOf(body.bodyMarkdown);

  // 4. The row. `attribution` is the name **recorded** for the site and
  //    nothing else. No column records one today, so it is null and the page
  //    publishes with no attribution rather than a derived one — which is
  //    §8 hard rule 2 holding, not a gap in it. The brand the profile
  //    measured is a measurement and is read by the rules; it is not an
  //    author, and writing it here would be the generated byline the rule
  //    exists to prevent.
  const draftId = await store.insertDraft({
    site_id: a.siteId,
    opportunity_id: a.opportunity.id,
    state: GENERATING,
    title: body.title,
    body_md: body.bodyMarkdown,
    // The description the draft step already writes, kept where the hosted
    // template reads it (issue 697): without it every hosted page's head
    // has no meta description and §9's crawl flags ReachKit's own template.
    meta: { description: body.description },
    // The one shape (`../fact.ts`), so what is written here and what the
    // draft view and the hosted page read cannot be spelled differently.
    grounded_fact: recordedFactValue(grounding.fact),
    attribution: null,
    scheduled_for: a.scheduledFor,
    // The draft's own roll-up, in the unit the ledger holds
    // (`drafts.cost_cents` is `numeric(12,4)` since #449). Not rounded:
    // one day's page costs about 6.5¢ and rounding it to a whole cent
    // made the draft disagree with the `fetches` rows it sums.
    cost_cents: c.spentCents(),
  });

  // 5. The battery, over the finished text, against this customer's own
  //    three sets.
  const comparison = await buildComparisonSet({ siteId: a.siteId, exceptDraftId: draftId });
  const outcome = await runHardRules(c, {
    markdown: body.bodyMarkdown,
    rendered,
    site: a.site,
    comparison,
    grounded: grounding.fact,
    sourceText: grounding.sourceText,
    brief: {
      facts: passages,
      headings: outlineResult.value.sections.map((section) => section.heading),
      queries: [
        ...(a.opportunity.targetQuery === null ? [] : [a.opportunity.targetQuery]),
        ...a.opportunity.absorbedQueries,
      ],
    },
  });

  await store.patchDraft(draftId, {
    claim_check: recordedVerdictValue(outcome.claim),
    // The battery's own record, written on every run — the empty array on
    // a run that found nothing, because "a battery ran and passed this
    // page" and "no battery has touched this row" are different facts and
    // the draft view's Checks list draws a row only for the first (#424).
    rule_failures: recordedRulesValue(outcome),
    cost_cents: c.spentCents(),
    // The publishing engine's guard on `generating → in_review`. Written
    // here and nowhere else: only the run that put the page through the
    // battery may say the battery passed it. An unrun claim check leaves
    // it false, because "we could not check" is not "it passed".
    hard_rules_passed: outcome.passed && outcome.claim.state === "passed",
  });

  // An unrun claim check is a step that did not run, not a rule that
  // failed: it holds the page without consuming the one regeneration.
  if (outcome.claim.state === "unrun") {
    logRun({ siteId: a.siteId, draftId, step: "claim_check", outcome: outcome.claim.reason });
    return { ok: false, reason: "step_failed", draftId, step: "claim_check" };
  }

  if (outcome.passed) {
    logRun({ siteId: a.siteId, draftId, outcome: "passed", costCents: Math.round(c.spentCents()) });
    return { ok: true, draftId, grounded: grounding.fact };
  }

  // 6. A failing draft is never queued and takes no day. The attempt is
  //    counted so the recovery rule can say whether one more is allowed;
  //    the cause the day's line carries was written with the record above.
  const before = await store.draftById(draftId);
  const attemptsBefore = before?.hard_rule_attempts ?? 0;
  const attempt = attemptsBefore + 1;
  // The failures are already recorded — the patch above writes them on
  // every run — so this one counts the attempt and nothing else.
  await store.patchDraft(draftId, { hard_rule_attempts: attempt });

  // `automaticAttempts` is how many automatic attempts had **already** been
  // made when this one was authorised — the stored column before this run's
  // increment. So the first failure asks "may a first regeneration happen?"
  // and gets `regenerate_once`; the second asks the same and gets `rest`.
  const recovery = recoveryOutcome({
    failed: outcome.failed.map((failure) => failure.rule),
    automaticAttempts: attemptsBefore,
    enteredReview: false,
  });
  logRun({ siteId: a.siteId, draftId, outcome: "rules", attempt, recovery });
  return { ok: false, reason: "rules", draftId, failed: outcome.failed, attempt, recovery };
}

/** Hard rule 1 with nothing to stand on: no page of the customer's yielded a
 *  passage, or the brief chose none of those it was handed. Nothing was
 *  written, so there is no row to count an attempt on; the ordinary recovery
 *  rule decides, with the count this run would have made. */
function noFact(siteId: string): GenerateOutcome {
  const failed: RuleFailure[] = [{ rule: "grounding" }];
  logRun({ siteId, outcome: "rules", failed: "grounding", attempt: 1 });
  return {
    ok: false,
    reason: "rules",
    draftId: null,
    failed,
    attempt: 1,
    recovery: recoveryOutcome({ failed: ["grounding"], automaticAttempts: 0, enteredReview: false }),
  };
}

function stepFailed(siteId: string, step: PipelineStep): GenerateOutcome {
  logRun({ siteId, step, outcome: "step_failed" });
  return { ok: false, reason: "step_failed", draftId: null, step };
}
