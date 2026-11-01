// tests/scan/report/rescore-store.ts — the stored scans and the store the
// re-score suites share. Not a suite of its own: vitest collects `*.test.ts`.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pageFactsOf } from "../../../src/lib/scan/page-facts";
import { databaseRescore, type ProfileNameWrite, type RescoreStore, type ScanWrite, type SiteWrite, type StoredProfileName, type StoredRead, type StoredScanRow, type StoredSiteRow } from "../../../src/lib/scan/rescore-run";

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

/** A stored read, or a fixture scan's stored home reads, as the re-score reads them: their facts. */
export const readOf = (domain: string, source: StoredRead["source"], read: { created_at: string; payload: unknown }): StoredRead => ({ source, created_at: read.created_at, facts: pageFactsOf(`https://${domain}/`, read.payload) });
export const readsOf = (s: Pick<FixtureScan, "home" | "rendered">, domain: string): StoredRead[] => [
  ...(s.home === null ? [] : [readOf(domain, "egress.safeFetch", s.home)]),
  ...s.rendered.map((r) => readOf(domain, "on_page/instant_pages", r)),
];
export const ownOf = (read: { url: string; created_at: string; payload: unknown }) => ({ url: read.url, created_at: read.created_at, facts: pageFactsOf(read.url, read.payload) });

/** The database as the job reads and writes it: `rescore_scan`'s guard and
 *  its path-level rewrite, applied to rows held here. */
export function storeOf(scans: readonly FixtureScan[], sites: StoredSiteRow[] = [], profiles: StoredProfileName[] = []) {
  const rows = new Map<string, StoredScanRow>();
  const reads = new Map<string, StoredRead[]>();
  for (const s of scans) {
    const domain = String(s.report.domain);
    rows.set(s.id, { ...s, domain, md5: md5(s.report), report: structuredClone(s.report), siteId: null, isCurrent: false });
    reads.set(domain, [...(reads.get(domain) ?? []), ...readsOf(s, domain)]);
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

type Record_ = Record<string, unknown>;
/** The keys an earlier re-score kept beside a report, which `rescore_reports` leaves out. */
export const KEPT = ["previous", "previousColumns", "rescoredAt", "rescoredBy"];

/** Rows by table, answered as PostgREST would; every answer is logged, and
 *  `fetch_facts` upserts land in `tables`. */
export function fakeClient(tables: Record<string, Record_[]>, factsVersion: string | null = null) {
  const answered: { table: string; columns: string; rows: Record_[] }[] = [];
  const rpcs: { fn: string; args: Record_; rows: unknown }[] = [];
  const pick = (row: Record_, expr: string) => {
    const [name, path] = expr.includes(":") ? expr.split(":") : [expr, expr];
    const [head, ...keys] = path!.split(/->>?/);
    return [name, keys.reduce<unknown>((v, k) => (v as Record_ | null)?.[k], row[head!])];
  };
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let columns = "*";
    const q = {
      select: (c: string) => ((columns = c), q),
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
      in: (c: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[c]))), q),
      not: (c: string) => ((rows = rows.filter((r) => r[c] != null)), q),
      order: () => q,
      upsert(values: Record_[], { onConflict }: { onConflict: string }) {
        tables[table] = [...(tables[table] ?? []).filter((r) => !values.some((v) => v[onConflict] === r[onConflict])), ...(JSON.parse(JSON.stringify(values)) as Record_[])];
        return Promise.resolve({ data: null, error: null });
      },
      then(done: (r: unknown) => unknown) {
        const data = rows.map((r) => Object.fromEntries(columns.split(",").map((c) => pick(r, c.trim()))));
        answered.push({ table, columns, rows: data });
        return Promise.resolve({ data, error: null }).then(done);
      },
    };
    return q;
  };
  async function rpc(fn: string, args: Record_) {
    if (fn === "rescore_scan") return (rpcs.push({ fn, args, rows: null }), { data: true, error: null });
    const after = args.p_after_created_at === null ? "" : `${args.p_after_created_at}${args.p_after_id}`;
    const data = (tables.scans ?? [])
      .filter((s) => `${s.created_at}${s.id}` > after)
      .slice(0, args.p_limit as number)
      .map((s) => ({ ...s, report: Object.fromEntries(Object.entries(s.report as Record_).filter(([k]) => !KEPT.includes(k))), report_md5: md5(s.report) }));
    rpcs.push({ fn, args, rows: data });
    return { data, error: null };
  }
  const db = databaseRescore(async () => ({ from, rpc }) as never, factsVersion);
  /** The `fetches` rows handed back with their payload, by id. */
  const payloadsRead = () => answered.filter((a) => a.table === "fetches").flatMap((a) => a.rows.filter((r) => "payload" in r).map((r) => String(r.id)));
  return { db, answered, rpcs, payloadsRead, tables };
}
