// tests/scan/report/rescore-store.ts — the stored scans and the store the
// re-score suites share. Not a suite of its own: vitest collects `*.test.ts`.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { ProfileNameWrite, RescoreStore, ScanWrite, SiteWrite, StoredProfileName, StoredRead, StoredScanRow, StoredSiteRow } from "../../../src/lib/scan/rescore-run";

export const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

export interface FixtureScan {
  id: string;
  createdAt: string;
  status: StoredScanRow["status"];
  score: number | null;
  drivers: unknown;
  report: Record<string, unknown>;
  home: { created_at: string; payload: unknown } | null;
  rendered: readonly { created_at: string; payload: unknown }[];
}

/** A scan as #1429's fixtures stored it. */
export const fixture = (domain: string): FixtureScan =>
  (read(`./fixtures/rescore/${domain}.json`) as { scans: FixtureScan[] }).scans[0]!;

export const md5 = (report: unknown): string => createHash("md5").update(JSON.stringify(report)).digest("hex");

/** The database as the job reads and writes it: `rescore_scan`'s guard and
 *  its path-level rewrite, applied to rows held here. */
export function storeOf(scans: readonly FixtureScan[], sites: StoredSiteRow[] = [], profiles: StoredProfileName[] = []) {
  const rows = new Map<string, StoredScanRow>();
  const reads = new Map<string, StoredRead[]>();
  for (const s of scans) {
    const domain = String(s.report.domain);
    rows.set(s.id, { ...s, domain, md5: md5(s.report), report: structuredClone(s.report), siteId: null, isCurrent: false });
    reads.set(domain, [
      ...(reads.get(domain) ?? []),
      ...(s.home === null ? [] : [{ source: "egress.safeFetch" as const, ...s.home }]),
      ...s.rendered.map((r) => ({ source: "on_page/instant_pages" as const, ...r })),
    ]);
  }
  const written: ScanWrite[] = [];
  const sitesWritten: SiteWrite[] = [];
  const namesWritten: ProfileNameWrite[] = [];
  const store: RescoreStore = {
    scans: async () => [...rows.values()].map((r) => structuredClone(r)),
    homeReads: async (domain) => reads.get(domain) ?? [],
    ownReads: async () => ({ own: [], ours: [], oursReads: [] }),
    sites: async () => sites,
    profiles: async () => profiles.map((p) => ({ ...p })),
    answers: async () => [],
    async writeScan(w) {
      const row = rows.get(w.id)!;
      if (row.md5 !== w.md5) return false;
      written.push(w);
      const report = structuredClone(row.report) as Record<string, unknown>;
      const original = { previous: report.previous ?? structuredClone(report), previousColumns: report.previousColumns ?? { score: row.score, status: row.status, drivers: row.drivers } };
      for (const change of w.changes) {
        let at = report as Record<string | number, unknown>;
        for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
        at[change.path[change.path.length - 1]!] = JSON.parse(JSON.stringify(change.value));
      }
      const next = { ...report, ...original, rescoredAt: w.at, rescoredBy: w.by };
      rows.set(w.id, { ...row, report: next, md5: md5(next), score: w.score, status: w.status, drivers: JSON.parse(JSON.stringify(w.drivers)) });
      return true;
    },
    async writeSite(w) {
      sitesWritten.push(w);
    },
    async writeProfileName(w) {
      const row = profiles.find((p) => p.domain === w.domain);
      if (row === undefined || row.site_name !== w.from) return false;
      row.site_name = w.to;
      namesWritten.push(w);
      return true;
    },
  };
  return { store, rows, written, sitesWritten, namesWritten };
}

export const at = new Date("2026-10-14T12:00:00Z");
export const dry = { apply: false, version: "abc1234", at };
export const apply = { apply: true, version: "abc1234", at };
