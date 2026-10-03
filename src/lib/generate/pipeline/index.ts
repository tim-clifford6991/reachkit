// BUILD §8 — one page per opportunity, gated by the battery.
//
// The order is fixed and every part of it is §8's:
//
//   1. the ceiling, read before anything runs;
//   2. the facts read — passages of the customer's own live pages, out of
//      the measurement ledger, never fetched again — and, beside them, the
//      market facts the research step read from public pages (SPEC §7,
//      2026-09-29, *Two pools of facts*; issue 1135), handed in by the
//      caller so every attempt at a date is written from one read;
//   3. brief (nano), handed a closed projection, choosing facts by index →
//      outline (nano), six to ten sections chosen from the block set with
//      the type's required blocks among them → grounded draft (Haiku),
//      returned in parts and laid out in code (`./compose.ts`, issue 1137)
//      → answerability + SEO pass (Haiku), which returns operations that
//      code applies inside SPEC §7's bound (issue 475);
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
// publishes from, until the caller rests it (`../index.ts`).
//
// **A date has one row across every attempt (#788).** A regeneration is
// handed the row the earlier attempt wrote and rewrites it in place: a
// second insert left two rows on one date, and the second attempt's
// near-duplicate gate compared the page against the first attempt's own
// text. The row's recorded passage is frozen by a trigger, so a rewrite is
// grounded on that same passage.
//
// **A step that failed is not a rule that failed.** A model that did not
// answer, and the ceiling stopping a step, both give `step_failed`: they do
// not populate `failed` and they do not increment `hard_rule_attempts`.
// Once the date's row exists the failure names it, and the caller decides
// whether a second attempt runs and where the row rests (#813).
//
// **The hard rules bind what ReachKit generates, never what the customer
// writes.** This function is on the generation path only; an edit the
// customer saves does not come through here.
import { BRIEF_MAX_FACTS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Opportunity, SitePage } from "@/lib/opportunities";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { readRecordedFact, recordedFactValue } from "../fact";
import { recoveryOutcome, type Recovery } from "../claims/recovery";
import { recordedRulesValue, recordedVerdictValue } from "../record";
import { batteryCleared, runHardRules } from "../rules";
import { renderOf } from "../rules/text";
import type { GroundedFact, RuleFailure, SiteRuleInputs } from "../rules/types";
import { generateStore, type DraftRow } from "../store";
import { applyLinks } from "../links/apply";
import type { LinkTarget } from "../links/select";
import { buildPromptInputs, type KnownPageBrief } from "../voice/inputs";
import { profileItemsUsed, type PromptProfile } from "../voice/profile-block";
import { buildComparisonSet } from "./comparison";
import { applyAnswerability } from "./answerability";
import { properNouns, withClosing } from "./compose";
import { allowedFacts, readAllFacts } from "./grounding";
import { fixNotes, repairable, repairMechanical, type FixNote, type RepairRecord } from "./repair";
import { NO_RESEARCH, hostOf, type MarketFact, type MarketResearch } from "./research";
import { skeletonFor } from "./skeletons";
import { completeTables, withSources } from "./sources";
import { contentKindOf } from "@/lib/opportunities/content-kind";
import { RESEARCH } from "@/lib/config/constants";
import {
  answerability,
  brief,
  briefProjection,
  draft,
  outline,
  selectedFactIndexes,
  selectedMarketIndexes,
  targetSearches,
  writtenPage,
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
      /** #1178: what the next attempt is told — each rule this one broke and
       *  the sentences that broke it. Absent where no page was written. */
      fix?: FixNote[];
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
    /** `null` only for a stopped row that gave up its date (issue 1179),
     *  which is rewritten and never inserted. */
    scheduledFor: string | null;
    site: SiteRuleInputs;
    voiceText: string | null;
    category: string;
    /** The customer's own pages the page links to — the inventory's and the
     *  cluster's, chosen by `../links/select.ts` (SPEC §7, 2026-09-12). */
    links: readonly LinkTarget[];
    /** SPEC §7 (2026-09-20, #928): the pages the site already has that are
     *  nearest this one, so the page is written beside them. Passed rather
     *  than read here for the reason `profile` is: the caller holds the
     *  index it chose the links from. */
    known?: readonly KnownPageBrief[];
    /** Every page the site has published or planned (issue 1209). */
    sitePages?: readonly SitePage[];
    /** The confirmed business profile, bounded, or `null` where nothing has
     *  been read of the site (#927). Passed rather than read here: the
     *  caller already holds the market reading it is half made of, so
     *  reading it again would be a second query for a fact in hand. */
    profile: PromptProfile | null;
    /** SPEC §7 (2026-09-29): the page's byline — the founder's name and
     *  line from setup, else the business's name. Recorded on the row
     *  (`drafts.attribution`) and printed by the page, never written by a
     *  model. `null` where the site has neither. */
    byline?: string | null;
    /** The passages the customer switched off (#926, #927), from the same
     *  read as the profile. Subtracted from the grounding list below. */
    factsOff: readonly string[];
    /** The scan whose measured pages ground the page. */
    scanId?: string;
    /** The row an earlier attempt wrote for this date, to rewrite rather
     *  than insert beside (#788). */
    draftId?: string;
    /** #1178: the failures of the attempt this one follows, so it is written
     *  against them rather than re-rolled blind. */
    fix?: readonly FixNote[];
    /** The market pool (issue 1135): what `./research.ts` read for this
     *  target. Absent is a page written from its business facts alone. */
    market?: MarketResearch;
  }
): Promise<GenerateOutcome> {
  const store = generateStore();

  // 1. The ceiling, before anything runs.
  if (c.capHit()) {
    logRun({ siteId: a.siteId, step: "brief", outcome: "cap" });
    return { ok: false, reason: "step_failed", draftId: a.draftId ?? null, step: "brief" };
  }

  // 2. The facts read. No fallback: §8's fact is the customer's own live
  //    page or the draft does not ship. A site with nothing readable fails
  //    hard rule 1 — and it fails it here, before a cent is spent writing a
  //    page that cannot pass.
  // The pages that speak to the target search are offered first, and the
  // pages are taken in turn rather than one page emptied before the next, so
  // the brief chooses among facts from across the site (issue 900). `all` is
  // uncapped only so a passage an earlier attempt pinned can still be found;
  // `facts` is what the brief is handed.
  const searches = targetSearches(a.opportunity);
  // A passage the customer switched off on Settings › Your business is not
  // one this page may quote (#927), so it is subtracted before anything
  // chooses among them — before the cap too, or a refused passage would
  // fill a slot and push an allowed one out of the brief's list.
  const all = allowedFacts(
    await readAllFacts({ siteId: a.siteId, scanId: a.scanId, target: searches[0] }),
    a.factsOff
  );
  const facts = all.slice(0, BRIEF_MAX_FACTS);
  if (facts.length === 0) return noFact(a.siteId);
  const market = a.market ?? NO_RESEARCH;

  // The page's shape is its kind's and its type's, never the model's (issue
  // 475; the weekly mix's kinds, issue 1209).
  const skeleton = skeletonFor(a.opportunity);
  if (skeleton === null) return stepFailed(a.siteId, "outline", a.draftId);

  // 3. The brief, handed the closed projection and nothing else. It picks
  //    facts by index; a brief that picks none stops here, before any draft
  //    call, with only its own call ledgered.
  const briefResult = await brief(
    c,
    briefProjection({
      opportunity: a.opportunity,
      facts: facts.map((sourced) => sourced.fact.passage),
      marketFacts: market.facts.map((fact) => ({ source: hostOf(fact.url), claim: fact.passage })),
      doNotClaim: a.site.doNotClaim,
      voice: a.voiceText,
      profile: a.profile,
      ...(a.sitePages === undefined ? {} : { sitePages: a.sitePages }),
    })
  );
  if (briefResult.kind === "unmeasured") return stepFailed(a.siteId, "brief", a.draftId);
  const chosen = selectedFactIndexes(briefResult.value, facts.length).map((index) => facts[index]!);
  // A rewrite stands on the passage its row already records — the trigger
  // refuses any other. One the facts no longer hold is hard rule 1 failing
  // on that row.
  const existing = a.draftId === undefined ? null : await store.draftById(a.draftId);
  const recorded = existing === null ? null : readRecordedFact(existing.grounded_fact);
  const pinned = recorded === null ? undefined : all.find((sourced) => sourced.fact.passage === recorded.passage);
  if (existing !== null && recorded !== null && pinned === undefined) return lostFact(a.siteId, existing);
  const selected = pinned === undefined ? chosen : [pinned, ...chosen.filter((sourced) => sourced !== pinned)];
  const grounding = selected[0];
  if (grounding === undefined) return noFact(a.siteId);
  const passages = selected.map((sourced) => sourced.fact.passage);
  const cited = chosenMarketFacts(
    selectedMarketIndexes(briefResult.value, market.facts.length).map((index) => market.facts[index]!),
    market.facts,
    contentKindOf(a.opportunity) === "comparison"
  );

  const inputs = buildPromptInputs({
    businessName: a.site.businessName,
    domain: a.site.domain,
    category: a.category,
    voiceText: a.voiceText,
    opportunity: a.opportunity,
    grounded: grounding.fact,
    links: a.links,
    ...(a.known === undefined ? {} : { known: a.known }),
    profile: a.profile,
  });

  // 4. The skeleton's outline, the draft, and the bounded answerability
  //    pass. Each re-reads the ceiling; an `unmeasured` result from any of
  //    them is that step's failure and never a rule's.
  const names = [a.site.businessName ?? "", a.site.domain.split(".")[0] ?? "", ...a.site.rivals];
  const outlineResult = await outline(c, inputs, {
    brief: briefResult.value,
    skeleton,
    proper: properNouns([...passages, ...cited.map((fact) => fact.passage)], [
      ...names,
      ...market.products.map((product) => product.domain.split(".")[0] ?? ""),
    ]),
  });
  if (outlineResult.kind === "unmeasured") return stepFailed(a.siteId, "outline", a.draftId);

  const draftResult = await draft(c, inputs, {
    brief: briefResult.value,
    outline: outlineResult.value,
    facts: selected.map((sourced) => ({ url: sourced.fact.url, passage: sourced.fact.passage })),
    marketFacts: cited.map((fact) => ({
      url: fact.url,
      source: fact.title,
      passage: fact.passage,
      readAt: fact.readAt.toISOString().slice(0, 10),
    })),
    products: market.products.filter((product) => cited.some((fact) => fact.product === product.domain)),
    ...(a.fix === undefined || a.fix.length === 0 ? {} : { fix: a.fix }),
  });
  if (draftResult.kind === "unmeasured") return stepFailed(a.siteId, "draft", a.draftId);

  // The page, laid out in code from the parts the writer returned (issue
  // 1137): the short-answer box held to its word count, the takeaways, each
  // section under the outline's own heading — tidied of what a page never
  // says.
  const laidOut = await writtenPage(c, inputs, {
    parts: draftResult.value,
    outline: outlineResult.value,
    tidy: {
      // Both pools: a quotation stands where it is either's exact words.
      facts: [...passages, ...cited.map((fact) => fact.passage)],
      promises: a.profile?.promises ?? [],
      queries: searches,
      names,
    },
  });
  if (laidOut.kind === "unmeasured") return stepFailed(a.siteId, "draft", a.draftId);
  const composed = laidOut.value;

  const ops = await answerability(c, inputs, { body: composed.body, facts: passages });
  if (ops.kind === "unmeasured") return stepFailed(a.siteId, "answerability", a.draftId);

  // SPEC §7: the page links to the chosen pages of the customer's own site
  // and to none it guessed — held in code after the bounded answerability
  // pass, before the row is written, so the battery reads and the store
  // keeps the body a reader will meet. The closing line is the page's last
  // word, so it is laid out after the body's links are settled.
  //
  // Then the two things the market pool asks of a finished body (issue
  // 1135): no table cell left empty, and the sources list of the market
  // pages the body cites, written here and never by the model.
  const answered = applyAnswerability(composed.body, ops.value, passages);
  const linking = { domain: a.site.domain, targets: a.links, groundedUrl: grounding.fact.url };
  const body = {
    ...answered,
    bodyMarkdown: withSources(
      withClosing(
        completeTables(
          // The chosen pages the text did not reach are listed in the
          // section on how the business itself handles the question.
          applyLinks(answered.bodyMarkdown, {
            ...linking,
            appendUnder: outlineResult.value.sections.find((section) => section.role === "business")?.heading,
          })
        ),
        applyLinks(composed.closing, { ...linking, appendMissing: false }),
        a.links[0]?.url ?? `https://${a.site.domain}/`
      ),
      cited
    ),
  };
  const blockInputs = {
    compares: outlineResult.value.sections.some((section) => section.role === "comparison"),
    faq: composed.faq,
    domain: a.site.domain,
  };

  // 4. The row. `attribution` is the page's byline (SPEC §7, 2026-09-29):
  //    the founder's name and line from setup, else the business's name —
  //    what the caller read, never what a model wrote. `null` where the
  //    site has neither, and the page then publishes under its domain.
  const priorRepairs = recordedRepairs(existing?.meta);
  const page = {
    title: body.title,
    body_md: body.bodyMarkdown,
    // The description the draft step already writes, kept where the hosted
    // template reads it (issue 697): without it every hosted page's head
    // has no meta description and §9's crawl flags ReachKit's own template.
    //
    // **What this page was written from** (#927): the profile items the
    // prompt carried and the passages the brief chose, so the review
    // screen's *written from your business* card lists what was used rather
    // than re-deriving it from a profile that may have changed since. Two
    // flat lists of the customer's own strings — no figure, no id, and
    // nothing a later read could contradict. `profileItems` is absent where
    // the site has no profile, because there were none to carry;
    // `factsUsed` is always written, because a page that quotes no fact of
    // the customer's own does not ship (§8 hard rule 1), so there is always
    // at least one.
    //
    // **Each fact carries the page it was read from** (#931). #927 wrote
    // the passages alone, and #931's done-when is "every sentence about the
    // business on the page appears in the *Written from* card **with its
    // source**" — which a passage without its address cannot answer. The
    // url is the same `fact.url` the grounded record already keeps, so
    // nothing new is derived: it is written down beside the passage it
    // belongs to instead of being matched back to it later against a
    // measurement that may have moved.
    meta: {
      description: body.description,
      // SPEC §7 (2026-09-29): "three to six questions buyers ask, stored as
      // `drafts.meta.faq`" — beside the page, never in its body. The hosted
      // page's `FAQPage` data is built from this and from nothing else.
      faq: composed.faq,
      ...(a.profile === null ? {} : { profileItems: profileItemsUsed(a.profile) }),
      factsUsed: selected.map((sourced) => ({
        passage: sourced.fact.passage,
        url: sourced.fact.url,
      })),
      // Issue 1135: the market facts the page was handed, each with the
      // page and the date it was read — what an edit's rules are re-run
      // against, and what the review screen can show beside the business
      // facts. Written on every page since the research step, empty or not.
      marketFacts: cited.map((fact) => ({
        passage: fact.passage,
        url: fact.url,
        title: fact.title,
        readAt: fact.readAt.toISOString(),
      })),
      // #1178: an earlier attempt's repairs survive the rewrite.
      ...(priorRepairs.length === 0 ? {} : { repairs: priorRepairs }),
    },
    // The one shape (`../fact.ts`), so what is written here and what the
    // draft view and the hosted page read cannot be spelled differently.
    grounded_fact: recordedFactValue(grounding.fact),
    // The draft's own roll-up, in the unit the ledger holds
    // (`drafts.cost_cents` is `numeric(12,4)` since #449). Not rounded:
    // one day's page costs about 6.5¢ and rounding it to a whole cent
    // made the draft disagree with the `fetches` rows it sums.
    cost_cents: c.spentCents(),
  };
  let draftId: string;
  if (existing === null) {
    draftId = await store.insertDraft({
      ...page,
      site_id: a.siteId,
      opportunity_id: a.opportunity.id,
      state: GENERATING,
      attribution: a.byline ?? null,
      scheduled_for: a.scheduledFor,
    });
  } else {
    draftId = existing.id;
    await store.patchDraft(draftId, page);
  }

  // 5. The battery, over the finished text, against this customer's own
  //    three sets.
  const comparison = await buildComparisonSet({ siteId: a.siteId, exceptDraftId: draftId });
  const briefRead = {
    facts: passages,
    headings: outlineResult.value.sections.map((section) => section.heading),
    queries: searches,
    marketFacts: cited.map((fact) => ({ url: fact.url, passage: fact.passage })),
  };
  const battery = (markdown: string) =>
    runHardRules(c, {
      markdown,
      title: body.title,
      rendered: renderOf(markdown),
      pageType: pageTypeOf(a.opportunity),
      ...(a.profile?.knowledge === undefined ? {} : { knowledge: a.profile.knowledge }),
      site: a.site,
      comparison,
      grounded: grounding.fact,
      sourceText: grounding.sourceText,
      brief: briefRead,
      factPages: selected.map((sourced) => sourced.fact.url),
      blocks: blockInputs,
    });
  let markdown = body.bodyMarkdown;
  let outcome = await battery(markdown);

  // #1178: a page stopped by a mechanical rule is repaired in code and put
  // through the whole battery again before a model call is spent on a
  // second attempt. The repair is kept only where the battery passes it;
  // otherwise the page stands as written and the next attempt is told why.
  const repairs: RepairRecord[] = [];
  const tried =
    outcome.passed || outcome.claim.state === "unrun" || outcome.fit.state === "unrun"
      ? []
      : repairable(outcome.failed);
  if (tried.length > 0) {
    const repaired = repairMechanical(markdown, tried, {
      brief: briefRead,
      // A number a market fact states is linked to the page it was read
      // from, as one of the customer's own is.
      sources: [
        ...selected.map((sourced) => ({ url: sourced.fact.url, text: sourced.sourceText })),
        ...cited.map((fact) => ({ url: fact.url, text: fact.passage })),
      ],
      rivals: a.site.rivals,
    });
    // A repair that moved a citation moves the sources list with it.
    const resourced = withSources(repaired, cited);
    const again = resourced === markdown ? null : await battery(resourced);
    const still = new Set(again === null || again.passed ? [] : again.failed.map((failure) => failure.rule));
    for (const rule of tried) repairs.push({ rule, cleared: again !== null && !still.has(rule) });
    console.log(JSON.stringify({ event: "draft_repaired", siteId: a.siteId, draftId, repairs }));
    if (again !== null && batteryCleared(again)) {
      markdown = resourced;
      outcome = again;
    }
  }

  await store.patchDraft(draftId, {
    ...(markdown === body.bodyMarkdown ? {} : { body_md: markdown }),
    // Every repair this date's row has been through, across its attempts,
    // so how often each rule's repair clears it can be read off the rows.
    ...(repairs.length === 0
      ? {}
      : { meta: { ...page.meta, repairs: [...priorRepairs, ...repairs] } }),
    claim_check: recordedVerdictValue(outcome.claim),
    // The battery's own record, written on every run — the empty array on
    // a run that found nothing, because "a battery ran and passed this
    // page" and "no battery has touched this row" are different facts and
    // the draft view's Checks list draws a row only for the first (#424).
    rule_failures: recordedRulesValue(outcome),
    cost_cents: c.spentCents(),
    // The publishing engine's guard on `generating → in_review`. Written
    // here and nowhere else: only the run that put the page through the
    // battery may say the battery passed it. An unrun claim check or fit
    // check leaves it false, because "we could not check" is not "it passed".
    hard_rules_passed: batteryCleared(outcome),
  });

  // An unrun claim check is a step that did not run, not a rule that
  // failed: it holds the page without consuming the one regeneration.
  if (outcome.claim.state === "unrun") {
    logRun({ siteId: a.siteId, draftId, step: "claim_check", outcome: outcome.claim.reason });
    return { ok: false, reason: "step_failed", draftId, step: "claim_check" };
  }
  if (outcome.fit.state === "unrun") {
    logRun({ siteId: a.siteId, draftId, step: "fit_check", outcome: outcome.fit.reason });
    return { ok: false, reason: "step_failed", draftId, step: "fit_check" };
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
  return {
    ok: false,
    reason: "rules",
    draftId,
    failed: outcome.failed,
    attempt,
    recovery,
    fix: fixNotes(markdown, outcome.failed, briefRead, a.site, body.title),
  };
}

/** The market facts the page is handed: the brief's choice, and — on a page
 *  that compares options — the first of the rest until it stands on
 *  `RESEARCH.comparisonMinFacts`, the rivals' own pages first, so a
 *  comparison is never written with nothing to cite about what it compares. */
function chosenMarketFacts(
  chosen: readonly MarketFact[],
  all: readonly MarketFact[],
  comparison: boolean
): MarketFact[] {
  const out = [...chosen];
  if (!comparison) return out;
  const rest = all.filter((fact) => !out.includes(fact));
  for (const fact of [...rest.filter((f) => f.product !== undefined), ...rest.filter((f) => f.product === undefined)]) {
    if (out.length >= RESEARCH.comparisonMinFacts) break;
    out.push(fact);
  }
  return out;
}

/** The repairs an earlier attempt recorded on this row. */
function recordedRepairs(meta: unknown): RepairRecord[] {
  const value = (meta as { repairs?: unknown } | null)?.repairs;
  return Array.isArray(value) ? (value as RepairRecord[]) : [];
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

/** Hard rule 1 on a rewrite: the passage the row records is no longer on
 *  the customer's pages, and the trigger will not let the row stand on
 *  another. The failure is recorded on that row and counted like any other,
 *  so the caller rests it where the customer can see why. */
async function lostFact(siteId: string, row: DraftRow): Promise<GenerateOutcome> {
  const failed: RuleFailure[] = [{ rule: "grounding" }];
  const attempt = row.hard_rule_attempts + 1;
  await generateStore().patchDraft(row.id, {
    rule_failures: failed,
    hard_rule_attempts: attempt,
    hard_rules_passed: false,
  });
  logRun({ siteId, draftId: row.id, outcome: "rules", failed: "grounding", attempt });
  return {
    ok: false,
    reason: "rules",
    draftId: row.id,
    failed,
    attempt,
    recovery: recoveryOutcome({
      failed: ["grounding"],
      automaticAttempts: row.hard_rule_attempts,
      enteredReview: false,
    }),
  };
}

/** A step that did not run. On a rewrite the date's row already exists, and
 *  the failure names it so the caller can rest it (#813). */
function stepFailed(siteId: string, step: PipelineStep, draftId: string | undefined): GenerateOutcome {
  logRun({ siteId, step, outcome: "step_failed" });
  return { ok: false, reason: "step_failed", draftId: draftId ?? null, step };
}
