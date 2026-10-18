// SPEC §7 (2026-10-03, issue 1163) — the report's measurements as business
// facts.
//
// What ReachKit measured about a site is a first-party fact about that
// site: its score, which AI answers named it, which named a rival, and how
// the measurement was made. Until this issue none of it reached a brief;
// the knowledge base was the site's own prose and nothing else.
//
// **The report becomes one more page.** Its sentences are composed here,
// from the copy registry and the stored figures, and handed to the facts
// read as a page whose address is the report's own public address and
// whose read date is the measurement's. Everything downstream is unchanged:
// the passages are taken in turn with the site's pages, the customer can
// switch one off on Settings › Your business, and the grounding rule
// re-verifies a recorded passage against this text word for word.
//
// **Only on a research page** (SPEC §7, owner 2026-10-17, issue 1490,
// amending 1163): *"Only on research pages."* A page built on the site's own
// measurements is a research page, which aggregates them by design; every
// other type would publish the customer's weakness ("0 of 12", "18/100").
// `reportFactsAllowed` (in `report-scope.ts`, a leaf with no db) is the one
// place that decides it: the pack holds these sentences only where it says
// so, and the numeral rule withholds their measurements from every other
// page.
//
// **Only a complete report, and only what it measured.** A pass that
// stopped early is not quoted, an unmeasured score yields no score
// sentence, and a rival no answer cited yields no rival sentence. No figure
// is estimated and no model is asked.
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import type { MeasuredText } from "@/lib/measure/text";
import type { CopyKey } from "@/lib/presentation/copy";
import { copyIn } from "@/lib/presentation/copy/translated";
import { localeOfReport, readStoredReport, type StoredReport } from "@/lib/scan/report";

/** The most rivals named, one sentence each — the ones cited most. */
const MAX_RIVAL_FACTS = 3;

const ENGINE_LABEL = {
  ai_overview: "ai-answers.engine.ai-overview",
  ai_mode: "ai-answers.engine.ai-mode",
  chatgpt: "ai-answers.engine.chatgpt",
} as const satisfies Record<string, CopyKey>;

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "A", "A and B", "A, B and C". */
function listed(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The report's public address: where a reader can check the figure. */
export function reportAddress(domain: string): string {
  return new URL(`/scan/${encodeURIComponent(domain)}`, env.NEXT_PUBLIC_APP_URL).toString();
}

/**
 * The sentences a complete report states, in the order a brief should meet
 * them. Empty for a report that is not complete.
 */
export function reportSentences(report: StoredReport): string[] {
  if (!report.complete) return [];
  const domain = report.domain;
  // D66: a German site's own figures are stated in German, as its page is.
  const language = localeOfReport(report).language;
  const copy = (key: CopyKey, vars?: Record<string, string | number>): string => copyIn(language, key, vars);
  const date =
    language === "de"
      ? new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(report.verdict.measuredAt))
      : DAY.format(new Date(report.verdict.measuredAt));
  const out: string[] = [];

  const score = report.verdict.scoreAndBand;
  if (score.kind !== "unmeasured") {
    out.push(copy("fact.report.score", { domain, date, score: score.value.score }));
  }

  const rows = report.aiAnswers?.rows ?? [];
  // A question counts once, over every engine that answered it.
  const answered = rows
    .map((row) => row.engines.map((engine) => engine.cell).filter((cell) => cell.kind === "answered"))
    .filter((cells) => cells.length > 0);
  if (answered.length > 0) {
    const total = answered.length;
    const named = answered.filter((cells) => cells.some((cell) => cell.namesCustomer)).length;
    out.push(copy("fact.report.answers", { domain, date, count: named, total }));

    const rivals = (report.aiAnswers?.rivals ?? [])
      .map((rival) => ({
        rival: rival.domain,
        count: answered.filter((cells) => cells.some((cell) => cell.citedDomains.includes(rival.domain))).length,
      }))
      .filter((row) => row.count > 0)
      .sort((x, y) => y.count - x.count)
      .slice(0, MAX_RIVAL_FACTS);
    for (const { rival, count } of rivals) {
      out.push(copy("fact.report.rival", { domain, date, rival, count, total }));
    }
  }

  // The engines this pass actually asked — never the full list by default.
  const asked = (Object.keys(ENGINE_LABEL) as (keyof typeof ENGINE_LABEL)[]).filter((engine) =>
    rows.some((row) => row.engines.some((cell) => cell.engine === engine && cell.cell.kind !== "unmeasured"))
  );
  if (asked.length > 0) {
    const names = asked.map((engine) => copy(ENGINE_LABEL[engine]));
    const engines = language === "en" ? listed(names) : new Intl.ListFormat(language, { type: "conjunction" }).format(names);
    out.push(copy("fact.report.method", { domain, date, engines }));
  }
  return out;
}

/** The report as a page of the site's facts, or `null` where it states
 *  nothing. */
export function reportPage(report: StoredReport): MeasuredText | null {
  const sentences = reportSentences(report);
  if (sentences.length === 0) return null;
  return {
    url: reportAddress(report.domain),
    text: sentences.join("\n"),
    measuredAt: new Date(report.verdict.measuredAt),
  };
}

interface ReportQuery {
  select(columns: string): ReportQuery;
  eq(column: string, value: unknown): ReportQuery;
  order(column: string, options: { ascending: boolean }): ReportQuery;
  limit(n: number): PromiseLike<{ data: { report: unknown }[] | null; error: { message: string } | null }>;
}

/**
 * The site's latest complete report, as a page — or `null`.
 *
 * **Total, on purpose.** These facts are an addition to the site's own
 * pages: a site whose report cannot be read, or whose stored blob no
 * longer parses, is grounded on its pages as before rather than failing a
 * draft over a sentence it did not need.
 */
export async function readReportPage(siteId: string): Promise<MeasuredText | null> {
  try {
    const client = dbAdmin() as unknown as { from(table: string): ReportQuery };
    const { data, error } = await client
      .from("scans")
      .select("report")
      .eq("site_id", siteId)
      .eq("report->>complete", "true")
      .order("created_at", { ascending: false })
      .limit(1);
    const blob = data?.[0]?.report;
    if (error !== null || blob === null || blob === undefined) return null;
    return reportPage(readStoredReport(blob));
  } catch {
    return null;
  }
}
