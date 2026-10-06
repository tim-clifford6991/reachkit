// SPEC §7 (D53, issue 1268) — a live page of ours is rewritten in place for
// a new search: an update of its own address, written as the new search's
// own type.
import "./env";
import { describe, expect, it } from "vitest";
import { contentTypeOf } from "../../src/lib/opportunities/content-type";
import { insertFor } from "../../src/lib/opportunities/derive/persist";
import { pageTypeOf } from "../../src/lib/opportunities/page-type";
import { retargetCandidate } from "../../src/lib/opportunities/retarget";
import { ASSET_KIND_OF, isOwnRefresh, type Opportunity } from "../../src/lib/opportunities/types";
import { retargetSql } from "../../scripts/retarget/run";

const AT = new Date("2026-10-05T12:00:00.000Z");
const URL = "https://content.reachkit.app/best-answer-engine-optimization-services";
const TARGET = "best AI visibility tools for small businesses";

/** The row the 3 October page was written for. */
const WRITTEN = {
  siteId: "site-1",
  scanId: "scan-1",
  type: "keyword_page",
  family: "write",
  targetQuery: "best answer engine optimization services",
  fitBand: "winnable",
  businessFit: 3,
  source: "product",
} as unknown as Opportunity;

describe("D53 — a published page becomes an update topic with a new target", () => {
  const candidate = retargetCandidate({ url: URL, row: WRITTEN }, { target: `  ${TARGET} `, volume: 1600, at: AT });

  it("is an update of the page's own address, for the new search", () => {
    expect(ASSET_KIND_OF[candidate.type]).toBe("update");
    expect(candidate.family).toBe("improve");
    expect(candidate.targetRef).toBe(URL);
    expect(candidate.targetQuery).toBe(TARGET);
    expect(candidate.acceptance).toEqual({ form: "top20", query: TARGET });
    expect(isOwnRefresh(candidate)).toBe(true);
  });

  it("is written as the new search's own type, not as a refresh of what is live", () => {
    expect(contentTypeOf(candidate)).toBe("listicle");
    expect(pageTypeOf(candidate)).toBe("market_comparison");
    // The fit and source judged for the old search are not carried.
    expect(candidate.businessFit).toBeNull();
    expect(candidate.source).toBeNull();
    // An ordinary refresh of the same page stays an update.
    const due = { ...candidate, evidence: { ...candidate.evidence, shortfall: { kind: "due" } } } as unknown as Opportunity;
    expect(contentTypeOf(due)).toBe("update");
    expect(pageTypeOf(due)).toBeNull();
  });

  it("the operator's statement inserts that row, off the live page's own row", () => {
    const sql = retargetSql({ url: "https://content.reachkit.app/it's-live", target: TARGET, volume: null, at: AT });
    const row = insertFor(retargetCandidate({ url: "https://content.reachkit.app/it's-live", row: WRITTEN }, { target: TARGET, volume: null, at: AT }));
    expect(sql).toContain("insert into opportunities");
    // Column for column what the product's own insert writes.
    expect(row).toMatchObject({ proposed_slug: null, title: null, volume: null, business_fit: null, source: null });
    expect(sql).toContain(`'refresh_page', 'improve', '${TARGET}', p.live_url, null, null, null,`);
    expect(sql).toContain(`${JSON.stringify(row.evidence).replace(/'/g, "''")}'::jsonb`);
    expect(sql).toContain(`'${JSON.stringify(row.acceptance)}'::jsonb`);
    expect(sql).toContain(`o.fit_band, null, null, '${row.page_type}', ${row.effort}`);
    // The site, the scan and the band are the page's own row's, read where it runs.
    expect(sql).toMatch(/select\s+o\.site_id, o\.scan_id,/);
    expect(sql).toContain("p.live_url = 'https://content.reachkit.app/it''s-live'");
    expect(sql).toContain("p.unpublished_at is null");
    expect(sql).not.toContain("site-1");
  });
});
