// The AI answers behind a site's marks on `/app/review`: the newest weekly pass's tracked-prompt answers, and the one
// the owner opens read again from its `fetches` row, found by the key the pass bought it under. Reads only, 0¢.
import { classifyReferences, namesOrLinks } from "@/lib/measure/drivers";
import { untyped } from "@/lib/opportunities/store";
import type { PromptAnswer, PromptEngine, PromptsSection } from "@/lib/scan/report";
import { AI_ANSWER_SOURCES, type AiAnswer } from "@/lib/vendors/dataforseo/types";

const EXCERPT_MAX = 300;

/** An answer as the report stores it; `possiblyOther` is the same-name guard's mark, absent on older answers. */
type StoredAnswer = PromptAnswer & { possiblyOther?: true };

/** Why an answer that does not count was dropped, by the guard that dropped it. */
export type Guard = "same_name" | "missing_link" | "cited_host";

export interface AnswerItem {
  question: string;
  engine: PromptEngine;
  run: number;
  counted: boolean;
}

/** The newest weekly pass that asked the tracked prompts. */
export interface SiteAnswers {
  scanId: string;
  day: string;
  siteName: string;
  items: AnswerItem[];
  answers: readonly StoredAnswer[];
}

export interface OpenedAnswer extends AnswerItem {
  day: string;
  /** `null` where the ledger row is gone or holds no text. */
  excerpt: { before: string; match: string; after: string } | null;
  cited: readonly string[];
  /** ChatGPT only: whether it ran searches; `null` where not recorded. */
  searched: boolean | null;
  model: string | null;
  guard: Guard | null;
}

const counts = (answer: StoredAnswer): boolean => namesOrLinks({ namesCustomer: answer.linked, ...(answer.named ? { named: true as const } : {}) });

export async function readSiteAnswers(siteId: string): Promise<SiteAnswers | null> {
  const { data, error } = await untyped()
    .from<{ id: string; created_at: string; prompts: PromptsSection | null }>("scans")
    .select("id, created_at, prompts:report->prompts")
    .eq("site_id", siteId)
    .eq("tier", "weekly")
    .not("report->prompts", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error !== null) throw new Error(`review.answers: ${error.message}`);
  const row = data?.[0];
  const section = row?.prompts;
  if (row === undefined || !Array.isArray(section?.answers) || !Array.isArray(section.asked)) return null;
  const asked = new Map(section.asked.map((prompt) => [prompt.id, prompt]));
  // The AI tile leaves out branded and unknown questions, so the list does too.
  const answers = section.answers.filter((answer) => { const kind = asked.get(answer.promptId)?.kind; return kind !== undefined && kind !== "branded"; });
  return {
    scanId: row.id,
    day: row.created_at.slice(0, 10),
    siteName: section.siteName,
    answers,
    items: answers.map((answer) => ({ question: asked.get(answer.promptId)?.text ?? "", engine: answer.engine, run: answer.run, counted: counts(answer) })),
  };
}

/** The guard that dropped an uncounted answer, from its stored reading and what the ledger says it cited. Pure. */
export function guardOf(answer: StoredAnswer, citedDomains: readonly string[], ownDomain: string): Guard | null {
  if (counts(answer)) return null;
  if (answer.possiblyOther === true) return "same_name";
  const { cited, mentioned } = classifyReferences(citedDomains, ownDomain);
  return cited ? "missing_link" : mentioned ? "cited_host" : null;
}

/** At most `EXCERPT_MAX` characters around the first place the answer names the site, the name marked. Pure. */
export function excerptOf(text: string, names: readonly string[]): OpenedAnswer["excerpt"] {
  if (text.trim() === "") return null;
  const lower = text.toLowerCase();
  const hit = names.filter((name) => name.trim() !== "").map((name) => ({ at: lower.indexOf(name.toLowerCase()), length: name.length })).find((one) => one.at >= 0);
  if (hit === undefined) return { before: text.slice(0, EXCERPT_MAX), match: "", after: "" };
  const length = Math.min(hit.length, EXCERPT_MAX);
  const from = Math.max(0, hit.at - Math.floor((EXCERPT_MAX - length) / 2));
  const to = Math.min(text.length, from + EXCERPT_MAX);
  return { before: text.slice(from, hit.at), match: text.slice(hit.at, hit.at + length), after: text.slice(hit.at + length, to) };
}

const likeEscaped = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const runOf = (key: string) => Number(/\|run:(\d+)$/.exec(key)?.[1] ?? 1);

/** The `n`th answer of `read`, its pass's ledger row found by prompt text, engine, site, pass day and run. */
export async function openAnswer(read: SiteAnswers, n: number, site: { id: string; domain: string }): Promise<OpenedAnswer | null> {
  const answer = read.answers[n], item = read.items[n];
  if (answer === undefined || item === undefined) return null;
  const { data, error } = await untyped()
    .from<{ cache_key: string; payload: unknown }>("fetches")
    .select("cache_key, payload")
    .eq("scan_id", read.scanId)
    .eq("source", AI_ANSWER_SOURCES[answer.engine])
    .like("cache_key", `${likeEscaped(item.question)}|%|site:${site.id}|asof:${read.day}%`)
    .order("created_at", { ascending: false });
  if (error !== null) throw new Error(`review.answer: ${error.message}`);
  const row = (data ?? []).find((one) => runOf(one.cache_key) === answer.run);
  const stored = (Array.isArray(row?.payload) ? row.payload[0] : null) as (Partial<AiAnswer> & { taskId?: unknown }) | null;
  const cited = Array.isArray(stored?.citedUrls) ? stored.citedUrls : Array.isArray(stored?.citedDomains) ? stored.citedDomains : [];
  const searched = stored?.fanOuts === undefined && stored?.retrievedUrls === undefined ? null : (stored?.fanOuts?.length ?? 0) + (stored?.retrievedUrls?.length ?? 0) > 0;
  return {
    ...item,
    day: read.day,
    excerpt: typeof stored?.text === "string" ? excerptOf(stored.text, [read.siteName, site.domain]) : null,
    cited,
    searched: answer.engine === "chatgpt" ? searched : null,
    model: typeof stored?.model === "string" ? stored.model : null,
    guard: guardOf(answer, Array.isArray(stored?.citedDomains) ? stored.citedDomains : [], site.domain),
  };
}
