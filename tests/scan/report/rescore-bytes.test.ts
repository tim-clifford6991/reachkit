// What a scoring deploy downloads, on a store seeded the way production was
// on 2026-11-01: 242 scans, 230 home and rendered reads, 170 own reads of site
// scans. A home or rendered read is as long as zapier.com's stored home read
// says it was (404,884 bytes); another own page is production's mean (19.74 MB
// over 170). The first run at a facts version downloads each payload once; a
// run at the same version downloads facts and reports alone.
import { describe, expect, it } from "vitest";
import { rescoreStored } from "../../../src/lib/scan/rescore-run";
import { fakeClient, fixture } from "./rescore-store";

const zapier = fixture("zapier.com");
const home = zapier.home as { created_at: string; payload: { bytes: number; readAt: string } };
const BLOCK = '<section><h2>How does it work?</h2><p>Connect 7,000 apps in 3 steps; 2.2 million teams since 2011.</p><a href="/pricing">Pricing</a></section>';
const pageOf = (bytes: number) => `<html lang="en"><head><title>A site</title></head><body>${BLOCK.repeat(Math.ceil(bytes / BLOCK.length))}</body></html>`;
const [HOME, OWN] = [pageOf(home.payload.bytes), pageOf(19.74e6 / 170)];
const read = (id: string, url: string, html: string, at: string, scan_id: string | null, source = "egress.safeFetch") => {
  const doc = { url, status: 200, html, bytes: html.length, readAt: at };
  return { id, source, cache_key: url, created_at: at, scan_id, payload: source === "egress.safeFetch" ? doc : [doc] };
};

function seeded(): Record<string, Record<string, unknown>[]> {
  const scans = [];
  const fetches = [];
  for (let d = 0; d < 115; d += 1) {
    const [domain, site] = [`shop-${d}.com`, d < 34 ? `shop-${d}.com-0` : null];
    const report = { ...zapier.report, domain, tier: site === null ? "free" : "weekly" };
    for (let n = 0; n < (d < 12 ? 3 : 2); n += 1) {
      scans.push({ status: zapier.status, score: zapier.score, drivers: zapier.drivers, id: `${domain}-${n}`, domain, created_at: `2026-10-0${n + 1}T00:00:00Z`, report, site_id: n === 0 && site !== null ? `site-${d}` : null, is_current: false });
    }
    fetches.push(read(`${domain}/home`, `https://${domain}/`, HOME, home.payload.readAt, site), read(`${domain}/rendered`, `https://${domain}/`, HOME, home.payload.readAt, null, "on_page/instant_pages"));
    if (site !== null) for (let p = 0; p < 4; p += 1) fetches.push(read(`${domain}/${p}`, `https://${domain}/guide-${p}`, OWN, `2026-10-06T03:44:0${p}Z`, site));
  }
  // `rescore_reports` pages in `(created_at, id)` order.
  return { scans: scans.sort((a, b) => `${a.created_at}${a.id}`.localeCompare(`${b.created_at}${b.id}`)), fetches, publications: [], sites: [], site_profiles: [] };
}

describe("a scoring deploy at an unchanged facts version downloads no page", () => {
  it("reads under a quarter of what the payloads come to, and no page's html", async () => {
    const tables = seeded();
    expect([tables.scans!.length, tables.fetches!.filter((r) => /\/(home|rendered)$/.test(String(r.id))).length, tables.fetches!.filter((r) => r.scan_id !== null).length]).toEqual([242, 230, 170]);
    const o = { apply: false, version: "abc1234", at: new Date("2026-11-01T12:00:00Z") };
    const cold = fakeClient(tables, "f1");
    const first = await rescoreStored(cold.db, { ...o, derivation: "d1" });
    const warm = fakeClient(tables, "f1");
    const second = await rescoreStored(warm.db, { ...o, derivation: "d2" });
    const [full, now] = [cold.db.readBytes!(), warm.db.readBytes!()];
    expect([first.scansRead, second.scansRead, now.refresh]).toEqual([242, 242, 0]);
    expect(full.refresh).toBeGreaterThan(100e6);
    expect(now.read).toBeLessThan(full.read * 0.25);
    expect(JSON.stringify([warm.answered.map((a) => a.rows), warm.rpcs.map((c) => c.rows)])).not.toContain('"html"');
    expect(second.summary.replace(/^- read ≈ .*$/m, "")).toEqual(first.summary.replace(/^- read ≈ .*$/m, ""));
  }, 120_000);
});
