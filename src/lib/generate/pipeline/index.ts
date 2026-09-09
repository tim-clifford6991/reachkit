// BUILD §8 — one page per opportunity, gated by the battery.
//
// The order is fixed and every part of it is §8's:
//
//   1. the ceiling, read before anything runs;
//   2. the grounding read — the customer's own live page, out of the
//      measurement ledger, never fetched again;
//   3. brief (nano) → outline (nano) → grounded draft (Haiku) →
//      answerability + SEO pass (Haiku);
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
import { buildPromptInputs } from "../voice/inputs";
import { buildComparisonSet } from "./comparison";
import { readGroundingFact } from "./grounding";
import { answerability, brief, draft, outline, type PipelineStep } from "./steps";

/** The state a row this function writes is left in. §9's transition table
 *  belongs to the publishing engine: this pipeline writes a page and stops,
 *  and the edge into `in_review` — with the veto clock it starts — is that
 *  engine's to take. A row that never gets there is a row in `generating`,
 *  which is not a state anything publishes from. */
const GENERATING = "generating";

export type GenerateOutcome =
  | { ok: true; draftId: string; grounded: GroundedFact }
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

  // 2. The grounding read. No fallback: §8's fact is the customer's own
  //    live page or the draft does not ship. A site with nothing readable
  //    fails hard rule 1 — and it fails it here, before a cent is spent
  //    writing a page that cannot pass.
  const grounding = await readGroundingFact({ siteId: a.siteId, scanId: a.scanId });
  if ("failed" in grounding) {
    const failed: RuleFailure[] = [{ rule: "grounding" }];
    logRun({ siteId: a.siteId, outcome: "rules", failed: "grounding", attempt: 1 });
    return {
      ok: false,
      reason: "rules",
      draftId: null,
      failed,
      attempt: 1,
      // Nothing was written, so there is no row to count an attempt on and
      // no text to protect: the ordinary recovery rule decides, with the
      // count this run would have made.
      recovery: recoveryOutcome({ failed: ["grounding"], automaticAttempts: 0, enteredReview: false }),
    };
  }

  const inputs = buildPromptInputs({
    businessName: a.site.businessName,
    domain: a.site.domain,
    category: a.category,
    voiceText: a.voiceText,
    opportunity: a.opportunity,
    grounded: grounding.fact,
  });

  // 3. The four model steps. Each re-reads the ceiling; an `unmeasured`
  //    result from any of them is that step's failure and never a rule's.
  const briefResult = await brief(c, inputs);
  if (briefResult.kind === "unmeasured") return stepFailed(a.siteId, "brief");

  const outlineResult = await outline(c, inputs, { brief: briefResult.value });
  if (outlineResult.kind === "unmeasured") return stepFailed(a.siteId, "outline");

  const draftResult = await draft(c, inputs, {
    brief: briefResult.value,
    outline: outlineResult.value,
  });
  if (draftResult.kind === "unmeasured") return stepFailed(a.siteId, "draft");

  const polished = await answerability(c, inputs, { body: draftResult.value });
  if (polished.kind === "unmeasured") return stepFailed(a.siteId, "answerability");

  const body = polished.value;
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
    // The one shape (`../fact.ts`), so what is written here and what the
    // draft view and the hosted page read cannot be spelled differently.
    grounded_fact: recordedFactValue(grounding.fact),
    attribution: null,
    scheduled_for: a.scheduledFor,
    cost_cents: Math.round(c.spentCents()),
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
  });

  await store.patchDraft(draftId, {
    claim_check: recordedVerdictValue(outcome.claim),
    // The battery's own record, written on every run — the empty array on
    // a run that found nothing, because "a battery ran and passed this
    // page" and "no battery has touched this row" are different facts and
    // the draft view's Checks list draws a row only for the first (#424).
    rule_failures: recordedRulesValue(outcome),
    cost_cents: Math.round(c.spentCents()),
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

function stepFailed(siteId: string, step: PipelineStep): GenerateOutcome {
  logRun({ siteId, step, outcome: "step_failed" });
  return { ok: false, reason: "step_failed", draftId: null, step };
}
