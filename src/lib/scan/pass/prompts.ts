// src/lib/scan/pass/prompts.ts — asking the AI engines the market's prompts, the tracked prompts and the page questions.
import { PAGE_QUESTION_RETIRE_WEEKS, TRACKED_PROMPTS } from "@/lib/config/constants";
import { EVIDENCE_BOUNDS } from "@/lib/market/infer/evidence";
import { spokenMarket } from "@/lib/market/infer/terms";
import { buyerPrompts } from "@/lib/market/questions/buyer-prompts";
import { readPromptAnswer } from "@/lib/market/prompts/answer";
import { panelOf } from "@/lib/market/prompts/generate";
import { promptSiteName } from "@/lib/market/prompts/names";
import { nextPromptSet, type TrackedPrompt } from "@/lib/market/prompts/set";
import { slotDepth, trackedQuestions } from "@/lib/market/questions/tracked";
import { askedIn } from "@/lib/locale/place";
import { classifyReferences } from "@/lib/measure";
import { unmeasured } from "@/lib/measure/measured";
import { aiMode, llmScraper, serpOrganic } from "@/lib/vendors/dataforseo";
import { pageQuestionCandidates, pageQuestionMisses } from "../page-questions";
import { PROMPT_ENGINES, type MarketPromptAnswer, type PromptAnswer, type PromptEngine } from "../report";
import { attempt, cacheScope, failed, localeOfPass, noBattery, queueOf, serpAbortFor, serpWindowOf, type StageArgs, untilCeiling } from "./sections";
import { askTheBattery, newEngineWatch } from "./battery";

/** The market's buyer prompts, asked of AI Mode beside the twelve inside their budget, clock, cap and deadline. Built from the market this pass concluded,
 *  so a pass that moved to a new market reads who answers in it before its rivals are concluded. Never in the score; an unanswered prompt is left out; never throws. */
export async function askTheMarketPrompts(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  if (!parameters.battery || parameters.marketPrompts === 0 || sections.market === null) return;
  // Asked in the words buyers search, for the buyer the founder named.
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
      // The score's own reading of linked and named.
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

/** The site's AI panel, asked by the weekly pass and a founder's re-measure beside the twelve, inside the same clock, `WEEKLY` cap and deadline.
 *  The set is `sites.tracked_prompts`: drawn from the twelve and their runners-up once, then rotated only as `nextPromptSet` allows. Each item is asked
 *  of AI Mode as searched and of ChatGPT as its closest "People also ask" question on the current report, `TRACKED_PROMPTS.RUNS` times, each run with its own cache key.
 *  Each answer's reading is stored, never the prose; an unanswered ask leaves the denominator. Its answers join the rival evidence. Never throws. */
export async function askTheTrackedPrompts(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections, siteId } = a;
  const asks = parameters.trackedPrompts || (a.asksTrackedPrompts === true && parameters.battery);
  if (!asks || siteId === undefined || bounds.stopNow() !== null) return;
  // Each day's asks are their own samples: without the day in the key, a Monday pass two days after a re-measure would be served its answers.
  // A retry the same day is served what it already bought.
  const asOf = a.startedAt.toISOString().slice(0, 10);
  try {
    const [{ readPromptSet, writePromptSet }, { readSiteMarket }, { readSiteProfile }] = await Promise.all([
      import("@/lib/market/prompts/store"),
      import("@/lib/market/infer/stored"),
      import("@/lib/site-profile/store"),
    ]);
    const market = sections.market ?? (await readSiteMarket(siteId))?.stored.current ?? null;
    if (market === null) {
      console.log(JSON.stringify({ event: "tracked_prompts", asked: 0, because: "no_market" }));
      return;
    }
    const profile = await readSiteProfile(a.domain);
    const siteName = promptSiteName(profile?.siteName ?? null, a.domain);
    const pages = await import("@/lib/known-content/ours").then(({ readServedPages }) => readServedPages(siteId, profile?.inventory));
    const stored = await readPromptSet(siteId);
    // The twelve as this pass asks them, then the runners-up.
    const twelve = sections.questions.kind === "unmeasured" ? sections.selected : sections.questions.value.map((question) => question.search);
    const searches = [...twelve.map((search) => search.keyword), ...sections.runnersUp];
    const { language, place } = localeOfPass(a);
    const panel = searches.length === 0 ? [] : panelOf({ searches, questions: await storedQuestions(siteId), siteName, rivals: market.rivals, language, ...(place === undefined ? {} : { place }) });
    const set = nextPromptSet(stored, panel, new Date());
    if (set.prompts.length === 0 || sections.sealed) return;
    if (set !== stored) await writePromptSet(siteId, set);
    if (set.rebuiltAt !== undefined && set.rebuiltAt !== stored.rebuiltAt) {
      console.log(JSON.stringify({ event: "tracked_prompts_rebuilt", siteId, from: stored.prompts.length, to: set.prompts.length }));
    }

    const answers: PromptAnswer[] = [];
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
          ? llmScraper(cost, { query: prompt.question ?? prompt.text, mode: "std", scope, locale, untilMs, run, asOf })
          : // The standard queue on every tier: the same ask whichever pass makes it, at one price.
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
        town: locale.place?.name,
        pages,
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
        ...(reading.possiblyOther ? { possiblyOther: true as const } : {}),
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
        for (let run = 1; run <= TRACKED_PROMPTS.RUNS; run += 1) asks.push(askOne(prompt, engine, run));
      }
    }
    await Promise.all(asks);

    console.log(
      JSON.stringify({ event: "tracked_prompts", prompts: set.prompts.length, asked, answered: answers.length })
    );
    if (sections.sealed) return;
    sections.prompts = {
      siteName,
      asked: set.prompts.map((prompt) => ({ id: prompt.id, kind: prompt.kind, text: prompt.text, ...(prompt.question === undefined ? {} : { question: prompt.question }) })),
      asks: set.prompts.length * PROMPT_ENGINES.length * TRACKED_PROMPTS.RUNS,
      ...(set.rebuiltAt === undefined ? {} : { restartedAt: set.rebuiltAt }),
      answers: answers.map((answer) => ({
          promptId: answer.promptId,
          engine: answer.engine,
          run: answer.run,
          named: answer.named,
          linked: answer.linked,
          ownUrls: answer.ownUrls,
          rivals: answer.rivals,
          ...(answer.alternatives === undefined ? {} : { alternatives: answer.alternatives }),
          ...(answer.cited === undefined ? {} : { cited: answer.cited }),
        })),
    };
    for (const answer of evidence.values()) sections.marketPrompts.push(answer);
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "tracked_prompts_failed",
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/** The "People also ask" questions on the SERPs of the site's current report; none where it cannot be read. Read from `scans`, never `fetches`. */
async function storedQuestions(siteId: string): Promise<string[]> {
  try {
    const [{ opportunityStore }, { askedOfReport }] = await Promise.all([import("@/lib/opportunities/store"), import("@/lib/opportunities/derive/topics")]);
    const report = await opportunityStore().currentReport(siteId);
    return report === null ? [] : askedOfReport(report).flatMap((serp) => serp.peopleAlsoAsk);
  } catch {
    return [];
  }
}

/** The published pages' own questions, asked after the twelve inside their budget, each with one SERP (its AI Overview free) and the battery's two engines.
 *  Which questions is decided elsewhere and purely (`trackedQuestions`, `page-questions.ts`). It is the first thing a short pass loses: every worker
 *  re-reads cap and clock before a question, so a ceiling stops the pages and never the market. It writes its own three arrays, which no score reads.
 *  Per question at most 0.9¢ at standard prices; only the first twelve slots read deep, so the most is 10.8¢ + 4.32¢ against `CAPS.WEEKLY_C`,
 *  however many pages the customer has published. */
export async function askThePageQuestions(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, parameters, sections, siteId } = a;
  if (!parameters.pageQuestions || siteId === undefined) return;
  if (abandoned() || bounds.stopNow() !== null) return;

  const at = sections.questions.at;
  const selected = sections.questions.kind === "unmeasured" ? 0 : sections.questions.value.length;
  const [candidates, misses, market] = await Promise.all([
    pageQuestionCandidates({ siteId, ownRankedRows: sections.measurement?.ownRankedRows ?? [] }),
    pageQuestionMisses(siteId),
    // The rivals the tracked prompts read answers for; an unreadable market leaves each answer's rivals unread, never none.
    sections.market ?? import("@/lib/market/infer/stored").then(({ readSiteMarket }) => readSiteMarket(siteId)).then((m) => m?.stored.current ?? null, () => null),
  ]);
  if (candidates.length === 0) return;
  sections.pageRivals = market?.rivals ?? null;

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

/** One line per pass over the page questions: candidates, slots, retired, waiting. No customer, page or question text. */
function logPageQuestions(fields: {
  candidates: number;
  asking: number;
  retired: number;
  waiting: number;
  tracked: number;
}): void {
  console.log(JSON.stringify({ event: "page_questions", ...fields }));
}
