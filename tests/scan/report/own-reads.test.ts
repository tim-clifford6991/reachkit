// The re-score's database reads, through a fake client that keeps the rows
// and counts what each request hands back: the payloads it downloads, the
// report read without its kept copy, and the MB line the run reports.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { databaseRescore, measuredOf, rescoreStored, type OwnRead, type StoredScanRow } from "../../../src/lib/scan/rescore-run";

type Record_ = Record<string, unknown>;
const KEPT = ["previous", "previousColumns", "rescoredAt", "rescoredBy"];
const md5 = (v: unknown) => createHash("md5").update(JSON.stringify(v)).digest("hex");

/** Rows by table, answered as PostgREST would; every answer is logged. */
function fakeClient(tables: Record<string, Record_[]>) {
  const answered: { table: string; columns: string; rows: Record_[] }[] = [];
  const rpcs: { fn: string; args: Record_ }[] = [];
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
      then(done: (r: unknown) => unknown) {
        const data = rows.map((r) => Object.fromEntries(columns.split(",").map((c) => pick(r, c.trim()))));
        answered.push({ table, columns, rows: data });
        return Promise.resolve({ data, error: null }).then(done);
      },
    };
    return q;
  };
  async function rpc(fn: string, args: Record_) {
    rpcs.push({ fn, args });
    if (fn === "rescore_scan") return { data: true, error: null };
    const after = args.p_after_created_at === null ? "" : `${args.p_after_created_at}${args.p_after_id}`;
    const data = (tables.scans ?? [])
      .filter((s) => `${s.created_at}${s.id}` > after)
      .slice(0, args.p_limit as number)
      .map((s) => ({ ...s, report: Object.fromEntries(Object.entries(s.report as Record_).filter(([k]) => !KEPT.includes(k))), report_md5: md5(s.report) }));
    return { data, error: null };
  }
  const db = databaseRescore(async () => ({ from, rpc }) as never);
  return { db, answered, rpcs };
}

const page = (url: string, created_at: string, scan_id: string | null = null, html = "<html><body><h2>Do you cover Leeds?</h2><p>Yes.</p></body></html>") => ({
  id: `${url}@${created_at}`,
  source: "egress.safeFetch",
  cache_key: url,
  created_at,
  scan_id,
  payload: { url, status: 200, html, bytes: html.length, readAt: created_at },
});

describe("a paying scan's live pages are downloaded only as the reads it scores with", () => {
  // 4 live pages read 3 times each; 5 scans that each read one page of their own.
  const ours = [1, 2, 3, 4].map((n) => `https://www.leeds-plumber.co.uk/guide-${n}`);
  const history = ours.flatMap((url) => ["2026-10-01", "2026-10-03", "2026-10-05"].map((day) => page(url, `${day}T10:00:00+00:00`)));
  const scans = ["03T20", "04T08", "04T20", "06T08", "06T20"].map((at, i) => ({
    id: `scan-${i}`,
    siteId: "site",
    createdAt: `2026-10-${at}:00:00+00:00`,
    own: page("https://www.leeds-plumber.co.uk/", `2026-10-${at}:00:05+00:00`, `scan-${i}`),
  }));
  const tables = () => ({
    fetches: [...history, ...scans.map((s) => s.own)],
    publications: ours.map((live_url) => ({ site_id: "site", live_url, published_at: "2026-09-30T00:00:00+00:00", unpublished_at: null })),
  });
  const asRead = (r: ReturnType<typeof page>): OwnRead => ({ url: r.cache_key, created_at: r.created_at, payload: r.payload });

  it("measures each scan as the whole history does, from one payload per page and read, each downloaded once", async () => {
    const { db, answered } = fakeClient(tables());
    for (const scan of scans) {
      const whole = measuredOf({ own: [asRead(scan.own)], ours, oursReads: history.map(asRead) });
      expect(measuredOf(await db.ownReads(scan))).toEqual(whole);
    }
    const payloads = answered.filter((a) => a.columns.includes("payload")).flatMap((a) => a.rows.filter((r) => ours.includes(r.cache_key as string)));
    // The scans keep the reads of 3 and 5 October only; the whole history was 4 × 3 per scan, 60 in all.
    expect(payloads.map((r) => r.created_at).sort()).toEqual([...Array(4).fill("2026-10-03T10:00:00+00:00"), ...Array(4).fill("2026-10-05T10:00:00+00:00")]);
  });
});

describe("the re-score's scans are read without the copy an earlier re-score kept", () => {
  const scan = (JSON.parse(readFileSync(new URL("./fixtures/rescore/zapier.com.json", import.meta.url), "utf8")) as { scans: Record_[] }).scans[0]!;
  const home = scan.home as { created_at: string; payload: Record_ };
  const report = { ...(scan.report as Record_), tier: "weekly" };
  const live = "https://content.zapier.com/how-to-connect-apps";
  const ARTICLE = "<html><body><h2>How do I connect two apps?</h2><p>Pick 2 apps and 1 trigger.</p><h2>Is it free?</h2><p>Yes, for 100 tasks.</p></body></html>";
  const tables = (extra: ReturnType<typeof page>[] = []) => ({
    scans: [
      {
        id: scan.id, domain: "zapier.com", created_at: scan.createdAt, status: scan.status, score: scan.score, drivers: scan.drivers,
        report: { ...report, previous: structuredClone(report), rescoredBy: "old1234" }, site_id: "site", is_current: false,
      },
    ],
    fetches: [
      { ...page("https://zapier.com/", home.created_at, scan.id as string), payload: home.payload },
      page("https://zapier.com/sitemap.xml", "2026-10-06T03:44:00+00:00", scan.id as string, '<?xml version="1.0"?><urlset></urlset>'),
      ...[0, 1, 2, 3].map((i) => page(`https://zapier.com/guide-${i}`, "2026-10-06T03:44:00+00:00", scan.id as string, ARTICLE)),
      page(live, "2026-10-05T07:00:00+00:00", null, ARTICLE),
      ...extra,
    ],
    publications: [{ site_id: "site", live_url: live, published_at: "2026-10-01T00:00:00+00:00", unpublished_at: null }],
    sites: [],
    site_profiles: [],
  });
  const at = new Date("2026-11-01T12:00:00Z");

  it("comes through rescore_reports, and an apply writes under the checksum it read", async () => {
    const { db, answered, rpcs } = fakeClient(tables());
    const stored: readonly StoredScanRow[] = await db.scans();
    expect(Object.keys(stored[0]!.report as Record_).filter((k) => KEPT.includes(k))).toEqual([]);
    const answer = await rescoreStored(db, { apply: true, version: "abc1234", at });
    expect(answer.scansWritten).toBe(1);
    expect(answered.map((a) => a.table)).not.toContain("scans");
    expect(rpcs.filter((c) => c.fn === "rescore_scan").map((c) => c.args.p_md5)).toEqual([md5(tables().scans[0]!.report)]);
  });

  it("says how much it read, and more where more rows were downloaded", async () => {
    const mb = async (extra: ReturnType<typeof page>[]) => {
      const { summary } = await rescoreStored(fakeClient(tables(extra)).db, { apply: false, version: "abc1234", at });
      return Number(/^- read ≈ ([\d.]+) MB \(est\./m.exec(summary)?.[1]);
    };
    const small = await mb([]);
    expect(small).toBeGreaterThan(0);
    expect(await mb([page("https://zapier.com/pricing", "2026-10-06T03:44:00+00:00", scan.id as string, `<html>${"x".repeat(300_000)}</html>`)])).toBeGreaterThanOrEqual(small + 0.3);
  });
});
