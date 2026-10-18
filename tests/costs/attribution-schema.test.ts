// tests/costs/attribution-schema.test.ts — issue 1478, against a live schema.
//
// Every paid call names one site or one named segment, and why it was made;
// a scan's and a draft's roll-up is the ledger's own sum, whatever the
// process that spent wrote; a free scan's spend is the site's it became;
// and a billed figure that is missing stays missing. The rows already in the
// ledger get the same at 0¢ when the migration is applied.
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../db/substrate";
import { acceptanceFor, seededVolume, writeEvidence } from "../ui/layout/seed-rows";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const THIS = "20261017130000_fetches_attribution.sql";
const ALL = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
const BEFORE = ALL.filter((name) => name < THIS);
const AFTER = ALL.filter((name) => name >= THIS);

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function apply(files: readonly string[]): void {
  for (const file of files) psql(["-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(MIGRATIONS, file)]);
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

let n = 0;
function site(domain: string, provisionedFrom: string | null = null): string {
  n += 1;
  const user = value(`insert into users (email, plan_status) values ('owner-${n}@example.org', 'active') returning id;`)!;
  return value(
    `insert into sites (user_id, domain, provisioned_from_scan_id) values ('${user}', '${domain}', ${provisionedFrom === null ? "null" : `'${provisionedFrom}'`}) returning id;`
  )!;
}

function scan(a: { domain: string; tier: "free" | "deep" | "weekly"; siteId?: string; smoke?: boolean; at?: string }): string {
  return value(
    `insert into scans (site_id, domain, tier, status, smoke, created_at) values (${a.siteId === undefined ? "null" : `'${a.siteId}'`}, ` +
      `'${a.domain}', '${a.tier}', 'running', ${a.smoke === true}, ${a.at === undefined ? "now()" : `timestamptz '${a.at}'`}) returning id;`
  )!;
}

function draft(siteId: string, scanId: string, at = "now()"): string {
  n += 1;
  // The layout sweep's own Write row: every check on `opportunities` holds.
  const opportunity = value(
    `insert into opportunities (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, volume, fit_band, effort, evidence, acceptance) values ` +
      `('${siteId}', '${scanId}', 'answer_page', 'write', 'a query ${n}', 'target-${n}', 'slug-${n}', 'A title', ${seededVolume(0)}, 'winnable', 0.5, '${writeEvidence(0)}'::jsonb, '${acceptanceFor(0)}'::jsonb) returning id;`
  )!;
  return value(
    `insert into drafts (opportunity_id, site_id, state, title, cost_cents, created_at) values ('${opportunity}', '${siteId}', 'generating', 'A title', 0, ${at}) returning id;`
  )!;
}

function call(a: { scanId: string; source?: string; cents: number; billed?: number; payload?: object; activity?: string; draftId?: string; at?: string }): string {
  // A row before the migration has neither column, so a call names only what it is given.
  const named = { ...(a.activity === undefined ? {} : { activity: `'${a.activity}'` }), ...(a.draftId === undefined ? {} : { draft_id: `'${a.draftId}'` }) };
  return value(
    `insert into fetches (scan_id, source, cache_key, policy_version, reserved_cents, cost_cents, billed_cents, payload, created_at${Object.keys(named).map((c) => `, ${c}`).join("")}) values (` +
      `'${a.scanId}', '${a.source ?? "serp/google/organic"}', 'k-${(n += 1)}', 1, ${a.cents}, ${a.cents}, ${a.billed ?? "null"}, '${JSON.stringify(a.payload ?? {})}'::jsonb, ` +
      `${a.at === undefined ? "now()" : `timestamptz '${a.at}'`}${Object.values(named).map((v) => `, ${v}`).join("")}) returning id;`
  )!;
}

function row(id: string): { site_id: string; activity: string; outcome: string; draft_id: string } {
  const [site_id = "", activity = "", outcome = "", draft_id = ""] = psqlRows(`select site_id, activity, outcome, draft_id from fetches where id = '${id}';`)[0] ?? [];
  return { site_id, activity, outcome, draft_id };
}

describe("the rows already in the ledger are attributed when the migration is applied, at 0¢", () => {
  const ids: Record<string, string> = {};

  beforeAll(() => {
    resetSchema();
    apply(BEFORE);
    // Rows as the product wrote them before 2026-10-17: a scan and nothing else.
    const siteId = site("old-site-fixture.com");
    ids.site = siteId;
    const deep = scan({ domain: "old-site-fixture.com", tier: "deep", siteId, at: "2026-10-01T08:00:00Z" });
    run(`update scans set finished_at = timestamptz '2026-10-01T08:05:00Z' where id = '${deep}';`);
    const later = scan({ domain: "old-site-fixture.com", tier: "deep", siteId, at: "2026-10-05T08:00:00Z" });
    const free = scan({ domain: "stranger.com", tier: "free" });
    const smoke = scan({ domain: "smoke.com", tier: "free", smoke: true });
    const page = draft(siteId, deep, "timestamptz '2026-10-02T10:00:30Z'");
    run(`update drafts set cost_cents = 9 where id = '${page}';`);
    ids.page = page;
    ids.deep = deep;
    ids.passCall = call({ scanId: deep, cents: 2, at: "2026-10-01T08:01:00Z" });
    ids.writeCall = call({ scanId: deep, source: "generate.write", cents: 4, payload: { parseOutcome: "success" }, at: "2026-10-02T10:00:00Z" });
    ids.researchCall = call({ scanId: deep, cents: 0.2, at: "2026-10-02T10:00:10Z" });
    ids.checkCall = call({ scanId: deep, source: "generate.fit_check", cents: 1, at: "2026-10-02T10:00:40Z" });
    ids.laterCall = call({ scanId: later, cents: 3, at: "2026-10-05T08:01:00Z" });
    ids.timeout = call({ scanId: free, cents: 0.2, payload: { vendorFailure: "timeout", endpoint: "serp/google/organic", billed: true } });
    ids.failed = call({ scanId: free, source: "question-phrasing", cents: 0.3, payload: { parseOutcome: "unparseable", failure: "parse" } });
    ids.smoke = call({ scanId: smoke, cents: 0.2 });
    // The roll-up a pass wrote with a call still in flight.
    run(`update scans set cost_cents = 3.4 where id = '${deep}';`);
    apply(AFTER);
  });

  it("a pass's call names its site and why it was made", () => {
    expect(row(ids.passCall!)).toMatchObject({ site_id: ids.site, activity: "onboarding", outcome: "ok" });
    expect(row(ids.laterCall!)).toMatchObject({ activity: "rescore" });
    expect(row(ids.smoke!)).toMatchObject({ site_id: "", activity: "smoke" });
  });

  it("a draft's model calls and the reads between them are the draft's", () => {
    expect(row(ids.writeCall!)).toMatchObject({ activity: "draft", draft_id: ids.page });
    expect(row(ids.checkCall!)).toMatchObject({ activity: "draft", draft_id: ids.page });
    expect(row(ids.researchCall!)).toMatchObject({ activity: "draft", draft_id: ids.page });
  });

  it("a timed-out call and a failed one are told apart", () => {
    expect(row(ids.timeout!)).toMatchObject({ activity: "free_scan", outcome: "timeout" });
    expect(row(ids.failed!)).toMatchObject({ outcome: "failed" });
  });

  it("the scan's figure becomes the ledger's, and the draft keeps its own", () => {
    expect(value(`select cost_cents from scans where id = '${ids.deep}';`)).toBe("2.0000");
    expect(value(`select cost_cents from drafts where id = '${ids.page}';`)).toBe("9.0000");
    expect(value(`select carried_cents from drafts where id = '${ids.page}';`)).toBe("3.8000");
  });
});

describe("every new call is attributed, and every roll-up is the ledger's", () => {
  beforeAll(() => {
    resetSchema();
    apply(ALL);
  });

  afterAll(() => {
    resetSchema();
  });

  it("the database names the site and the activity a writer left out", () => {
    const siteId = site("shop-fixture.com");
    const weekly = scan({ domain: "shop-fixture.com", tier: "weekly", siteId });
    expect(row(call({ scanId: weekly, cents: 1 }))).toMatchObject({ site_id: siteId, activity: "weekly", outcome: "ok" });
    expect(row(call({ scanId: scan({ domain: "example.com", tier: "free" }), cents: 1 }))).toMatchObject({ activity: "test" });
  });

  it("a scan's cost is the ledger's sum over it, whatever the process wrote, and a draft's calls are not in it", () => {
    const siteId = site("plumber-fixture.com");
    const deep = scan({ domain: "plumber-fixture.com", tier: "deep", siteId });
    call({ scanId: deep, cents: 1.25 });
    call({ scanId: deep, cents: 0.75 });
    call({ scanId: deep, cents: 5, activity: "draft" });
    // A close that counted a call still in flight.
    run(`update scans set cost_cents = 2.6, status = 'done' where id = '${deep}';`);
    expect(value(`select cost_cents from scans where id = '${deep}';`)).toBe("2.0000");
    // A retry carries the report's earlier spend.
    run(`update scans set carried_cents = 4 where id = '${deep}';`);
    expect(value(`select cost_cents from scans where id = '${deep}';`)).toBe("6.0000");
  });

  it("a draft's cost is the sum of the calls named for it, and naming them later moves them", () => {
    const siteId = site("cafe-fixture.com");
    const deep = scan({ domain: "cafe-fixture.com", tier: "deep", siteId });
    const first = draft(siteId, deep);
    const second = draft(siteId, deep);
    const early = call({ scanId: deep, cents: 3, activity: "draft" });
    run(`update fetches set draft_id = '${first}' where id = '${early}';`);
    call({ scanId: deep, cents: 1.5, activity: "draft", draftId: first });
    expect(value(`select cost_cents from drafts where id = '${first}';`)).toBe("4.5000");
    run(`update fetches set draft_id = '${second}' where id = '${early}';`);
    expect(value(`select cost_cents from drafts where id = '${first}';`)).toBe("1.5000");
    expect(value(`select cost_cents from drafts where id = '${second}';`)).toBe("3.0000");
    // The pipeline's own write is replaced by the ledger's.
    run(`update drafts set cost_cents = 99 where id = '${second}';`);
    expect(value(`select cost_cents from drafts where id = '${second}';`)).toBe("3.0000");
  });

  it("a free scan's spend is the site's it became, and a missing charge is not a zero", () => {
    const free = scan({ domain: "bakery-fixture.com", tier: "free" });
    call({ scanId: free, cents: 0.2, billed: 0.12 });
    call({ scanId: free, cents: 0.2 });
    const siteId = site("bakery-fixture.com", free);
    const [line] = psqlRows(
      `select site_id, segment, calls, estimated_cents, billed_cents, billed_calls, judged_cents from cost_site_day where site_id = '${siteId}';`
    );
    expect(line).toEqual([siteId, "", "2", "0.4000", "0.1200", "1", "0.3200"]);

    const unpriced = scan({ domain: "stranger-fixture.com", tier: "free" });
    call({ scanId: unpriced, source: "question-phrasing", cents: 0.3 });
    const [free_] = psqlRows(
      `select segment, vendor, billed_cents is null, billed_calls from cost_site_day where site_id is null and vendor = 'anthropic';`
    );
    expect(free_).toEqual(["free", "anthropic", "t", "0"]);
  });

  it("no session reaches a cost figure", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["vendor_days", "cost_site_day"]) {
        expect(value(`select has_table_privilege('${role}', 'public.${table}', 'select');`), `${role} on ${table}`).toBe("f");
      }
    }
    expect(value(`select relrowsecurity from pg_class where relname = 'vendor_days';`)).toBe("t");
    expect(value(`select count(*) from pg_policies where tablename = 'vendor_days';`)).toBe("0");
  });

  it("one vendor's day is one row", () => {
    run("delete from vendor_days;");
    run(`insert into vendor_days (vendor, day, kind, billed_cents, source) values ('dataforseo', '2026-10-16', 'usage', 99.13, 'balance');`);
    expect(() =>
      run(`insert into vendor_days (vendor, day, kind, billed_cents, source) values ('dataforseo', '2026-10-16', 'usage', 1, 'balance');`)
    ).toThrow();
    run(`insert into vendor_days (vendor, day, kind, domain, estimated_cents, source) values ('dataforseo', '2026-10-16', 'box', 'panel-site-fixture.com', 4, 'spend_log');`);
    expect(value(`select count(*) from vendor_days where day = '2026-10-16';`)).toBe("2");
  });
});
