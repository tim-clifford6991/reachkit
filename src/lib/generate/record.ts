// BUILD §8 — what a generation run records about its own battery, in one
// shape each.
//
// `fact.ts` holds the first of these records (hard rule 1's passage, issue
// #415). This module holds the other two, and it exists for the same
// reason: the pipeline writes them, the draft view states them to the
// customer before they approve, and the two halves have to agree about
// where they are and what they say.
//
// **They did not agree, which is issue #424.** The draft store read
// `drafts.meta.claim` and `drafts.meta.hard_rules_passed`; §8's pipeline
// writes the `drafts.claim_check` column (the verdict, hash and all) and
// `drafts.rule_failures` (the battery's failure list), and no code in
// `src/` has ever written either `meta` key. So on every generated draft
// the S16 claim badge said `outstanding` whatever the check had found, and
// the Checks list was empty whatever the battery had passed — while the
// reserved fixture account's draft, whose states are typed in by hand,
// showed both.
//
// **A pass is read out of the failure list, never deduced from the state.**
// `runHardRules` decides every rule but `do_not_claim` on every run and
// returns every failure, so "this rule is not in the list" is the same
// statement `passed: true` makes — not an inference about a run this
// module never saw. What separates a recorded pass from an assumed one is
// the difference between `null` and `[]`: a row no battery has written is
// `null` and passes nothing, and a row a battery passed carries the empty
// list. `rules/index.ts` spells the sixteen arms as a total record, so a rule
// that stopped being decided is a compile error rather than a pass this
// reader would hand out for free.
//
// **The do-not-claim rule is not in that record, and must not be.** The
// do-not-claim check has its own column because it is re-run after
// generation — the customer edits their list, the sweep re-checks, and the
// verdict that matters is the current one. Reading it out of a battery
// record frozen at generation would state a check that has since been
// overtaken.
import { listHash } from "./claims/hash";
import type { ClaimVerdict } from "./claims/check";
import type { BatteryOutcome } from "./rules";
import { HARD_RULES, NO_CHECKS, SWITCHED_RULES, type HardRule, type RecordedChecks, type RuleFailure } from "./rules/types";

// ── Hard rule 4: the claim check's verdict ──────────────────────────────

/**
 * What the pipeline and the sweep store in `drafts.claim_check`.
 *
 * `jsonb` has no `Date`. One projection, used by both writers, so a verdict
 * written by either reads back the same way — and the optional members are
 * written only where the verdict carries them, so a passing check stores no
 * empty `matchedEntry` for a reader to mistake for one.
 */
export function recordedVerdictValue(verdict: ClaimVerdict): Record<string, unknown> {
  const out: Record<string, unknown> = { state: verdict.state, at: verdict.at.toISOString() };
  if (verdict.state === "passed" || verdict.state === "failed") out.listHash = verdict.listHash;
  if (verdict.state === "failed") out.matchedEntry = verdict.matchedEntry;
  if (verdict.state === "unrun") out.reason = verdict.reason;
  return out;
}

/**
 * `drafts.claim_check`, read back. A shape this build does not recognise is
 * treated as no verdict at all — which leaves the draft outstanding and
 * held, the safe direction for the guard and the honest one for the badge.
 */
export function readRecordedVerdict(payload: unknown): ClaimVerdict | null {
  if (payload === null || typeof payload !== "object") return null;
  const blob = payload as Record<string, unknown>;
  const at =
    typeof blob.at === "string" ? new Date(blob.at) : blob.at instanceof Date ? blob.at : null;
  if (at === null || Number.isNaN(at.getTime())) return null;
  if (blob.state === "passed" && typeof blob.listHash === "string") {
    return { state: "passed", listHash: blob.listHash, at };
  }
  if (
    blob.state === "failed" &&
    typeof blob.listHash === "string" &&
    typeof blob.matchedEntry === "string"
  ) {
    return { state: "failed", listHash: blob.listHash, at, matchedEntry: blob.matchedEntry };
  }
  if (blob.state === "unrun" && (blob.reason === "llm_unavailable" || blob.reason === "cap_hit")) {
    return { state: "unrun", reason: blob.reason, at };
  }
  return null;
}

/** The hash every empty do-not-claim list has (`hash.ts`: "the empty list
 *  has a stable hash of its own"). Computed once, from the one definition,
 *  so this file holds no second spelling of it. */
const EMPTY_LIST_HASH = listHash([]);

/**
 * Whether a verdict was reached against a list with nothing in it.
 *
 * `claimCheck` passes an empty list at zero cost, and it is right to: a
 * page cannot state a claim the customer never forbade, and the publishing
 * guard needs a pass to release it. But a customer who has recorded no
 * entries is owed the difference between "we checked, and it is clean" and
 * "there was nothing to check" — REQ-045 criterion 3's outcome is stated in
 * every case and is "never a silent pass" (`claim.ts`). The verdict's own
 * hash is what tells them apart, and it tells them apart for the list the
 * check actually ran against rather than for the list as it stands now.
 */
export function checkedAgainstNothing(verdict: ClaimVerdict): boolean {
  return verdict.state === "passed" && verdict.listHash === EMPTY_LIST_HASH;
}

// ── Hard rules 1–3, 5–7: the battery's own record ───────────────────────

/**
 * What the pipeline stores in `drafts.rule_failures`: the failures the last
 * battery found, in `HARD_RULES` order.
 *
 * Written on **every** run, including the runs that passed — the empty
 * array is the record that a battery ran and found nothing, and without it
 * a passing run is indistinguishable from a row no battery ever touched.
 */
export function recordedRulesValue(outcome: BatteryOutcome): RuleFailure[] {
  return outcome.passed ? [] : [...outcome.failed];
}

/**
 * `drafts.rule_failures`, read back, or `null` where no battery has
 * recorded anything. A member whose shape this build does not recognise is
 * skipped, never thrown on: a cause is a courtesy to the customer and a
 * malformed one must not take down the calendar.
 */
export function readRecordedRules(payload: unknown): RuleFailure[] | null {
  if (!Array.isArray(payload)) return null;
  const out: RuleFailure[] = [];
  for (const member of payload) {
    if (member === null || typeof member !== "object") continue;
    const blob = member as Record<string, unknown>;
    if (typeof blob.rule !== "string") continue;
    out.push(blob as unknown as RuleFailure);
  }
  return out;
}

// ── Which rules a run asked, and which it put right (issue 1394) ────────

/** `drafts.meta.checks`: the rules the last battery asked of the page, and
 *  the ones the run failed first and then cleared. */
export interface RecordedRun {
  asked: HardRule[];
  fixed: HardRule[];
}

const rulesIn = (value: unknown): HardRule[] =>
  Array.isArray(value) ? HARD_RULES.filter((rule) => value.includes(rule)) : [];

/** What the pipeline and an edit's re-check store in `drafts.meta.checks`.
 *  `broken` is every rule the run failed at any point; the ones the page no
 *  longer fails are the ones it fixed. */
export function recordedRunValue(outcome: BatteryOutcome, broken: Iterable<HardRule> = []): RecordedRun {
  const failing = new Set(outcome.passed ? [] : outcome.failed.map((failure) => failure.rule));
  return { asked: rulesIn(outcome.asked), fixed: rulesIn([...broken]).filter((rule) => !failing.has(rule)) };
}

/** `drafts.meta.checks`, read back, or `null` on a row written before it
 *  was recorded. */
export function readRecordedRun(meta: unknown): RecordedRun | null {
  const value = (meta as { checks?: { asked?: unknown; fixed?: unknown } | null } | null)?.checks;
  if (value === null || typeof value !== "object" || !Array.isArray(value.asked)) return null;
  return { asked: rulesIn(value.asked), fixed: rulesIn(value.fixed) };
}

/**
 * The last battery, rule by rule.
 *
 * A pass is a rule the run asked and did not fail. On a row written before
 * `meta.checks`, only the rules no caller can switch off are known to have
 * been asked, so only those can pass.
 */
export function recordedChecks(ruleFailures: unknown, run: RecordedRun | null): RecordedChecks {
  const failures = readRecordedRules(ruleFailures);
  if (failures === null) return NO_CHECKS;
  const failed = rulesIn(failures.map((failure) => failure.rule));
  const asked = run === null ? HARD_RULES.filter((rule) => !SWITCHED_RULES.includes(rule)) : run.asked;
  const passed = asked.filter((rule) => !failed.includes(rule));
  return {
    passed,
    failed,
    skipped: run === null ? null : HARD_RULES.filter((rule) => !run.asked.includes(rule) && !failed.includes(rule)),
    fixed: run === null ? 0 : run.fixed.filter((rule) => passed.includes(rule)).length,
  };
}
