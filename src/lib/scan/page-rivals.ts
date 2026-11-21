// The rivals a stored page question's answer named, read at 0¢ from the answer text `fetches` still holds under its scan, as the pass reads them.
import { askedIn } from "@/lib/locale/place";
import { rivalsNamed } from "@/lib/market/prompts/answer";
import { AI_ANSWER_SOURCES } from "@/lib/vendors/dataforseo/types";
import { localeOfReport, type EngineCell, type StoredReport } from "./report";
import type { ReportChange, RescoreScan } from "./rescore";

type PageReport = Pick<StoredReport, "locale" | "domain"> & { pageQuestions?: StoredReport["pageQuestions"] };

/** An answered battery column the pass did not read rivals for. */
const unread = (e: Partial<EngineCell> | undefined): boolean => e?.engine !== "ai_overview" && e?.cell?.kind === "answered" && e.rivals === undefined;

/** The page questions' battery queries, as the pass asked them, where the section has an unread column and was never read since. */
function queriesOf(r: PageReport): Set<string> | null {
  const section = r.pageQuestions;
  if (section == null || section.rivalsRead === true || !Array.isArray(section.rows)) return null;
  if (!section.rows.some((row) => Array.isArray(row?.engines) && row.engines.some(unread))) return null;
  const place = localeOfReport(r).place;
  return new Set(section.rows.map((row) => askedIn(row.question.wording.text, place)));
}

/** One change per unread answered column whose text is stored, and the section marked read once, filled or not, so no answer is read for it again. */
export function pageRivalChanges(r: PageReport, scan: Pick<RescoreScan, "answers" | "market" | "answersRead">): ReportChange[] {
  const rivals = scan.market?.rivals;
  if (rivals === undefined || scan.answersRead !== true || queriesOf(r) === null) return [];
  const changes: ReportChange[] = [{ path: ["pageQuestions", "rivalsRead"], value: true }];
  r.pageQuestions!.rows.forEach((row, i) => {
    const query = askedIn(row.question.wording.text, localeOfReport(r).place);
    row.engines.forEach((engine, j) => {
      if (!unread(engine) || engine.cell.kind !== "answered" || engine.engine === "ai_overview") return;
      const source = AI_ANSWER_SOURCES[engine.engine];
      const stored = scan.answers.find((answer) => answer.source === source && answer.key.split("|")[0] === query);
      const text = stored?.whole ?? stored?.text ?? null;
      if (text === null) return;
      changes.push({ path: ["pageQuestions", "rows", i, "engines", j, "rivals"], value: rivalsNamed({ text, citedDomains: engine.cell.citedDomains, ownDomain: r.domain, rivals }) });
    });
  });
  return changes;
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/** Which of a past site scan's stored answers to read: its page questions', where it is of the last four weeks and was never read; else `null`, read nothing. */
export function pageAnswerKeys(scan: { createdAt: string; report: unknown }, at: Date): ((key: string) => boolean) | null {
  if (!(at.getTime() - new Date(scan.createdAt).getTime() < FOUR_WEEKS_MS)) return null;
  const queries = queriesOf(scan.report as PageReport);
  return queries === null ? null : (key) => queries.has(key.split("|")[0]!);
}
