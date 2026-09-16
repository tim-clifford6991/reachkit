// SPEC §7 (#789) — the founder's edit, saved and re-checked.
//
// The draft editor saves the title, the body and the meta description the
// founder typed. The words land first and are never refused for what they
// say: a save that failed a rule and dropped the text would lose the one
// thing the editor promises to keep. What an edit changes is whether the
// page may publish, and that is decided the way generation decides it —
// the same battery (`./rules`) and the same claim check over the edited
// text, recorded in the same columns (`claim_check`, `rule_failures`,
// `hard_rules_passed`).
//
// **Held from the instant the text changes.** The write that stores the new
// text clears the last verdict and `hard_rules_passed` in the same patch,
// so no moment exists where the stored text carries a verdict reached on
// other words. A re-check that could not run — no scan, a model that did
// not answer, the ceiling — leaves the page held, and the save still
// succeeded. The publishing engine's guards (`no_outstanding_claim_recheck`,
// `draft_passed_hard_rules`) read those columns on every route into an
// attempt.
//
// **The veto window is not this module's.** An edit moves no state and
// writes no `veto_deadline`.
//
// The brief the page was written from is not stored, so its three inputs
// are read back from what is: the customer's own passages (`readFacts`, the
// set the brief chose among), the headings of the page as ReachKit wrote it
// (an edit may not add a question heading the written page did not have),
// and the searches the opportunity targets.
import { isTransition } from "@/lib/publish/machine/table";
import type { State } from "@/lib/publish/types";
import { withDraftCost } from "./cost";
import { claimCheck, type ClaimVerdict } from "./claims/check";
import { readRecordedFact } from "./fact";
import { buildComparisonSet } from "./pipeline/comparison";
import { readFacts } from "./pipeline/grounding";
import {
  readRecordedRules,
  readRecordedVerdict,
  recordedRulesValue,
  recordedVerdictValue,
} from "./record";
import { runHardRules } from "./rules";
import { headingsOf, renderOf } from "./rules/text";
import type { RuleFailure, SiteRuleInputs } from "./rules/types";
import { generateStore, type DraftRow } from "./store";

/** A body past this is refused rather than truncated — truncating is losing
 *  the founder's words. Far above any page the pipeline writes. */
export const DRAFT_EDIT_MAX_CHARS = 200_000;

export interface DraftEdit {
  siteId: string;
  draftId: string;
  title: string;
  bodyMd: string;
  /** The meta description (`drafts.meta.description`). */
  description: string;
  at?: Date;
}

export type DraftEditOutcome =
  | {
      ok: true;
      savedAt: Date;
      /** The verdict recorded for the saved text; `null` where no check ran. */
      claim: ClaimVerdict | null;
      /** The battery's failures on the saved text; `null` where it did not run. */
      failed: readonly RuleFailure[] | null;
      /** Whether the saved text may publish — every rule and the claim check passed. */
      passed: boolean;
    }
  | { ok: false; refused: "not_editable" | "too_large" };

type Meta = Record<string, unknown>;

function metaOf(row: DraftRow): Meta {
  return typeof row.meta === "object" && row.meta !== null ? { ...(row.meta as Meta) } : {};
}

function stringAt(meta: Meta, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" ? value : null;
}

/** A `fix_page` draft (#690) records what the update carries in `meta.fix`,
 *  and delivery reads it from there. */
function fixOf(meta: Meta): Meta | null {
  const fix = meta.fix;
  return typeof fix === "object" && fix !== null ? (fix as Meta) : null;
}

function logEdit(detail: Record<string, string | number | boolean | null>): void {
  // Never the title, the body or the description.
  console.log(JSON.stringify({ event: "draft_edit_saved", ...detail }));
}

export async function saveDraftEdit(a: DraftEdit): Promise<DraftEditOutcome> {
  const at = a.at ?? new Date();
  const store = generateStore();
  const row = await store.draftById(a.draftId);
  // Ownership and editability together: another site's draft reads exactly
  // like one that has left review.
  if (row === null || row.site_id !== a.siteId || !isTransition(row.state as State, "approved")) {
    return { ok: false, refused: "not_editable" };
  }
  if (a.bodyMd.length + a.title.length + a.description.length > DRAFT_EDIT_MAX_CHARS) {
    return { ok: false, refused: "too_large" };
  }

  const meta = metaOf(row);
  const fix = fixOf(meta);
  const before = { title: row.title ?? "", bodyMd: row.body_md ?? "", description: stringAt(meta, "description") ?? "" };
  const changed =
    a.title !== before.title || a.bodyMd !== before.bodyMd || a.description !== before.description;

  if (!changed && row.claim_check !== null) {
    // Nothing to write and nothing to spend: the recorded verdict already
    // speaks for this text. A text whose last re-check could not run is
    // checked again.
    return { ok: true, savedAt: at, ...recorded(row) };
  }

  const nextMeta: Meta = {
    ...meta,
    description: a.description,
    // The page as ReachKit wrote it, kept once so the authorship label and
    // the heading rule read the generated text rather than the latest edit.
    body_md_generated: stringAt(meta, "body_md_generated") ?? before.bodyMd,
    first_edited_at: stringAt(meta, "first_edited_at") ?? at.toISOString(),
    last_saved_at: at.toISOString(),
  };
  if (fix !== null) {
    nextMeta.fix = {
      ...fix,
      ...(fix.title === null || fix.title === undefined ? {} : { title: a.title }),
      ...(fix.description === null || fix.description === undefined ? {} : { description: a.description }),
    };
  }

  await store.patchDraft(a.draftId, {
    title: a.title,
    body_md: a.bodyMd,
    meta: nextMeta,
    claim_check: null,
    rule_failures: null,
    hard_rules_passed: false,
  });

  const checked = await recheck(row, a, nextMeta, fix !== null).catch((error: unknown) => {
    logEdit({ siteId: a.siteId, draftId: a.draftId, recheck: "threw", detail: String(error) });
    return null;
  });
  if (checked === null) {
    return { ok: true, savedAt: at, claim: null, failed: null, passed: false };
  }

  const passed = checked.failed.length === 0 && checked.claim.state === "passed";
  await store.patchDraft(a.draftId, {
    claim_check: recordedVerdictValue(checked.claim),
    rule_failures: checked.failed,
    hard_rules_passed: passed,
    cost_cents: Number(row.cost_cents) + checked.spentCents,
  });
  logEdit({
    siteId: a.siteId,
    draftId: a.draftId,
    claim: checked.claim.state,
    failed: checked.failed.map((failure) => failure.rule).join(","),
    passed,
  });
  return { ok: true, savedAt: at, claim: checked.claim, failed: checked.failed, passed };
}

/** An unchanged save answers with what the row already records. */
function recorded(row: DraftRow): { claim: ClaimVerdict | null; failed: readonly RuleFailure[] | null; passed: boolean } {
  const claim = readRecordedVerdict(row.claim_check);
  const failed = readRecordedRules(row.rule_failures);
  const passed = claim !== null && claim.state === "passed" && failed !== null && failed.length === 0;
  return { claim, failed, passed };
}

async function recheck(
  row: DraftRow,
  a: DraftEdit,
  meta: Meta,
  isFix: boolean
): Promise<{ claim: ClaimVerdict; failed: RuleFailure[]; spentCents: number } | null> {
  const store = generateStore();
  const site = await store.siteFacts(a.siteId);
  const report = await store.latestReport(a.siteId);
  // No list to check against, or no scan to ledger the check to: the page
  // stays held until a save can run it.
  if (site === null || report === null) return null;

  return withDraftCost({ scanId: report.scanId }, async (cost) => {
    if (isFix) {
      // A metadata-only fix has no body; the claim check over what it
      // changes is the one rule it has (`pipeline/page-fix.ts`).
      const claim = await claimCheck(cost, {
        text: [a.title, a.description].filter((value) => value !== "").join("\n"),
        list: site.doNotClaim,
      });
      const failed: RuleFailure[] =
        claim.state === "failed" ? [{ rule: "do_not_claim", detail: { rule: "do_not_claim", matchedEntry: claim.matchedEntry } }] : [];
      return { claim, failed, spentCents: cost.spentCents() };
    }

    const { opportunityById } = await import("@/lib/opportunities");
    const opportunity = await opportunityById(row.opportunity_id);
    const facts = await readFacts({ siteId: a.siteId, scanId: report.scanId });
    const recordedFact = readRecordedFact(row.grounded_fact);
    const source =
      recordedFact === null ? undefined : facts.find((sourced) => sourced.fact.passage === recordedFact.passage);

    const measuredBrand =
      report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);
    const siteInputs: SiteRuleInputs = {
      businessName: measuredBrand,
      domain: site.domain,
      doNotClaim: site.doNotClaim,
      rivals: site.rivals,
      report,
      opportunities: opportunity === null ? [] : [opportunity],
    };

    const outcome = await runHardRules(cost, {
      markdown: a.bodyMd,
      rendered: renderOf(a.bodyMd),
      site: siteInputs,
      comparison: await buildComparisonSet({ siteId: a.siteId, exceptDraftId: a.draftId }),
      grounded:
        recordedFact === null
          ? null
          : { passage: recordedFact.passage, url: recordedFact.url, readAt: recordedFact.readAt ?? source?.fact.readAt ?? new Date() },
      sourceText: source?.sourceText ?? "",
      brief: {
        facts: facts.map((sourced) => sourced.fact.passage),
        headings: headingsOf(stringAt(meta, "body_md_generated") ?? ""),
        queries:
          opportunity === null
            ? []
            : [...(opportunity.targetQuery === null ? [] : [opportunity.targetQuery]), ...opportunity.absorbedQueries],
      },
    });
    return { claim: outcome.claim, failed: recordedRulesValue(outcome), spentCents: cost.spentCents() };
  });
}
