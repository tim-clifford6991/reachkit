// What a re-score moved on this report, where it moved the score because the
// Google half moved — read only from what the re-score kept for its undo.
import type { Measured } from "@/lib/measure/measured";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";

export interface Rescored {
  at: Date;
  before: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The stored half's value, or `null` where it was not measured. */
function valueOf(half: unknown): number | null {
  if (!isRecord(half) || half.kind === "unmeasured") return null;
  return typeof half.value === "number" ? half.value : null;
}

/** The score as first stored: the kept report's own, or the kept `scans.score` where that report cannot be read. */
function beforeScoreOf(report: StoredReport): number | null {
  try {
    const kept = readStoredReport(report.previous).verdict.scoreAndBand;
    return kept.kind === "unmeasured" ? null : kept.value.score;
  } catch {
    const columns = report.previousColumns;
    return isRecord(columns) && typeof columns.score === "number" ? columns.score : null;
  }
}

export function rescoredOf(report: StoredReport): Rescored | null {
  if (report.rescoredAt === undefined) return null;
  const at = new Date(report.rescoredAt);
  const now = report.verdict.scoreAndBand;
  const google: Measured<number> | undefined = report.verdict.halves?.google;
  if (Number.isNaN(at.getTime()) || now.kind === "unmeasured" || google === undefined) return null;

  const before = beforeScoreOf(report);
  if (before === null || before === now.value.score) return null;

  const columns = report.previousColumns;
  const googleBefore = isRecord(columns) && isRecord(columns.drivers) ? columns.drivers.searchPresence : undefined;
  if (googleBefore === undefined || valueOf(googleBefore) === valueOf(google)) return null;
  return { at, before };
}
