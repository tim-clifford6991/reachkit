import { REPORT_VERSION } from "./report";
import type { ReportChange } from "./rescore";
import type { Row, ScanWrite } from "./rescore-run";

/** The changes as `rescore_scan` takes them. They were found on the upgraded
 *  copy, so a stored blob of an older version, which may lack their parents,
 *  takes the whole upgraded report instead (the empty path). */
export function changesToWrite(row: Row): readonly ReportChange[] {
  const stored = row.scan.report as { version?: unknown } | null;
  if (stored?.version === REPORT_VERSION) return row.result.changes;
  const whole = JSON.parse(JSON.stringify(row.report)) as Record<string, unknown>;
  for (const change of row.result.changes) {
    let at = whole as Record<string | number, unknown>;
    for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
    at[change.path[change.path.length - 1]!] = JSON.parse(JSON.stringify(change.value));
  }
  return [{ path: [], value: whole }];
}

/** One re-scored row as the guarded write takes it, under the checksum it was read with. */
export function scanWriteOf(row: Row, at: string, by: string): ScanWrite {
  const { result } = row;
  return { id: row.scan.id, md5: row.scan.md5, changes: changesToWrite(row), score: result.score, status: result.status, drivers: result.drivers, at, by };
}
