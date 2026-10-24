// SPEC §6 (#1160) — the tracked-prompt answers a pass paid for and did not
// wait for, read after it.
//
// A weekly pass asks its tracked prompts on the standard queue and stops
// waiting `TIMING.paidPassAskReserveS` before its ceiling. On 2026-10-05
// that left 50 of 50 ChatGPT asks and 23 of 50 AI Mode asks unanswered,
// each billed, in a pass that ended `complete`. The vendor still finishes
// those tasks, and reading one is free. So the ledger row keeps the task's
// id, and this reads the answers in a job step of its own, before the week
// is judged and told. It buys nothing and raises no cap.
//
// Only the tracked prompts are read here: their answers are a list on the
// report, so a late one joins it without the pass being scored again. A
// question's SERP that was not ready stays unmeasured for the week.
import { dbAdmin } from "@/lib/db";
import { readPromptAnswer } from "@/lib/market/prompts/answer";
import { PROMPT_ENGINES, localeOfReport, readStoredReport, type PromptAnswer, type PromptEngine, type PromptsSection } from "../report";

/** A ledger row of an ask that was posted, billed and left in the queue. */
export interface LateRow {
  readonly id: string;
  readonly source: string;
  readonly cache_key: string;
  readonly payload: unknown;
}

/** One of those rows as the ask it was: which prompt, engine and run. */
export interface LateAsk {
  readonly rowId: string;
  readonly taskId: string;
  readonly promptId: string;
  readonly engine: PromptEngine;
  readonly run: number;
}

const same = (a: Pick<PromptAnswer, "promptId" | "engine" | "run">, b: Pick<PromptAnswer, "promptId" | "engine" | "run">) =>
  a.promptId === b.promptId && a.engine === b.engine && a.run === b.run;

/**
 * The rows that are asks of this section's prompts and have no answer on it
 * yet. A row's key begins with the prompt's own text and ends with its run
 * (`ai.ts`), so nothing is stored twice to find it. A row for anything else
 * the pass asked those engines — a page question — is not one.
 */
export function lateAsksOf(
  section: PromptsSection,
  rows: readonly LateRow[],
  sources: Readonly<Record<PromptEngine, string>>
): LateAsk[] {
  const asks: LateAsk[] = [];
  for (const row of rows) {
    const engine = PROMPT_ENGINES.find((name) => sources[name] === row.source);
    const taskId = (row.payload as { taskId?: unknown } | null)?.taskId;
    const prompt = section.asked.find((asked) => row.cache_key.startsWith(`${asked.text}|`));
    if (engine === undefined || prompt === undefined || typeof taskId !== "string" || taskId === "") continue;
    const run = Number(/\|run:(\d+)$/.exec(row.cache_key)?.[1] ?? 1);
    const ask = { rowId: row.id, taskId, promptId: prompt.id, engine, run };
    if (section.answers.some((answer) => same(answer, ask)) || asks.some((other) => same(other, ask))) continue;
    asks.push(ask);
  }
  return asks;
}

/** The section with the late answers on it. An ask is never counted twice. */
export function withLateAnswers(section: PromptsSection, late: readonly PromptAnswer[]): PromptsSection {
  const answers = [...section.answers];
  for (const answer of late) if (!answers.some((held) => same(held, answer))) answers.push(answer);
  return { ...section, answers };
}

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  update(values: Record<string, unknown>): Query<T>;
  eq(column: string, value: string): Query<T>;
  in(column: string, values: readonly string[]): Query<T>;
  not(column: string, operator: string, value: null): Query<T>;
}

function table<T>(name: string): Query<T> {
  return (dbAdmin() as unknown as { from(table: string): Query<T> }).from(name);
}

function isSection(value: unknown): value is PromptsSection {
  if (typeof value !== "object" || value === null) return false;
  const section = value as Record<string, unknown>;
  return Array.isArray(section.asked) && Array.isArray(section.answers) && typeof section.siteName === "string";
}

async function readRawReport(scanId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await table<{ report: Record<string, unknown> | null }>("scans").select("report").eq("id", scanId);
  if (error !== null) throw new Error(error.message);
  return data?.[0]?.report ?? null;
}

/** What one round of reading came to. `left` is the asks still queued. */
export interface Collected {
  readonly asks: number;
  readonly answered: number;
  readonly left: number;
}

const NOTHING: Collected = Object.freeze({ asks: 0, answered: 0, left: 0 });

/**
 * Reads the pass's queued tracked-prompt answers until `untilMs`, stores
 * each on its ledger row and on the report, and records the pass's health
 * again over what it now holds. Never throws: the week is told either way.
 */
export async function collectLateAnswers(a: {
  scanId: string;
  siteId: string;
  domain: string;
  untilMs: number;
}): Promise<Collected> {
  try {
    const { AI_ANSWER_SOURCES, collectAiAnswer } = await import("@/lib/vendors/dataforseo/ai");
    const { data, error } = await table<LateRow>("fetches")
      .select("id, source, cache_key, payload")
      .eq("scan_id", a.scanId)
      .in("source", Object.values(AI_ANSWER_SOURCES))
      .not("payload->>taskId", "is", null);
    if (error !== null) throw new Error(error.message);
    if (data === null || data.length === 0) return NOTHING;

    const first = await readRawReport(a.scanId);
    const section = first?.prompts;
    if (!isSection(section)) return NOTHING;
    const asks = lateAsksOf(section, data, AI_ANSWER_SOURCES);
    if (asks.length === 0) return NOTHING;

    const { readSiteMarket } = await import("@/lib/market/infer/stored");
    const rivals = (await readSiteMarket(a.siteId))?.stored.current?.rivals ?? [];
    // Issue 1539: the language the prompts were asked in, as the pass stored it.
    const language = first === null ? "en" : localeOfReport(readStoredReport(first)).language;

    const late: PromptAnswer[] = [];
    const settled: { rowId: string; payload: unknown }[] = [];
    let left = 0;
    await Promise.all(
      asks.map(async (ask) => {
        const got = await collectAiAnswer({ engine: ask.engine, taskId: ask.taskId, untilMs: a.untilMs });
        if (got.kind === "pending") {
          left += 1;
          return;
        }
        settled.push({
          rowId: ask.rowId,
          payload:
            got.kind === "answer"
              ? got.rows
              : { vendorFailure: got.failure, endpoint: AI_ANSWER_SOURCES[ask.engine], billed: true },
        });
        const answer = got.kind === "answer" ? got.rows[0] : undefined;
        if (answer === undefined || !answer.answered) return;
        const reading = readPromptAnswer({
          text: answer.text,
          citedDomains: answer.citedDomains,
          citedUrls: answer.citedUrls ?? [],
          ownDomain: a.domain,
          siteName: section.siteName,
          rivals,
          language,
        });
        late.push({
          promptId: ask.promptId,
          engine: ask.engine,
          run: ask.run,
          named: reading.named,
          linked: reading.linked,
          ownUrls: reading.ownUrls,
          rivals: reading.rivals,
          ...(reading.alternatives.length === 0 ? {} : { alternatives: reading.alternatives }),
          ...(reading.cited.length === 0 ? {} : { cited: reading.cited }),
          ...(reading.states.length === 0 ? {} : { states: reading.states }),
        });
      })
    );

    if (late.length > 0) {
      // Read again: the wait above is minutes long.
      const raw = await readRawReport(a.scanId);
      if (raw === null || !isSection(raw.prompts)) throw new Error("the report holds no tracked prompts");
      const report = { ...raw, prompts: withLateAnswers(raw.prompts, late) };
      const { error: failed } = await table<{ id: string }>("scans").update({ report }).eq("id", a.scanId);
      if (failed !== null) throw new Error(failed.message);
      const { recordPassHealth } = await import("../health-record");
      await recordPassHealth({ ...a, report: readStoredReport(report), asksPrompts: true });
    }
    // After the report holds them: each row now says what its task came to,
    // so it is not read again, and an answer is served to a later ask of
    // the same day. A row this fails on is read again next round, and its
    // answer is not counted twice.
    await Promise.all(settled.map((row) => table<LateRow>("fetches").update({ payload: row.payload }).eq("id", row.rowId)));
    const collected = { asks: asks.length, answered: late.length, left };
    console.log(JSON.stringify({ event: "weekly_late_answers", scanId: a.scanId, ...collected }));
    return collected;
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "weekly_late_answers_failed",
        scanId: a.scanId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
    return NOTHING;
  }
}
