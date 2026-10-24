// src/lib/scan/pass/prompts.ts — asking the AI engines the market's prompts, the tracked prompts and the page questions.
import { PAGE_QUESTION_RETIRE_WEEKS, TRACKED_PROMPTS } from "@/lib/config/constants";
import { EVIDENCE_BOUNDS } from "@/lib/market/infer/evidence";
import { searchedName, spokenMarket } from "@/lib/market/infer/terms";
import { buyerPrompts } from "@/lib/market/questions/buyer-prompts";
import { readPromptAnswer } from "@/lib/market/prompts/answer";
import { generatePrompts, promptSiteName } from "@/lib/market/prompts/generate";
import { nextPromptSet, settlePrechecks, type TrackedPrompt } from "@/lib/market/prompts/set";
import { slotDepth, trackedQuestions } from "@/lib/market/questions/tracked";
import { askedIn } from "@/lib/locale/place";
import { classifyReferences } from "@/lib/measure";
import { unmeasured } from "@/lib/measure/measured";
import { aiMode, llmScraper, serpOrganic } from "@/lib/vendors/dataforseo";
import { pageQuestionCandidates, pageQuestionMisses } from "../page-questions";
import { PROMPT_ENGINES, type MarketPromptAnswer, type PromptAnswer, type PromptEngine } from "../report";
import { attempt, cacheScope, failed, localeOfPass, noBattery, queueOf, serpAbortFor, serpWindowOf, type StageArgs, untilCeiling } from "./sections";
import { askTheBattery, newEngineWatch } from "./battery";

/**
 * The market's buyer prompts (#1195), asked of AI Mode beside the twelve
 * and inside their budget: the same clock, the same cap and the same
 * deadline before the ceiling. Built from the market this pass concluded
 * (`buyerPrompts`), so a pass that moved the site to a new market reads
 * who answers in it before its rivals are concluded — the twelve may still
 * be thin there. Never in the score. A prompt that did not answer is left
 * out; nothing here throws.
 */
export async function askTheMarketPrompts(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  if (!parameters.battery || parameters.marketPrompts === 0 || sections.market === null) return;
  // D49: asked in the words buyers search, for the buyer the founder named.
  const prompts = buyerPrompts(spokenMarket(sections.market, sections.founderBuyer), parameters.marketPrompts, localeOfPass(a).language, localeOfPass(a).place);
  await Promise.all(
    prompts.map(async (prompt) => {
      if (bounds.stopNow() !== null) return;
      const got = await attempt("asking_the_twelve", () =>
        aiMode(cost, {
          query: prompt,
          locale: localeOfPass(a),
          mode: parameters.serpMode,
          scope: cacheScope(a),
          untilMs: untilCeiling(bounds, parameters),
          abortMs: serpAbortFor(bounds, parameters),
        })
      );
      if (sections.sealed || failed(got) || got.kind === "unmeasured" || !got.value.answered) return;
      const cited = got.value.citedDomains.map((d) => d.toLowerCase().replace(/^www\./, ""));
      const text = got.value.text;
      // Issue 1420: the score's own reading of linked and named.
      const reading = classifyReferences(got.value.citedDomains, a.domain, { urls: got.value.citedUrls ?? [], text, siteName: sections.siteName });
      sections.marketPrompts.push({
        prompt,
        citedDomains: cited,
        namesSite: reading.cited || reading.mentioned,
        excerpt: text.slice(0, EVIDENCE_BOUNDS.excerptChars),
      });
    })
  );
  console.log(
    JSON.stringify({ event: "market_prompts", asked: prompts.length, answered: sections.marketPrompts.length })
  );
}

/**
 * SPEC §6 (owner, D19 final and D33 of 2026-10-03, #1162) — the site's
 * tracked buyer prompts, asked by the weekly pass and by a founder's
 * re-measure (owner, 2026-10-03), beside the twelve and inside their budget:
 * the same clock, the same `WEEKLY` cap and the same deadline before the
 * ceiling.
 *
 * The set is the site's own (`sites.tracked_prompts`): built from the
 * market in force the first time, kept after that, and rotated only as
 * `nextPromptSet` allows. Every prompt is asked of both engines, an
 * unbranded one `TRACKED_PROMPTS.RUNS` times and a branded one
 * `TRACKED_PROMPTS.BRANDED_RUNS` times, all at once — a standard-queue ask costs
 * its wait whether one is queued or a hundred (#1160) — and each run has
 * its own cache key, so the second is a second answer and not the first
 * served again.
 *
 * What is stored is each answer's reading — named, linked, the site's own
 * pages cited, the rivals named — never the engine's prose. An ask that did
 * not answer is left out, so it leaves the rate's denominator. Unbranded
 * answers that are not comparisons also join the rival evidence, as the
 * deep pass's market prompts do (#1195). Nothing here throws.
 */
export async function askTheTrackedPrompts(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections, siteId } = a;
  const asks = parameters.trackedPrompts || (a.asksTrackedPrompts === true && parameters.battery);
  if (!asks || siteId === undefined || bounds.stopNow() !== null) return;
  // Each day's asks are their own samples: without the day in the key, a
  // Monday pass two days after a re-measure would be served the
  // re-measure's answers as a second week's measurement. A retry the same
  // day is served what it already bought.
  const asOf = a.startedAt.toISOString().slice(0, 10);
  try {
    const [{ readPromptSet, writePromptSet }, { readSiteMarket }, { readSiteProfile }, { readBusinessEdits }] =
      await Promise.all([
        import("@/lib/market/prompts/store"),
        import("@/lib/market/infer/stored"),
        import("@/lib/site-profile/store"),
        import("@/lib/site-profile/business/edits"),
      ]);
    const market = sections.market ?? (await readSiteMarket(siteId))?.stored.current ?? null;
    if (market === null) {
      console.log(JSON.stringify({ event: "tracked_prompts", asked: 0, because: "no_market" }));
      return;
    }
    const siteName = promptSiteName((await readSiteProfile(a.domain))?.siteName ?? null, a.domain);
    const stored = await readPromptSet(siteId);
    // D49: a prompt names the market by its searched terms, never by a
    // label nobody searches, and the buyer by the founder's own answer.
    const buyer =
      sections.market === null
        ? ((await readBusinessEdits(siteId).catch(() => null))?.answers.buyers ?? null)
        : sections.founderBuyer;
    // D54: a set built from another label is rebuilt whole from the search
    // term here, once.
    // D69: a set worded for software is rebuilt once for the kind of
    // business the market records, and D67: a local business's prompts
    // name its place.
    const set = nextPromptSet(
      stored,
      generatePrompts(spokenMarket(market, buyer), siteName, localeOfPass(a).language, localeOfPass(a).place),
      new Date(),
      searchedName(market),
      market.kind ?? null
    );
    if (set.prompts.length === 0 || sections.sealed) return;
    if (set !== stored) await writePromptSet(siteId, set);
    if (set.rebuiltAt !== undefined && set.rebuiltAt !== stored.rebuiltAt) {
      console.log(JSON.stringify({ event: "tracked_prompts_rebuilt", siteId, from: stored.prompts.length, to: set.prompts.length }));
    }

    const answers: (PromptAnswer & { namesABrand: boolean })[] = [];
    const evidence = new Map<string, MarketPromptAnswer>();
    let asked = 0;
    const askOne = async (prompt: TrackedPrompt, engine: PromptEngine, run: number): Promise<void> => {
      if (bounds.stopNow() !== null) return;
      asked += 1;
      const scope = cacheScope(a);
      const untilMs = untilCeiling(bounds, parameters);
      const locale = localeOfPass(a);
      const got = await attempt("asking_the_twelve", () =>
        engine === "chatgpt"
          ? llmScraper(cost, { query: prompt.text, mode: "std", scope, locale, untilMs, run, asOf })
          : // The standard queue on every tier: the measure is the same
            // ask whichever pass makes it, at the price D19 was costed at.
            aiMode(cost, { query: prompt.text, mode: "std", scope, locale, untilMs, run, asOf, abortMs: serpAbortFor(bounds, parameters) })
      );
      if (failed(got) || got.kind === "unmeasured" || !got.value.answered) return;
      const reading = readPromptAnswer({
        text: got.value.text,
        citedDomains: got.value.citedDomains,
        citedUrls: got.value.citedUrls ?? [],
        ownDomain: a.domain,
        siteName,
        rivals: market.rivals,
        language: locale.language,
      });
      answers.push({
        promptId: prompt.id,
        engine,
        run,
        named: reading.named,
        linked: reading.linked,
        ownUrls: reading.ownUrls,
        rivals: reading.rivals,
        ...(reading.alternatives.length === 0 ? {} : { alternatives: reading.alternatives }),
        ...(reading.cited.length === 0 ? {} : { cited: reading.cited }),
        ...(reading.states.length === 0 ? {} : { states: reading.states }),
        namesABrand: reading.namesABrand,
      });
      if (prompt.kind !== "branded" && prompt.kind !== "comparison" && !evidence.has(prompt.id)) {
        evidence.set(prompt.id, {
          prompt: prompt.text,
          citedDomains: got.value.citedDomains.map((d) => d.toLowerCase().replace(/^www\./, "")),
          namesSite: reading.named || reading.linked,
          excerpt: got.value.text.slice(0, EVIDENCE_BOUNDS.excerptChars),
        });
      }
    };
    const asks: Promise<void>[] = [];
    for (const prompt of set.prompts) {
      for (const engine of PROMPT_ENGINES) {
        for (let run = 1; run <= runsOf(prompt); run += 1) asks.push(askOne(prompt, engine, run));
      }
    }
    await Promise.all(asks);

    // D33: a prompt rotated in stays only if an answer to it named a brand.
    const verdicts = new Map<string, "keep" | "drop">();
    for (const prompt of set.prompts) {
      if (prompt.precheck !== true) continue;
      const own = answers.filter((answer) => answer.promptId === prompt.id);
      if (own.length > 0) verdicts.set(prompt.id, own.some((answer) => answer.namesABrand) ? "keep" : "drop");
    }
    const settled = settlePrechecks(set, verdicts);
    if (settled !== set) await writePromptSet(siteId, settled);

    console.log(
      JSON.stringify({ event: "tracked_prompts", prompts: settled.prompts.length, asked, answered: answers.length })
    );
    if (sections.sealed) return;
    const kept = new Set(settled.prompts.map((prompt) => prompt.id));
    sections.prompts = {
      siteName,
      asked: settled.prompts.map((prompt) => ({ id: prompt.id, kind: prompt.kind, text: prompt.text })),
      asks: settled.prompts.reduce((sum, prompt) => sum + PROMPT_ENGINES.length * runsOf(prompt), 0),
      ...(settled.rebuiltAt === undefined ? {} : { restartedAt: settled.rebuiltAt }),
      answers: answers
        .filter((answer) => kept.has(answer.promptId))
        .map((answer) => ({
          promptId: answer.promptId,
          engine: answer.engine,
          run: answer.run,
          named: answer.named,
          linked: answer.linked,
          ownUrls: answer.ownUrls,
          rivals: answer.rivals,
          ...(answer.alternatives === undefined ? {} : { alternatives: answer.alternatives }),
        })),
    };
    for (const [id, answer] of evidence) if (kept.has(id)) sections.marketPrompts.push(answer);
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "tracked_prompts_failed",
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * SPEC §6 (2026-09-20, #908 · #919) — the published pages' own questions,
 * asked after the twelve and inside their budget.
 *
 * **Everything that decides *which* questions is pure and lives
 * elsewhere.** `trackedQuestions` holds the cap arithmetic and the
 * retirement (`src/lib/market/questions/tracked.ts`); `page-questions.ts`
 * holds the two reads it is answered from. This function asks what it is
 * handed, with the same two calls per question the twelve are asked with —
 * one SERP, whose AI Overview rides free, and the battery's two engines.
 *
 * **It is the first thing a short pass loses.** It runs after the twelve
 * in the same stage, under the same cap and the same clock, and every
 * worker re-reads both before taking a question — so a ceiling stops the
 * pages and never the market.
 *
 * **It writes to its own three arrays**, which no card, no rival
 * derivation, no coherence verdict and no score reads.
 *
 * At a tier that asks none, on a pass with no site, and on a site with no
 * live page, it returns having bought nothing and leaves the section
 * `null`. Per question, at the standard queue's prices: one SERP read to
 * `slotDepth` (`SERP_STD_C` 0.06¢ a page of ten, 0.66¢ at a hundred with the
 * AI Overview's one surcharge) plus ChatGPT (`CHATGPT_SCRAPE_STD_C` 0.12¢)
 * and AI Mode (`AI_MODE_STD_C` 0.12¢) — at most 0.9¢. Only the first twelve
 * slots read deep; a thin market's slots past them read ten (0.36¢), so the
 * most is 10.8¢ + 4.32¢ against `CAPS.WEEKLY_C`'s 40¢, and the figure does
 * not move with how many pages the customer has published, which is the
 * cap's whole purpose.
 */
export async function askThePageQuestions(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, parameters, sections, siteId } = a;
  if (!parameters.pageQuestions || siteId === undefined) return;
  if (abandoned() || bounds.stopNow() !== null) return;

  const at = sections.questions.at;
  const selected = sections.questions.kind === "unmeasured" ? 0 : sections.questions.value.length;
  const [candidates, misses] = await Promise.all([
    pageQuestionCandidates({ siteId, ownRankedRows: sections.measurement?.ownRankedRows ?? [] }),
    pageQuestionMisses(siteId),
  ]);
  if (candidates.length === 0) return;

  const tracked = trackedQuestions({ selected, candidates, misses, now: a.startedAt });
  logPageQuestions({
    candidates: candidates.length,
    asking: tracked.asked.length,
    retired: tracked.retired.length,
    waiting: tracked.waiting.length,
    tracked: tracked.tracked,
  });

  // The retirements are recorded whether or not a single question is then
  // asked: a question that has run out of weeks has left the set, and a
  // ceiling that stops the asking does not put it back.
  for (const page of tracked.retired) {
    sections.pageRetired.push({
      publicationId: page.publicationId,
      liveUrl: page.liveUrl,
      question: page.question,
      weeksWithoutMention: misses.get(page.publicationId) ?? PAGE_QUESTION_RETIRE_WEEKS,
    });
  }
  if (tracked.asked.length === 0 || abandoned()) return;

  // Every asked question's slot, on the arm that says we did not get to
  // it — the same shape `askTheTwelve` writes, so a page question a
  // ceiling stopped is `not_attempted` and never a miss.
  for (const candidate of tracked.asked) {
    sections.pageAsked.push(candidate);
    sections.pageSerps.push(unmeasured("not_attempted", at));
    sections.pageBattery.push(noBattery(at));
  }

  let next = 0;
  const engines = newEngineWatch();
  const buyOne = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      const candidate = tracked.asked[i];
      if (candidate === undefined) return;
      if (bounds.stopNow() !== null) continue;
      const [serp, battery] = await Promise.all([
        attempt("asking_the_twelve", () =>
          serpOrganic(a.cost, {
            query: candidate.search,
            locale: localeOfPass(a),
            mode: "std",
            ...queueOf(parameters),
            loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
            scope: cacheScope(a),
            freshnessDays: serpWindowOf(a),
            abortMs: serpAbortFor(bounds, parameters),
            untilMs: untilCeiling(bounds, parameters),
            depth: slotDepth(candidate, i),
          })
        ),
        askTheBattery(a, askedIn(candidate.question, localeOfPass(a).place), at, engines),
      ]);
      // The same seal the twelve are written under: a late answer is kept,
      // and a composed report is never written into.
      if (sections.sealed) return;
      sections.pageSerps[i] = failed(serp) ? unmeasured("undeterminable", at) : serp;
      sections.pageBattery[i] = battery;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(parameters.serpFanout, tracked.asked.length) }, () => buyOne())
  );
}

/** How many times each engine asks a tracked prompt in one pass. */
function runsOf(prompt: TrackedPrompt): number {
  return prompt.kind === "branded" ? TRACKED_PROMPTS.BRANDED_RUNS : TRACKED_PROMPTS.RUNS;
}

/** One line per pass over the page questions (#919): how many pages could
 *  carry one, how many the cap left room for, how many retired and how many
 *  are waiting for a slot. No customer, no page and no question text — the
 *  shape of the set, readable from the deployment log. */
function logPageQuestions(fields: {
  candidates: number;
  asking: number;
  retired: number;
  waiting: number;
  tracked: number;
}): void {
  console.log(JSON.stringify({ event: "page_questions", ...fields }));
}
