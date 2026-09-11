// The rule set, in report order. The directory is the list (proposal 24,
// S2): a rule is one file exporting { id, text, run(ctx) }, and this file
// is the declared order — RULES and RULE_TEXT are derived from it, never
// kept by hand beside it. config.mjs reads RULES from here too.

import danglingId from "./dangling-id.mjs";
import registryContradiction from "./registry-contradiction.mjs";
import generatedDrift from "./generated-drift.mjs";
import statusOffGrammar from "./status-off-grammar.mjs";
import fieldVocabulary from "./field-vocabulary.mjs";
import ellipsisRange from "./ellipsis-range.mjs";
import tstHeadingOffGrammar from "./tst-heading-off-grammar.mjs";
import orphanRequirement from "./orphan-requirement.mjs";
import doneWithoutValidation from "./done-without-validation.mjs";
import tstWithoutRegression from "./tst-without-regression.mjs";
import previewWithoutUrl from "./preview-without-url.mjs";
import highRiskWithoutMutation from "./high-risk-without-mutation.mjs";
import silentIndex from "./silent-index.mjs";
import edgeOffSchema from "./edge-off-schema.mjs";
import requirementOffJourney from "./requirement-off-journey.mjs";
import satisfiesSuperseded from "./satisfies-superseded.mjs";
import staleBlueprint from "./stale-blueprint.mjs";
import untracedChange from "./untraced-change.mjs";
import doneWithoutCommits from "./done-without-commits.mjs";
import waveOffRecord from "./wave-off-record.mjs";
import workOrderFanout from "./work-order-fanout.mjs";
import corpusVolume from "./corpus-volume.mjs";
import assumptionBudget from "./assumption-budget.mjs";
import openAssumptionOnDone from "./open-assumption-on-done.mjs";
import pivotRelink from "./pivot-relink.mjs";
import mintedOpenAssumption from "./minted-open-assumption.mjs";

export const RULE_MODULES = [danglingId, registryContradiction, generatedDrift, statusOffGrammar, fieldVocabulary, ellipsisRange, tstHeadingOffGrammar, orphanRequirement, doneWithoutValidation, tstWithoutRegression, previewWithoutUrl, highRiskWithoutMutation, silentIndex, edgeOffSchema, requirementOffJourney, satisfiesSuperseded, staleBlueprint, untracedChange, doneWithoutCommits, waveOffRecord, workOrderFanout, corpusVolume, assumptionBudget, openAssumptionOnDone, pivotRelink, mintedOpenAssumption];
export const RULES = RULE_MODULES.map((r) => r.id);
export const RULE_TEXT = Object.fromEntries(RULE_MODULES.map((r) => [r.id, r.text]));
