// BUILD §8 — the hard-rule battery.
//
// §8's rules are "enforced in code, not prompts", and this is the one place
// they are all run. Nine of the ten are deterministic passes over finished
// text and cost nothing; the tenth is the do-not-claim check, which owns
// its own module and is called from here rather than re-implemented.
//
// **Every rule runs, and the failure list carries all of them** — not the
// first. A draft stopped by three rules is one the customer's next
// regeneration has to clear three times, and reporting one at a time would
// spend the single automatic attempt learning that.
//
// **An unrun claim check is not a rule failure.** "We could not check" is
// not "it failed": it does not populate `failed`, it does not consume the
// one automatic regeneration, and it is returned to the caller as a step
// that did not run. Regenerating would not make an unavailable model
// available.
//
// The order is `HARD_RULES`' order, so a failure list is comparable across
// runs.
import type { CostContext } from "@/lib/costs";
import { claimCheck } from "../claims/check";
import type { ClaimVerdict } from "../claims/check";
import { checkBrandGap } from "./brandgap";
import { buildPrivateFigureRegister, checkPrivateFigure } from "./figures";
import { checkGrounding } from "./grounding";
import { checkHiddenText } from "./hidden";
import { checkMachineAddress } from "./machine";
import { checkNearDuplicate } from "./nearduplicate";
import { checkInventedPeople, checkUnsourcedTestimonial } from "./people";
import { checkRivalSource } from "./rivals";
import { HARD_RULES } from "./types";
import type { ComparisonSet, GroundedFact, HardRule, RuleFailure, SiteRuleInputs } from "./types";

export type BatteryOutcome =
  | { passed: true; claim: ClaimVerdict }
  | { passed: false; failed: RuleFailure[]; claim: ClaimVerdict };

/** Observability: which rules failed and the duplicated ref. **Never** the
 *  draft body, the grounded passage, or a list entry. */
function logBattery(a: { failed: readonly RuleFailure[]; claimState: string }): void {
  console.log(
    JSON.stringify({
      event: "hard_rules_ran",
      failed: a.failed.map((failure) => failure.rule),
      claim: a.claimState,
    })
  );
}

export async function runHardRules(
  c: CostContext,
  a: {
    markdown: string;
    /** What a reader of the published page meets. */
    rendered: string;
    site: SiteRuleInputs;
    comparison: ComparisonSet;
    grounded: GroundedFact | null;
    /** The rendered text of the customer's own page the grounded fact was
     *  drawn from, as the measurement read it on that fact's read date. The
     *  grounding rule has no other source and no fallback. */
    sourceText: string;
  }
): Promise<BatteryOutcome> {
  const register = buildPrivateFigureRegister({
    report: a.site.report,
    opportunities: a.site.opportunities,
  });

  // The nine deterministic arms, keyed by the rule they answer for, so the
  // battery is assembled in `HARD_RULES` order below rather than in
  // whatever order the calls happen to be written in.
  //
  // **Total, not partial** (issue #424). A rule with no arm here would be
  // read as one that failed nothing — by the loop below, which is how
  // `passed` is decided, and by the record the draft view's Checks list is
  // drawn from. Spelling the nine as a total record makes an undecided rule
  // a compile error rather than a pass the product hands out for free.
  const deterministic: Record<Exclude<HardRule, "do_not_claim">, RuleFailure | null> = {
    grounding: checkGrounding({ grounded: a.grounded, sourceText: a.sourceText }),
    rival_source: checkRivalSource({ markdown: a.markdown, rivals: a.site.rivals }),
    no_private_figure: checkPrivateFigure({ markdown: a.markdown, register }),
    no_invented_people: checkInventedPeople({
      markdown: a.markdown,
      businessName: a.site.businessName,
    }),
    no_unsourced_testimonial: checkUnsourcedTestimonial({ markdown: a.markdown }),
    brand_gap: checkBrandGap({
      rendered: a.rendered,
      businessName: a.site.businessName,
      domain: a.site.domain,
    }),
    no_hidden_text: checkHiddenText({ markdown: a.markdown }),
    no_machine_address: checkMachineAddress({ rendered: a.rendered }),
    near_duplicate: checkNearDuplicate({ rendered: a.rendered, comparison: a.comparison }),
  };

  // The tenth. `claimCheck` owns the match; this file holds no second
  // implementation of it.
  const claim = await claimCheck(c, { text: a.markdown, list: a.site.doNotClaim });

  const failed: RuleFailure[] = [];
  for (const rule of HARD_RULES) {
    if (rule === "do_not_claim") {
      if (claim.state === "failed") {
        failed.push({
          rule: "do_not_claim",
          detail: { rule: "do_not_claim", matchedEntry: claim.matchedEntry },
        });
      }
      continue;
    }
    const failure = deterministic[rule];
    if (failure != null) failed.push(failure);
  }

  logBattery({ failed, claimState: claim.state });
  return failed.length === 0 ? { passed: true, claim } : { passed: false, failed, claim };
}
