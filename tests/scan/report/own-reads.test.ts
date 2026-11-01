// The re-score's database reads, through a fake client that keeps the rows
// and counts what each request hands back: the facts it reads, the payloads
// it downloads only to refresh them, the report read without its kept copy,
// and the MB line the run reports.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { measuredOf, rescoreStored, type StoredScanRow } from "../../../src/lib/scan/rescore-run";
import { fakeClient, KEPT, md5, ownOf } from "./rescore-store";

type Record_ = Record<string, unknown>;

const page = (url: string, created_at: string, scan_id: string | null = null, html = "<html><body><h2>Do you cover Leeds?</h2><p>Yes.</p></body></html>", source = "egress.safeFetch") => ({
  id: `${url}@${created_at}`,
  source,
  cache_key: url,
  created_at,
  scan_id,
  payload: { url, status: 200, html, bytes: html.length, readAt: created_at } as unknown,
});

/** The requests that downloaded payloads to refresh facts. */
const payloadRequests = (answered: ReturnType<typeof fakeClient>["answered"]) => answered.filter((a) => a.table === "fetches" && a.columns === "id, scan_id, cache_key, payload");

describe("a paying scan's live pages are read only as the reads it scores with", () => {
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
  const asRead = (r: ReturnType<typeof page>) => ownOf({ url: r.cache_key, created_at: r.created_at, payload: r.payload });

  it("measures each scan as the whole history does, each payload it keeps downloaded once", async () => {
    const { db, payloadsRead } = fakeClient(tables());
    for (const scan of scans) {
      const whole = measuredOf({ own: [asRead(scan.own)], ours, oursReads: history.map(asRead) });
      expect(measuredOf(await db.ownReads(scan))).toEqual(whole);
    }
    const live = payloadsRead().filter((id) => ours.some((url) => id.startsWith(`${url}@`)));
    // The scans keep the reads of 3 and 5 October only; the whole history was 4 × 3 per scan, 60 in all.
    expect(live.map((id) => id.split("@")[1]).sort()).toEqual([...Array(4).fill("2026-10-03T10:00:00+00:00"), ...Array(4).fill("2026-10-05T10:00:00+00:00")]);
  });
});

describe("the re-score's scans are read without the copy an earlier re-score kept", () => {
  const scan = (JSON.parse(readFileSync(new URL("./fixtures/rescore/zapier.com.json", import.meta.url), "utf8")) as { scans: Record_[] }).scans[0]!;
  const home = scan.home as { created_at: string; payload: Record_ };
  const report = { ...(scan.report as Record_), tier: "weekly" };
  const live = "https://content.zapier.com/how-to-connect-apps";
  const ARTICLE = "<html><body><h2>How do I connect two apps?</h2><p>Pick 2 apps and 1 trigger.</p><h2>Is it free?</h2><p>Yes, for 100 tasks.</p></body></html>";
  const homeRow = { ...page("https://zapier.com/", home.created_at, scan.id as string), payload: home.payload };
  const tables = (extra: ReturnType<typeof page>[] = []): Record<string, Record_[]> => ({
    scans: [
      {
        id: scan.id, domain: "zapier.com", created_at: scan.createdAt, status: scan.status, score: scan.score, drivers: scan.drivers,
        report: { ...report, previous: structuredClone(report), rescoredBy: "old1234" }, site_id: "site", is_current: false,
      },
    ],
    fetches: [
      homeRow,
      page("https://zapier.com/sitemap.xml", "2026-10-06T03:44:00+00:00", scan.id as string, '<?xml version="1.0"?><urlset></urlset>'),
      ...[0, 1, 2, 3].map((i) => page(`https://zapier.com/guide-${i}`, "2026-10-06T03:44:00+00:00", scan.id as string, ARTICLE)),
      page(live, "2026-10-05T07:00:00+00:00", null, ARTICLE),
      ...extra,
    ] as Record_[],
    publications: [{ site_id: "site", live_url: live, published_at: "2026-10-01T00:00:00+00:00", unpublished_at: null }],
    sites: [],
    site_profiles: [],
  });
  const at = new Date("2026-11-01T12:00:00Z");
  const dry = { apply: false, version: "abc1234", at };

  it("comes through rescore_reports, and an apply writes under the checksum it read", async () => {
    const { db, answered, rpcs } = fakeClient(tables());
    const stored: readonly StoredScanRow[] = await db.scans();
    expect(Object.keys(stored[0]!.report as Record_).filter((k) => KEPT.includes(k))).toEqual([]);
    const answer = await rescoreStored(db, { apply: true, version: "abc1234", at });
    expect(answer.scansWritten).toBe(1);
    expect(answered.map((a) => a.table)).not.toContain("scans");
    expect(rpcs.filter((c) => c.fn === "rescore_scan").map((c) => c.args.p_md5)).toEqual([md5(tables().scans![0]!.report)]);
  });

  it("says how much it read and how much of it refreshed facts, more where more rows were downloaded", async () => {
    const mb = async (extra: ReturnType<typeof page>[]) => {
      const { summary } = await rescoreStored(fakeClient(tables(extra)).db, dry);
      const [, read, refresh] = /^- read ≈ ([\d.]+) MB \(facts refresh ≈ ([\d.]+) MB\)/m.exec(summary) ?? [];
      return { read: Number(read), refresh: Number(refresh) };
    };
    const small = await mb([]);
    expect(small.read).toBeGreaterThan(0);
    const big = await mb([page("https://zapier.com/pricing", "2026-10-06T03:44:00+00:00", scan.id as string, `<html>${"x".repeat(300_000)}</html>`)]);
    expect(big.read).toBeGreaterThanOrEqual(small.read + 0.3);
    expect(big.refresh).toBeGreaterThanOrEqual(small.refresh + 0.3);
  });

  it("reads each payload it needs once, a site scan's home among them though both lookups ask for it; none again at the same facts version, and each again at a new one", async () => {
    const t = tables();
    const needed = t.fetches!.map((r) => String(r.id)).sort();
    const first = fakeClient(t, "f1");
    await rescoreStored(first.db, { ...dry, derivation: "d1" });
    expect(first.payloadsRead().sort()).toEqual(needed);

    const second = fakeClient(t, "f1");
    const warm = await rescoreStored(second.db, { ...dry, derivation: "d2" });
    expect(second.payloadsRead()).toEqual([]);
    expect(warm.summary).toMatch(/facts refresh ≈ 0\.00 MB/);

    const third = fakeClient(t, "f2");
    await rescoreStored(third.db, { ...dry, derivation: "d2" });
    expect(third.payloadsRead().sort()).toEqual(needed);
    expect(t.fetch_facts?.map((row) => row.facts_version)).toEqual(needed.map(() => "f2"));
  });

  it("a kept facts row whose read is gone is a read that is gone: home null, and why", async () => {
    const t = tables();
    await rescoreStored(fakeClient(t, "f1").db, dry);
    expect(t.fetch_facts?.some((row) => row.fetch_id === homeRow.id)).toBe(true);
    t.fetches = t.fetches!.filter((row) => row.id !== homeRow.id);
    const { summary } = await rescoreStored(fakeClient(t, "f1").db, dry);
    expect(summary).toContain("- home page: its stored read is gone, so it was not checked for a protection's page: 1");
  });
});

describe("a site's rendered reads are picked from their facts in one request", () => {
  const gusto = (JSON.parse(readFileSync(new URL("./fixtures/rescore/gusto.com.json", import.meta.url), "utf8")) as { scans: Record_[] }).scans[0]!;
  const home = gusto.home as { created_at: string; payload: Record_ };
  const drawn = [{ url: "https://gusto.com/", status: 200, bytes: 120, readAt: "2026-10-08T13:58:00Z", html: "<html><head><title>Gusto</title></head><body><h1>Payroll and HR</h1></body></html>" }];
  const rendered = [0, 1, 2, 3, 4].map((i) => ({ ...page("https://gusto.com/", `2026-10-08T13:5${3 + i}:00+00:00`, null, "", "on_page/instant_pages"), payload: i < 2 ? [] : drawn }));
  const scans = [{ id: gusto.id, domain: "gusto.com", created_at: gusto.createdAt, status: gusto.status, score: gusto.score, drivers: gusto.drivers, report: gusto.report, site_id: null, is_current: false }];
  const tables = () => ({ scans, fetches: [{ ...page("https://gusto.com/", home.created_at), payload: home.payload }, ...rendered] as Record_[], sites: [], site_profiles: [] });
  const dry = { apply: false, version: "abc1234", at: new Date("2026-11-01T12:00:00Z") };

  it("with five candidates: one facts request, one payload request for the misses, and none once they are kept", async () => {
    const t = tables();
    const cold = fakeClient(t, "f1");
    const before = await rescoreStored(cold.db, dry);
    expect(cold.answered.filter((a) => a.table === "fetch_facts")).toHaveLength(1);
    expect(payloadRequests(cold.answered)).toHaveLength(1);
    expect(cold.payloadsRead()).toHaveLength(6);

    const warm = fakeClient(t, "f1");
    const after = await rescoreStored(warm.db, dry);
    expect(warm.answered.filter((a) => a.table === "fetch_facts")).toHaveLength(1);
    expect(payloadRequests(warm.answered)).toEqual([]);
    expect(after.summary.replace(/^- read ≈ .*$/m, "")).toEqual(before.summary.replace(/^- read ≈ .*$/m, ""));
    // A render drew the site after its Cloudflare page: the site was measured, and keeps its score.
    expect(after.summary).not.toContain("**0 → —**");
  });
});
