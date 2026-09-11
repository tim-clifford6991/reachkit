// BUILD §8 — the generation engine's public entry point.
//
// Everything a caller outside `src/lib/generate/` may use, and nothing
// else. The individual rule modules, the model steps and the store port are
// internal: a caller that reached them could queue a page the battery never
// saw.
//
// `generateDayPage` is the whole of what the `draft/generate` job calls.
// It is the one place the day's page is assembled end to end:
//
//   * the freshest scan is found — §8: "the day's page is generated the
//     evening before from the freshest scan";
//   * the `CAP_DRAFT` context is opened around everything that spends;
//   * §7's `nextForDay` supplies the opportunity, and supplies nothing when
//     there is none: supply is the cap, and the calendar is never padded;
//   * the pipeline runs, and ADR-070's one automatic regeneration is
//     performed here — once, and never for a draft that has entered review.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-08-31: One automatic regeneration; a draft that has entered review is never
//   regenerated. — ADR-070

import { nextForDay } from "@/lib/opportunities";
import { withDraftCost } from "./cost";
import { recoveryOutcome } from "./claims/recovery";
import type { SiteRuleInputs } from "./rules/types";
import { generateDraft, type GenerateOutcome } from "./pipeline";
import { generateStore } from "./store";

export type { GroundedFact, HardRule, RuleFailure, ComparisonSet, SiteRuleInputs } from "./rules/types";
export { HARD_RULES } from "./rules/types";
export { runHardRules, type BatteryOutcome } from "./rules";
export { similarity } from "./rules/similarity";
export { renderOf } from "./rules/text";

export { claimCheck, type ClaimVerdict } from "./claims/check";
export { listHash } from "./claims/hash";
export { claimRecheckOutstanding, outstandingMatch } from "./claims/outstanding";
export { sweepOutstandingRechecks, type SweepOutcome } from "./claims/sweep";
export { recoveryOutcome, type Recovery } from "./claims/recovery";

export { generateDraft, type GenerateOutcome } from "./pipeline";
export { rejectionCause, type NearDuplicateCause } from "./pipeline/rejection";
export { type PipelineStep } from "./pipeline/steps";
export { type DraftPromptInputs, DRAFT_PROMPT_KEYS } from "./voice/inputs";
export { setGenerateStore, type GenerateStore } from "./store";
export { withDraftCost } from "./cost";

/** Why a day has no page. Every arm is a fact, and none of them is a
 *  sentence: the calendar's own module owns the words. */
export type DayPageOutcome =
  | { ok: true; draftId: string }
  | { ok: false; because: "no_site" }
  | { ok: false; because: "no_scan" }
  /** §7: supply is the cap. Nothing was invented to fill the day. */
  | { ok: false; because: "no_opportunity" }
  | { ok: false; because: "rules"; draftId: string | null; attempts: number }
  | { ok: false; because: "step_failed"; draftId: string | null; step: string };

/** ADR-070: "one automatic regeneration". Two attempts in total, and the
 *  second only where the first was stopped by a rule and the draft had not
 *  entered review — which, on this path, it never has. */
const MAX_AUTOMATIC_ATTEMPTS = 2;

export async function generateDayPage(a: {
  siteId: string;
  /** The site-local calendar date the page is for. */
  publishDate: string;
}): Promise<DayPageOutcome> {
  const store = generateStore();

  const site = await store.siteFacts(a.siteId);
  if (site === null) return { ok: false, because: "no_site" };

  // §8: "the day's page is generated the evening before from the freshest
  // scan." No scan, no measured pages — and no measured pages is no
  // grounded fact, which §8 leaves no way around.
  const report = await store.latestReport(a.siteId);
  if (report === null) return { ok: false, because: "no_scan" };

  const opportunity = await nextForDay(a.siteId);
  if (opportunity === null) return { ok: false, because: "no_opportunity" };

  // The one name the product holds for the business is the brand the
  // profile measured off their own home page — what the site calls itself.
  // It is a measurement, and the brand-gap and quotation rules read it as
  // one. It is deliberately **not** written to `drafts.attribution`: an
  // attribution has to be a name the customer recorded, and no column
  // records one yet, so a page publishes with no attribution rather than a
  // derived one (§8 hard rule 2).
  const measuredBrand =
    report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);

  const ruleInputs: SiteRuleInputs = {
    businessName: measuredBrand,
    domain: site.domain,
    doNotClaim: site.doNotClaim,
    rivals: site.rivals,
    report,
    // The register's other half. Every figure an opportunity carries was
    // copied out of the scan that derived it, so the report walk above
    // already registers it; the list is passed so a target that outlives
    // its report still contributes its own evidence.
    opportunities: [opportunity],
  };

  const category =
    report.market.kind === "unmeasured" ? "" : report.market.value.profile.category;

  return withDraftCost({ scanId: report.scanId }, async (cost) => {
    let last: GenerateOutcome | null = null;
    for (let attempt = 1; attempt <= MAX_AUTOMATIC_ATTEMPTS; attempt++) {
      last = await generateDraft(cost, {
        siteId: a.siteId,
        opportunity,
        scheduledFor: a.publishDate,
        site: ruleInputs,
        voiceText: site.voiceText,
        category,
        scanId: report.scanId,
      });
      if (last.ok) return { ok: true, draftId: last.draftId };
      // A step that did not run is not a rule that failed: regenerating
      // would not make an unavailable model available, and it must not
      // consume the one automatic attempt.
      if (last.reason === "step_failed") {
        return { ok: false, because: "step_failed", draftId: last.draftId, step: last.step };
      }
      if (
        recoveryOutcome({
          failed: last.failed.map((failure) => failure.rule),
          automaticAttempts: attempt - 1,
          enteredReview: false,
        }) === "rest"
      ) {
        break;
      }
    }
    const stopped = last;
    if (stopped === null || stopped.ok || stopped.reason !== "rules") {
      return { ok: false, because: "rules", draftId: null, attempts: MAX_AUTOMATIC_ATTEMPTS };
    }
    return { ok: false, because: "rules", draftId: stopped.draftId, attempts: stopped.attempt };
  });
}
