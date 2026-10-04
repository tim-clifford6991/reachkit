// BUILD §8 · SPEC §7 (2026-10-04, D41) — one page per opportunity, in five
// stages. Stage 1 (decide) and stage 2 (the context pack) are the caller's
// (`../index.ts`): this function is handed the pack and runs the rest.
//
//   2b. the pack is held against its template's *pack must hold* line, and a
//       new page against what it must add (D12). Short of either, nothing is
//       written: the row is written with its pack and the page stops, naming
//       what is missing;
//   3.  **write** — one call, the type's template filled from the pack only
//       (`./write.ts`), laid out in code (`./compose.ts`);
//   4.  **check** — code only (`../rules`): the five checks and the guards,
//       after the repairs code can make without writing a word
//       (`./repair.ts`), and the pages written for other sites
//       (`./elsewhere.ts`, D13). A page a check still fails takes **one fix
//       call**, told each check it failed, and is checked again. A page that
//       still fails is stopped;
//   5.  `passed: true` and nothing else lets the page move toward review —
//       the veto window and publishing are the publishing engine's.
//
// At most four model calls a page — two for research, one to write, one to
// fix — and, on a listicle or comparison, D44's one small fit check after
// each of the last two.
//
// **A failing draft is never queued and takes no day.** The row is written
// before the checks because the failure has to have somewhere to live, and it
// stays in `generating`, which is not a state anything publishes from, until
// the caller rests it (`../index.ts`).
//
// **A date has one row across every attempt (#788).** A rewrite is handed the
// row the earlier attempt wrote and rewrites it in place. The row's recorded
// passage is frozen by a trigger, so a rewrite is grounded on that passage.
//
// **A step that failed is not a rule that failed.** A model that did not
// answer, the ceiling stopping a call, and a short pack all give
// `step_failed`: they do not populate `failed`.
//
// **The hard rules bind what ReachKit generates, never what the customer
// writes.** An edit the customer saves does not come through here.
import { PAGE_BLOCKS, PIPELINE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Tier } from "@/lib/llm/tiers";
import type { Opportunity } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { readRecordedFact, recordedFactValue } from "../fact";
import { recoveryOutcome, type Recovery } from "../claims/recovery";
import { bodyWords, lengthRangeFor, sectionWords } from "../length";
import { applyLinks } from "../links/apply";
import type { LinkTarget } from "../links/select";
import { urlKey } from "../links/select";
import { recordedRulesValue, recordedVerdictValue } from "../record";
import { batteryCleared, runHardRules, type BatteryOutcome } from "../rules";
import { answerBoxWords } from "../rules/blocks";
import { linksOf, renderOf } from "../rules/text";
import type { GroundedFact, RuleFailure, SiteRuleInputs } from "../rules/types";
import { generateStore, type DraftRow } from "../store";
import { TEMPLATES, type PackNeed } from "../templates";
import { profileItemsUsed } from "../voice/profile-block";
import { buildComparisonSet } from "./comparison";
import { layoutPage, withClosing, type LaidPage } from "./compose";
import { closeElsewhere } from "./elsewhere";
import type { SourcedFact } from "./grounding";
import type { ContextPack } from "./pack";
import { fixNotes, repairable, repairMechanical, type FixNote, type RepairRecord } from "./repair";
import { completeTables, withSources } from "./sources";
import { comparisonTable, withTable } from "./table";
import { fixPage, writePage, type PageParts } from "./write";

/** The stages a page can stop at without a rule failing. */
export type PipelineStep =
  /** The pack is short of its template's *pack must hold* line (D41). */
  | "pack"
  /** A new page whose pack adds too little (D12, issue 1143). */
  | "adds"
  | "write"
  | "fix"
  /** Still too close to a page written for another site after its fix call
   *  (D13, issue 1144). */
  | "elsewhere"
  | "fit_check"
  | "page_read"
  | "page_fix";

/** The state a row this function writes is left in. The edge into
 *  `in_review` — with the veto clock it starts — is the publishing engine's. */
const GENERATING = "generating";

export type GenerateOutcome =
  /** `grounded` is `null` for a `fix_page` draft (#690): a metadata-only
   *  update carries no body. */
  | { ok: true; draftId: string; grounded: GroundedFact | null }
  | {
      ok: false;
      reason: "rules";
      draftId: string | null;
      failed: RuleFailure[];
      /** `drafts.hard_rule_attempts` after this run: 1 where the page was
       *  stopped as written, 2 where its fix call did not clear it. */
      attempt: number;
      recovery: Recovery;
      /** What the page was stopped for, with the sentences that failed each
       *  check (issue 1187's alert reads it). */
      fix?: FixNote[];
    }
  | {
      ok: false;
      reason: "step_failed";
      draftId: string | null;
      step: PipelineStep;
      /** On `pack`: what the template asks that the pack lacks. */
      missing?: readonly PackNeed[];
    };

/** Observability: per-step outcome, which rules failed, the attempt number.
 *  **Never** the prompt, the voice text, the draft body or a passage. */
function logRun(detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ event: "draft_generated", ...detail }));
}

/** The target search and every search the row absorbed — what the page is
 *  written for, as the pack and the checks read it. */
export function targetSearches(opportunity: Pick<Opportunity, "targetQuery" | "absorbedQueries">): string[] {
  return [...(opportunity.targetQuery === null ? [] : [opportunity.targetQuery]), ...opportunity.absorbedQueries];
}

/** Every statement the pack carries, beside its passages, that a page may
 *  repeat a figure or a phrase from: the knowledge base's own words, what
 *  the pass measured on a research page, and the live page of an update. */
export function packStatements(pack: ContextPack): string[] {
  const knowledge = pack.profile?.knowledge;
  const measured = pack.measurements;
  return [
    ...(pack.profile === null ? [] : [pack.profile.job ?? "", ...pack.profile.products, ...pack.profile.promises]),
    ...(knowledge === undefined
      ? []
      : [
          ...knowledge.offerings.flatMap((offering) => [offering.name, ...offering.features, ...offering.prices, ...offering.uses]),
          ...knowledge.differentiators.map((item) => item.text),
          ...knowledge.proof.map((item) => item.text),
          ...knowledge.audience.map((item) => item.text),
          ...knowledge.problems.map((item) => item.text),
          ...knowledge.questions.map((item) => item.text),
        ]),
    ...(measured === null
      ? []
      : [
          `${measured.score ?? ""} ${measured.questions.length} ${measured.questions.filter((q) => q.answered).length} ` +
            `${measured.questions.filter((q) => q.namesBusiness).length} ${measured.engines.length} ` +
            measured.questions.map((q) => `${q.search} ${q.citedSites}`).join(" "),
        ]),
    ...(pack.live === null ? [] : [pack.live.markdown]),
  ].filter((text) => text !== "");
}

export interface GenerateInputs {
  siteId: string;
  /** The opportunity the page is written for. Passed rather than looked up:
   *  the caller already holds it, and a second read could return a row the
   *  ranking has since moved. */
  opportunity: Opportunity;
  /** The site-local calendar date this page is for. `null` only for a
   *  stopped row that gave up its date (issue 1179), which is rewritten and
   *  never inserted. */
  scheduledFor: string | null;
  site: SiteRuleInputs;
  /** Stage 2's context pack: everything the page is written from. */
  pack: ContextPack;
  /** The customer's own passages the pack's facts were taken from, each with
   *  the text of the page it was read on — what the grounding rule verifies
   *  against and a repair links a figure to. */
  facts: readonly SourcedFact[];
  /** The customer's own pages the page links to (`../links/select.ts`). */
  links: readonly LinkTarget[];
  /** The site's demo phrases and menu lines (issue 1249). */
  demoPhrases?: readonly string[];
  /** The row an earlier attempt wrote for this date, to rewrite (#788). */
  draftId?: string;
  /** The writer's tier, where a caller has another ceiling than a customer's
   *  page. */
  tier?: Tier;
  /** When the page's making began, so the fix call stays inside the job's
   *  invocation (`PIPELINE.fixBeforeMs`). */
  startedAt?: number;
}

interface Finished {
  laid: LaidPage;
  markdown: string;
}

export async function generateDraft(c: CostContext, a: GenerateInputs): Promise<GenerateOutcome> {
  const store = generateStore();
  const startedAt = a.startedAt ?? Date.now();
  const { pack } = a;
  const template = TEMPLATES[pack.type];

  // The ceiling, before anything runs.
  if (c.capHit()) {
    logRun({ siteId: a.siteId, step: "write", outcome: "cap" });
    return { ok: false, reason: "step_failed", draftId: a.draftId ?? null, step: "write" };
  }

  // §8 hard rule 1: a page stands on at least one passage of the customer's
  // own. A rewrite stands on the passage its row already records — the
  // trigger refuses any other.
  const existing = a.draftId === undefined ? null : await store.draftById(a.draftId);
  const recorded = existing === null ? null : readRecordedFact(existing.grounded_fact);
  const pinned = recorded === null ? undefined : a.facts.find((sourced) => sourced.fact.passage === recorded.passage);
  if (existing !== null && recorded !== null && pinned === undefined) return lostFact(a.siteId, existing);
  const grounding = pinned ?? a.facts.find((sourced) => sourced.fact.passage === pack.facts[0]?.passage) ?? a.facts[0];
  if (grounding === undefined) return noFact(a.siteId);

  const priorRepairs = recordedRepairs(existing?.meta);
  const baseMeta = {
    // The pack, whole: what the page was written from (D41), read back by
    // the draft screen's *written from your business* and by an edit's
    // checks.
    pack,
    contentType: pack.type,
    // Issue 1248: the market the page was written for.
    ...(pack.business.market === null || pack.business.market === undefined ? {} : { market: pack.business.market }),
    ...(pack.profile === null ? {} : { profileItems: profileItemsUsed(pack.profile) }),
    // What a new page adds (D12), counted over the pack before the write.
    adds: pack.adds,
    ...(priorRepairs.length === 0 ? {} : { repairs: priorRepairs }),
  };
  /** The date's row, written or rewritten. `attribution` is the byline the
   *  caller read (SPEC §7, 2026-09-29), never what a model wrote. */
  const writeRow = async (fields: { title: string | null; body_md: string | null; meta: Record<string, unknown> }): Promise<string> => {
    const row = { ...fields, grounded_fact: recordedFactValue(grounding.fact), cost_cents: c.spentCents() };
    if (existing !== null) {
      await store.patchDraft(existing.id, row);
      return existing.id;
    }
    return store.insertDraft({
      ...row,
      site_id: a.siteId,
      opportunity_id: a.opportunity.id,
      state: GENERATING,
      attribution: pack.business.byline,
      scheduled_for: a.scheduledFor,
    });
  };

  // 2b. A pack short of what its template asks, or a new page short of what
  //     it must add, writes nothing. The row keeps the pack, so the page can
  //     say what is missing.
  if (pack.missing.length > 0 || pack.adds.short) {
    const draftId = await writeRow({ title: existing?.title ?? a.opportunity.title ?? null, body_md: existing?.body_md ?? null, meta: baseMeta });
    await store.patchDraft(draftId, { hard_rules_passed: false });
    const step: PipelineStep = pack.missing.length > 0 ? "pack" : "adds";
    logRun({ siteId: a.siteId, draftId, step, outcome: "short", type: pack.type, missing: pack.missing.join(",") });
    return { ok: false, reason: "step_failed", draftId, step, ...(step === "pack" ? { missing: pack.missing } : {}) };
  }

  const liveWords = pack.live === null ? null : sectionWords(pack.live.markdown);
  const length = lengthRangeFor(template, liveWords);
  // D47: a comparison written as a Q&A for want of two rivals compares
  // nobody, so it is told to answer, not to compare.
  const becameQa = pack.type === "qa" && contentTypeOf(a.opportunity) === "listicle";
  const pageType = becameQa && pageTypeOf(a.opportunity) === "market_comparison" ? "answer" : pageTypeOf(a.opportunity);
  // D47: the listicle's table, laid out from the pack before a word is
  // written. The writer is handed the same one (`./write.ts`).
  const table = pack.type === "listicle" && template.blocks.table !== undefined ? comparisonTable(pack, template.blocks.table.rivals) : null;
  const writing = {
    template,
    pack,
    pageType,
    // An update with no live page to measure against never reaches here: its
    // pack is short. The fallback keeps the type total.
    length: length ?? { floor: 0, ceiling: Number.MAX_SAFE_INTEGER },
    ...(a.tier === undefined ? {} : { tier: a.tier }),
  };

  // 3. Write: one call.
  const written = await writePage(c, writing);
  if (written.kind === "unmeasured") return stepFailed(a.siteId, "write", a.draftId);

  const searches = pack.target.searches;
  const names = [a.site.businessName ?? "", a.site.domain.split(".")[0] ?? "", ...a.site.rivals];
  const passages = [...pack.facts.map((fact) => fact.passage), ...packStatements(pack)];
  const cited = pack.claims.map((claim) => ({ ...claim, readAt: new Date(claim.readAt) }));
  const tidy = {
    // Both pools: a quotation stands where it is either's exact words.
    sources: [...pack.facts, ...pack.claims].map((fact) => ({ passage: fact.passage, url: fact.url })),
    facts: [...passages, ...pack.claims.map((claim) => claim.passage)],
    promises: pack.profile?.promises ?? [],
    queries: searches,
    names: [...names, ...pack.products.map((product) => product.domain.split(".")[0] ?? "")],
  };
  const linking = {
    domain: a.site.domain,
    targets: a.links,
    groundedUrl: grounding.fact.url,
    factUrls: pack.facts.map((fact) => fact.url),
  };

  /** The parts laid out as the page (SPEC §7, issue 1137): the body's links
   *  held to the chosen pages, no table cell left empty, the closing line
   *  last, and the sources list of the market pages the body cites — written
   *  here and never by the model (issue 1135). A listicle's table is the one
   *  code built, under its at-a-glance section's opening paragraph (D47). */
  const finish = (parts: PageParts): Finished => {
    const laid = layoutPage(parts, template, tidy);
    const own = laid.sections.find((section) => ["business", "next_step", "related"].includes(section.key))?.heading;
    const glance = laid.sections.find((section) => template.sections.find((slot) => slot.key === section.key)?.block === "table")?.heading;
    const body = table === null ? laid.body.bodyMarkdown : withTable(laid.body.bodyMarkdown, glance, table.markdown);
    const markdown = withSources(
      withClosing(
        completeTables(applyLinks(body, { ...linking, appendUnder: own })),
        applyLinks(laid.closing, { ...linking, appendMissing: false }),
        a.links[0]?.url ?? `https://${a.site.domain}/`
      ),
      cited
    );
    return { laid, markdown };
  };

  const metaOf = (page: Finished, repairs: readonly RepairRecord[], elsewhere: number | null): Record<string, unknown> => {
    const linked = new Set(linksOf(page.markdown).map(urlKey));
    const used = pack.facts.filter((fact) => linked.has(urlKey(fact.url)) || page.markdown.includes(fact.passage));
    return {
      ...baseMeta,
      description: page.laid.body.description,
      // "Three to six questions buyers ask, stored as `drafts.meta.faq`" —
      // beside the page, never in its body.
      faq: page.laid.faq,
      // Which of the template's sections each heading fills.
      sections: page.laid.sections,
      ...(page.laid.updated === "" ? {} : { updateNote: page.laid.updated }),
      // The business facts the page states or links, each with the page it
      // was read from (#931) — the grounded one always among them.
      factsUsed: [grounding.fact, ...used.filter((fact) => fact.passage !== grounding.fact.passage)].map((fact) => ({
        passage: fact.passage,
        url: fact.url,
      })),
      // Issue 1135: the market facts the page was handed.
      marketFacts: pack.claims.map((claim) => ({ passage: claim.passage, url: claim.url, title: claim.title, readAt: claim.readAt })),
      length: { words: bodyWords(page.markdown), floor: length?.floor ?? null, ceiling: length?.ceiling ?? null },
      ...(repairs.length === 0 ? {} : { repairs: [...priorRepairs, ...repairs] }),
      // A number and nothing else: which page it was is not recorded.
      ...(elsewhere === null ? {} : { elsewhere: { similarity: elsewhere } }),
    };
  };

  let page = finish(written.value);
  const draftId = await writeRow({ title: page.laid.body.title, body_md: page.markdown, meta: metaOf(page, [], null) });

  // 4. Check: code only, against this customer's own three sets.
  const comparison = await buildComparisonSet({ siteId: a.siteId, exceptDraftId: draftId });
  const briefRead = {
    facts: passages,
    queries: searches,
    marketFacts: pack.claims.map((claim) => ({ url: claim.url, passage: claim.passage })),
  };
  const battery = (candidate: Finished, markdown: string, fit?: BatteryOutcome["fit"]): Promise<BatteryOutcome> =>
    runHardRules(c, {
      ...(fit === undefined ? {} : { fit }),
      markdown,
      title: candidate.laid.body.title,
      rendered: renderOf(markdown),
      pageType,
      // D44: the one model check, on a listicle or comparison only.
      ...(pack.type === "listicle" && pack.profile?.knowledge !== undefined
        ? { knowledge: pack.profile.knowledge, market: pack.business.market }
        : {}),
      site: a.site,
      comparison,
      grounded: grounding.fact,
      sourceText: grounding.sourceText,
      brief: briefRead,
      factPages: pack.facts.map((fact) => fact.url),
      blocks: { template, sections: candidate.laid.sections, length, faq: candidate.laid.faq, domain: a.site.domain },
      ...(a.demoPhrases === undefined ? {} : { demoPhrases: a.demoPhrases }),
    });

  /** One page through stage 4: the checks, the repairs code can make (#1178)
   *  kept only where the page then passes, and the pages written for other
   *  sites (D13) where the rules passed. */
  const check = async (candidate: Finished) => {
    let markdown = candidate.markdown;
    let outcome = await battery(candidate, markdown);
    const repairs: RepairRecord[] = [];
    const tried = outcome.passed || outcome.fit.state === "unrun" ? [] : repairable(outcome.failed);
    if (tried.length > 0) {
      const repaired = withSources(
        repairMechanical(markdown, tried, {
          brief: briefRead,
          sources: [
            ...a.facts.map((sourced) => ({ url: sourced.fact.url, text: sourced.sourceText })),
            ...pack.claims.map((claim) => ({ url: claim.url, text: claim.passage })),
          ],
          rivals: a.site.rivals,
        }),
        cited
      );
      const again = repaired === markdown ? null : await battery(candidate, repaired, outcome.fit);
      const still = new Set(again === null || again.passed ? [] : again.failed.map((failure) => failure.rule));
      for (const rule of tried) repairs.push({ rule, cleared: again !== null && !still.has(rule) });
      console.log(JSON.stringify({ event: "draft_repaired", siteId: a.siteId, draftId, repairs }));
      // Kept where the page then passes, and where it at least fails fewer
      // checks and no new one: the fix call is then told only what code
      // could not put right.
      const before = new Set(outcome.passed ? [] : outcome.failed.map((failure) => failure.rule));
      const fewer = again !== null && !again.passed && again.failed.length < before.size && again.failed.every((failure) => before.has(failure.rule));
      if (again !== null && (batteryCleared(again) || fewer)) {
        markdown = repaired;
        outcome = again;
      }
    }
    const close = batteryCleared(outcome) ? await closeElsewhere({ siteId: a.siteId, markdown }) : null;
    return { page: { ...candidate, markdown }, outcome, repairs, close };
  };

  const record = async (checked: Awaited<ReturnType<typeof check>>, repairs: readonly RepairRecord[], attempts: number | null): Promise<void> => {
    await store.patchDraft(draftId, {
      title: checked.page.laid.body.title,
      body_md: checked.page.markdown,
      meta: metaOf(checked.page, repairs, checked.close?.similarity ?? null),
      claim_check: recordedVerdictValue(checked.outcome.claim),
      // Written on every run — the empty array on a run that found nothing,
      // because "the checks ran and passed" and "no check has touched this
      // row" are different facts (#424).
      rule_failures: recordedRulesValue(checked.outcome),
      cost_cents: c.spentCents(),
      // The publishing engine's guard on `generating → in_review`, written
      // here and nowhere else. An unrun fit check leaves it false: "we could
      // not check" is not "it passed".
      hard_rules_passed: batteryCleared(checked.outcome) && checked.close === null,
      ...(attempts === null ? {} : { hard_rule_attempts: attempts }),
    });
  };

  /** What the fix call is told: each check failed and what failed it — and,
   *  for the length, the count against the range, which no sentence shows. */
  const notesFor = (stopped: Awaited<ReturnType<typeof check>>): FixNote[] => {
    if (stopped.outcome.passed) return [];
    const words = pack.type === "update" ? sectionWords(stopped.page.markdown) : bodyWords(stopped.page.markdown);
    return fixNotes(stopped.page.markdown, stopped.outcome.failed, briefRead, a.site, stopped.page.laid.body.title).map((note) => {
      if (note.rule === "required_blocks" && note.sentences.includes("length") && length !== null) {
        return { ...note, sentences: [`length: ${pack.type === "update" ? "the sections have" : "the body has"} ${words} words and must have between ${length.floor} and ${length.ceiling}`] };
      }
      if (note.rule === "first_block_answers") {
        const box = PAGE_BLOCKS.answerWords;
        return { ...note, sentences: [`answer: it has ${answerBoxWords(stopped.page.markdown)} words and must be one paragraph of ${box.min} to ${box.max} that does not end in a question`] };
      }
      return note;
    });
  };

  const attemptsBefore = existing?.hard_rule_attempts ?? 0;
  let checked = await check(page);
  let repairs = checked.repairs;
  let fixed = false;

  // The one fix call: each check the page failed, and the sentences that
  // failed it. Not started without the money or the time for it.
  const stopped = !checked.outcome.passed || checked.close !== null;
  if (stopped && checked.outcome.fit.state !== "unrun") {
    await record(checked, repairs, attemptsBefore + 1);
    const notes = notesFor(checked);
    const canFix = !c.capHit() && Date.now() - startedAt < PIPELINE.fixBeforeMs;
    const again = canFix
      ? await fixPage(c, {
          ...writing,
          parts: written.value,
          fix: notes,
          ...(checked.close === null ? {} : { apart: checked.close.sentences }),
        })
      : null;
    if (again === null || again.kind === "unmeasured") {
      logRun({ siteId: a.siteId, draftId, step: "fix", outcome: again === null ? "not_started" : "step_failed" });
      if (checked.outcome.passed) return { ok: false, reason: "step_failed", draftId, step: "elsewhere" };
      return {
        ok: false,
        reason: "rules",
        draftId,
        failed: checked.outcome.failed,
        attempt: attemptsBefore + 1,
        recovery: "rest",
        fix: notes,
      };
    }
    fixed = true;
    page = finish(again.value);
    checked = await check(page);
    repairs = [...repairs, ...checked.repairs];
  }

  const failedNow = !checked.outcome.passed;
  await record(checked, repairs, fixed && failedNow ? attemptsBefore + 2 : null);

  if (checked.outcome.fit.state === "unrun") {
    logRun({ siteId: a.siteId, draftId, step: "fit_check", outcome: checked.outcome.fit.reason });
    return { ok: false, reason: "step_failed", draftId, step: "fit_check" };
  }
  if (checked.outcome.passed && checked.close !== null) {
    logRun({ siteId: a.siteId, draftId, step: "elsewhere", outcome: "too_close", similarity: checked.close.similarity });
    return { ok: false, reason: "step_failed", draftId, step: "elsewhere" };
  }
  if (checked.outcome.passed) {
    logRun({ siteId: a.siteId, draftId, outcome: "passed", type: pack.type, fixed, costCents: Math.round(c.spentCents()) });
    return { ok: true, draftId, grounded: grounding.fact };
  }

  // A page its fix call did not clear is stopped: never queued, no day taken.
  const attempt = attemptsBefore + 2;
  logRun({ siteId: a.siteId, draftId, outcome: "rules", attempt, type: pack.type });
  return {
    ok: false,
    reason: "rules",
    draftId,
    failed: checked.outcome.failed,
    attempt,
    recovery: recoveryOutcome({
      failed: checked.outcome.failed.map((failure) => failure.rule),
      automaticAttempts: attempt - 1,
      enteredReview: false,
    }),
    fix: notesFor(checked),
  };
}

/** The repairs an earlier attempt recorded on this row. */
function recordedRepairs(meta: unknown): RepairRecord[] {
  const value = (meta as { repairs?: unknown } | null)?.repairs;
  return Array.isArray(value) ? (value as RepairRecord[]) : [];
}

/** Hard rule 1 with nothing to stand on: no page of the customer's yielded a
 *  passage. Nothing was written, so there is no row to count an attempt on. */
function noFact(siteId: string): GenerateOutcome {
  const failed: RuleFailure[] = [{ rule: "grounding" }];
  logRun({ siteId, outcome: "rules", failed: "grounding", attempt: 1 });
  return { ok: false, reason: "rules", draftId: null, failed, attempt: 1, recovery: "rest" };
}

/** Hard rule 1 on a rewrite: the passage the row records is no longer on
 *  the customer's pages, and the trigger will not let the row stand on
 *  another. The failure is recorded on that row and counted like any other,
 *  so the caller rests it where the customer can see why. */
async function lostFact(siteId: string, row: DraftRow): Promise<GenerateOutcome> {
  const failed: RuleFailure[] = [{ rule: "grounding" }];
  const attempt = row.hard_rule_attempts + 1;
  await generateStore().patchDraft(row.id, { rule_failures: failed, hard_rule_attempts: attempt, hard_rules_passed: false });
  logRun({ siteId, draftId: row.id, outcome: "rules", failed: "grounding", attempt });
  return { ok: false, reason: "rules", draftId: row.id, failed, attempt, recovery: "rest" };
}

/** A step that did not run. On a rewrite the date's row already exists, and
 *  the failure names it so the caller can rest it (#813). */
function stepFailed(siteId: string, step: PipelineStep, draftId: string | undefined): GenerateOutcome {
  logRun({ siteId, step, outcome: "step_failed" });
  return { ok: false, reason: "step_failed", draftId: draftId ?? null, step };
}
