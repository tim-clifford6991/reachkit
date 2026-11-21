// The rivals a stored page question's answer named, read at 0¢ from the answer text `fetches` still holds under its scan, as the pass reads them.
import { askedIn } from "@/lib/locale/place";
import { rivalsNamed } from "@/lib/market/prompts/answer";
import { AI_ANSWER_SOURCES } from "@/lib/vendors/dataforseo/types";
import { localeOfReport, type EngineCell, type StoredReport } from "./report";
import type { ReportChange, RescoreScan } from "./rescore";

/** One change per answered battery column that has no rivals yet and whose text is stored; a pass's own reading stands. */
export function pageRivalChanges(
  r: Pick<StoredReport, "locale" | "domain"> & { pageQuestions?: StoredReport["pageQuestions"] },
  scan: Pick<RescoreScan, "answers" | "market">
): ReportChange[] {
  const rivals = scan.market?.rivals;
  if (rivals === undefined) return [];
  const place = localeOfReport(r).place;
  const changes: ReportChange[] = [];
  (r.pageQuestions?.rows ?? []).forEach((row, i) => {
    const query = askedIn(row.question.wording.text, place);
    row.engines.forEach((engine, j) => {
      if (engine.rivals !== undefined || engine.cell.kind !== "answered" || engine.engine === "ai_overview") return;
      const source = AI_ANSWER_SOURCES[engine.engine];
      const stored = scan.answers.find((answer) => answer.source === source && answer.key.split("|")[0] === query);
      const text = stored?.whole ?? stored?.text ?? null;
      if (text === null) return;
      const value = rivalsNamed({ text, citedDomains: engine.cell.citedDomains, ownDomain: r.domain, rivals });
      changes.push({ path: ["pageQuestions", "rows", i, "engines", j, "rivals"], value });
    });
  });
  return changes;
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/** A site scan of the last four weeks with an answered battery column whose rivals are unread: its stored answers are worth downloading. */
export function unreadPageRivals(scan: { createdAt: string; report: unknown }, at: Date): boolean {
  if (!(at.getTime() - new Date(scan.createdAt).getTime() < FOUR_WEEKS_MS)) return false;
  const rows = (scan.report as { pageQuestions?: { rows?: unknown } } | null)?.pageQuestions?.rows;
  if (!Array.isArray(rows)) return false;
  return rows.some((row: { engines?: unknown }) =>
    Array.isArray(row?.engines) && row.engines.some((e: Partial<EngineCell>) => e?.engine !== "ai_overview" && e?.cell?.kind === "answered" && e.rivals === undefined)
  );
}
