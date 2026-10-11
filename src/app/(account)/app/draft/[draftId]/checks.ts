// SPEC §7 (2026-10-10, issue 1394) — the draft screen's Checks list: every
// hard rule, in plain words, as the last recorded run left it.
//
// `HardRule` (`src/lib/generate/rules/types.ts`) is the closed list the
// battery runs. `CHECKS` below is a total record over it, so a rule added
// there does not compile here until it has a sentence and a group, and the
// headline's total is `HARD_RULES.length`.
//
// **A row states an outcome, and four exist.** `passed`: the run asked the
// rule of this page and it held. `skipped`: the run did not ask it — a rule
// about comparisons on a page that is not one — and that is never drawn or
// counted as a pass. `failed`: the run recorded it broken. `pending`: the
// never-claim check after an edit, still running. A rule with no recorded
// outcome draws no row: a draft in review must have passed the battery, but
// "it must have passed" is a deduction about a run this screen never saw.
//
// Two rules are answered live instead of from the record, as they always
// were:
//
//   `grounding`    — the recorded passage still occurs in the body as it
//                    now stands. The same question the highlight asks
//                    (`grounded.ts`), so a marked fact and this row cannot
//                    disagree. Where it does not, the grounded block says so
//                    and no row is drawn.
//   `do_not_claim` — the claim check's own state, which the badge at the
//                    head of the card already carries. It is re-run after
//                    generation, so the battery's record of it is stale.
import { NEAR_DUPLICATE_MAX } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import { HARD_RULES, type HardRule, type RecordedChecks } from "@/lib/generate/rules/types";
import type { ClaimState, KnownCheck } from "./model";

export type CheckGroup = "facts" | "honesty" | "structure";

/** The three groups, in the order the note lists them. */
export const CHECK_GROUPS: readonly { group: CheckGroup; title: CopyKey }[] = Object.freeze([
  { group: "facts", title: "draft.checks.group.facts" },
  { group: "honesty", title: "draft.checks.group.honesty" },
  { group: "structure", title: "draft.checks.group.structure" },
]);

/** Every rule's sentence and group. Total over `HardRule`. */
export const CHECKS: Readonly<Record<HardRule, { group: CheckGroup; key: CopyKey }>> = Object.freeze({
  grounding: { group: "facts", key: "draft.checks.rule.grounding" },
  traceable_numerals: { group: "facts", key: "draft.checks.rule.traceable-numerals" },
  rival_source: { group: "facts", key: "draft.checks.rule.rival-source" },
  no_invented_test: { group: "facts", key: "draft.checks.rule.no-invented-test" },
  no_invented_provenance: { group: "facts", key: "draft.checks.rule.no-invented-provenance" },
  no_placeholder_cell: { group: "facts", key: "draft.checks.rule.no-placeholder-cell" },
  no_invented_people: { group: "honesty", key: "draft.checks.rule.no-invented-people" },
  no_unsourced_testimonial: { group: "honesty", key: "draft.checks.rule.no-unsourced-testimonial" },
  do_not_claim: { group: "honesty", key: "draft.checks.rule.do-not-claim" },
  fit_claim: { group: "honesty", key: "draft.checks.rule.fit-claim" },
  honest_row: { group: "honesty", key: "draft.checks.rule.honest-row" },
  no_hidden_text: { group: "honesty", key: "draft.checks.rule.no-hidden-text" },
  no_machine_address: { group: "honesty", key: "draft.checks.rule.no-machine-address" },
  near_duplicate: { group: "structure", key: "draft.checks.rule.near-duplicate" },
  title: { group: "structure", key: "draft.checks.rule.title" },
  first_block_answers: { group: "structure", key: "draft.checks.rule.first-block-answers" },
  required_blocks: { group: "structure", key: "draft.checks.rule.required-blocks" },
  distinct_headings: { group: "structure", key: "draft.checks.rule.distinct-headings" },
  no_demo_text: { group: "structure", key: "draft.checks.rule.no-demo-text" },
});

export type CheckStatus = "passed" | "skipped" | "failed" | "pending";

/** A row the list draws. */
export interface CheckRow {
  rule: HardRule;
  group: CheckGroup;
  status: CheckStatus;
  key: CopyKey;
  vars?: Record<string, string | number>;
}

/** The list, and the counts its headline states. `total` and `passed` are
 *  `null` where the run did not record which rules it asked: a count would
 *  then leave rules unaccounted for. */
export interface CheckList {
  rows: readonly CheckRow[];
  counts: { passed: number; total: number; skipped: number; failed: number; fixed: number } | null;
}

/**
 * The rows to draw, for the draft as it now stands, in `HARD_RULES` order.
 *
 * `grounded` is the *live* answer against the buffer, not the stored flag,
 * so an edit that removed the fact removes this row in the same render that
 * removes the highlight.
 */
export function checkList(a: {
  grounded: boolean;
  claim: ClaimState;
  /** The last battery, as `drafts.rule_failures` and `drafts.meta.checks`
   *  record it. `NO_CHECKS` where none is recorded for this text. */
  recorded: RecordedChecks;
  /** SPEC §7 (2026-09-20, #928): the site's known pages and the closest of
   *  them to this page. `null` for a site whose index holds none. */
  known?: KnownCheck | null;
}): CheckList {
  const rows: CheckRow[] = [];
  for (const rule of HARD_RULES) {
    const status = statusOf(rule, a);
    if (status === null) continue;
    const { group, key } = CHECKS[rule];
    rows.push(
      rule === "near_duplicate"
        ? { rule, group, status, ...nearDuplicate(status, a.known ?? null) }
        : { rule, group, status, key }
    );
  }
  const count = (status: CheckStatus): number => rows.filter((row) => row.status === status).length;
  return {
    rows,
    counts:
      a.recorded.skipped === null
        ? null
        : {
            passed: count("passed"),
            total: HARD_RULES.length,
            skipped: count("skipped"),
            failed: count("failed"),
            fixed: a.recorded.fixed,
          },
  };
}

function statusOf(
  rule: HardRule,
  a: { grounded: boolean; claim: ClaimState; recorded: RecordedChecks }
): CheckStatus | null {
  if (rule === "grounding") return a.grounded ? "passed" : null;
  if (rule === "do_not_claim") {
    if (a.claim.state === "passed") return "passed";
    if (a.claim.state === "nothing_to_check") return "skipped";
    return a.claim.state === "outstanding" ? "pending" : "failed";
  }
  if (a.recorded.passed.includes(rule)) return "passed";
  if (a.recorded.failed.includes(rule)) return "failed";
  return a.recorded.skipped?.includes(rule) === true ? "skipped" : null;
}

/**
 * The near-duplicate row, as full as the facts allow (#928).
 *
 * A pass on a site whose index holds pages names what it was checked
 * against and the closest of them — linked from this page, or not: a post
 * still unpublished, a page on a host we do not link to. Otherwise the row
 * states the rule and its ceiling, read from `NEAR_DUPLICATE_MAX`.
 */
function nearDuplicate(status: CheckStatus, known: KnownCheck | null): Pick<CheckRow, "key" | "vars"> {
  if (status !== "passed" || known === null || known.pages === 0 || known.closest === null) {
    return { key: CHECKS.near_duplicate.key, vars: { percent: Math.round(NEAR_DUPLICATE_MAX * 100) } };
  }
  return {
    key: known.closest.linked ? "draft.checks.not-a-repeat" : "draft.checks.not-a-repeat.unlinked",
    vars: { n: known.pages, title: known.closest.title },
  };
}
