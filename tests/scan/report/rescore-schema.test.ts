// Issue 1433 — `rescore_runs`, `report_md5` and `rescore_scan`, against a
// live database.
//
// The guarded write the production re-score makes, exercised rather than
// read: it rewrites only the paths it is handed, keeps the report it
// replaced and the columns it replaced, stamps who re-scored it, and writes
// nothing at all where the report's checksum is no longer the one the job
// read — which is what leaves a scan written in between alone, and what makes
// a stale second apply change nothing. `rescore_runs` is the master session's
// request: RLS on, no policy, so no session reaches it.
//
// A `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), run
// against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const APPLIED = [
  "00000000000001_baseline.sql",
  "00000000000002_rls.sql",
  "20260904110000_scans_current.sql",
  "20261014130000_scans_rescore.sql",
  "20261017140000_scans_rescore_auto.sql",
  "20261101130000_scans_rescore_reads.sql",
  "20261103180000_scans_rescore_reads_ids_first.sql",
  "20260903080000_fetches.sql",
  "20261101140000_fetches_facts.sql",
  "20261102120000_fetches_text.sql",
];
const FACTS = "20261101140000_fetches_facts.sql";
const IDS_FIRST = "20261103180000_scans_rescore_reads_ids_first.sql";

const readsCatalog = () =>
  psqlRows(
    "select pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), p.provolatile, p.prosecdef, array_to_string(p.proconfig, ','), array_to_string(p.proacl, ',') from pg_proc p where p.proname = 'rescore_reports';"
  );
let readsBefore: string[][] = [];

const fetchesColumns = () => psqlRows("select column_name, data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_name = 'fetches' order by ordinal_position;");
let fetchesBefore: string[][] = [];

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function raises(sql: string): boolean {
  try {
    run(sql);
    return false;
  } catch {
    return true;
  }
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

const REPORT = {
  domain: "gusto.com",
  verdict: { scoreAndBand: { kind: "measured", value: { score: 0, band: "invisible" } } },
  aiAnswers: { rows: [{ cell: "cited", engines: [{ engine: "chatgpt", cell: "cited" }, { engine: "ai_overview", cell: "cited" }] }] },
  complete: true,
};

function scan(): string {
  const id = value(
    `insert into scans (domain, tier, status, score, drivers, report) values ('gusto.com', 'free', 'done', 0, '{"foundations":{"kind":"measured","value":0}}', '${JSON.stringify(REPORT)}'::jsonb) returning id;`
  );
  if (id === undefined) throw new Error("scan insert returned no id");
  return id;
}

function md5Of(id: string): string {
  return value(`select report_md5(s) from scans s where id = '${id}';`)!;
}

function rescore(id: string, md5: string, changes: unknown, by = "abc1234"): boolean {
  return (
    value(
      `select rescore_scan('${id}', '${md5}', '${JSON.stringify(changes)}'::jsonb, null, 'degraded', '{"foundations":{"kind":"unmeasured"}}'::jsonb, '2026-10-14T12:00:00.000Z', '${by}');`
    ) === "t"
  );
}

const CHANGES = [
  { path: ["verdict", "scoreAndBand"], value: { kind: "unmeasured", reason: "undeterminable" } },
  { path: ["complete"], value: false },
  { path: ["aiAnswers", "rows", "0", "engines", "1", "cell"], value: "absent" },
];

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) {
    if (file === FACTS) fetchesBefore = fetchesColumns();
    if (file === IDS_FIRST) readsBefore = readsCatalog();
    psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  }
});

afterAll(() => {
  resetSchema();
});

describe("rescore_scan — the production re-score's one write", () => {
  it("report_md5 is the stored report's checksum", () => {
    const id = scan();
    expect(md5Of(id)).toBe(value(`select md5(report::text) from scans where id = '${id}';`));
  });

  it("rewrites only the paths it is handed, keeps the report and columns it replaced, and stamps the commit", () => {
    const id = scan();
    expect(rescore(id, md5Of(id), CHANGES)).toBe(true);
    const report = JSON.parse(value(`select report from scans where id = '${id}';`)!) as Record<string, unknown>;
    expect(report.verdict).toEqual({ scoreAndBand: { kind: "unmeasured", reason: "undeterminable" } });
    expect(report.complete).toBe(false);
    expect(report.aiAnswers).toEqual({ rows: [{ cell: "cited", engines: [{ engine: "chatgpt", cell: "cited" }, { engine: "ai_overview", cell: "absent" }] }] });
    expect(report.domain).toBe("gusto.com");
    expect(report.previous).toEqual(REPORT);
    expect(report.previousColumns).toEqual({ score: 0, status: "done", drivers: { foundations: { kind: "measured", value: 0 } } });
    expect(report).toMatchObject({ rescoredAt: "2026-10-14T12:00:00.000Z", rescoredBy: "abc1234" });
    expect(psqlRows(`select score is null, status from scans where id = '${id}';`)[0]).toEqual(["t", "degraded"]);
  });

  it("writes nothing where the report changed after it was read", () => {
    const id = scan();
    const read = md5Of(id);
    run(`update scans set report = report || '{"complete": false}'::jsonb where id = '${id}';`);
    const between = value(`select report::text from scans where id = '${id}';`);
    expect(rescore(id, read, CHANGES)).toBe(false);
    expect(value(`select report::text from scans where id = '${id}';`)).toBe(between);
    expect(value(`select score from scans where id = '${id}';`)).toBe("0");
  });

  it("a second re-score keeps the first originals, not the report the first one wrote", () => {
    const id = scan();
    expect(rescore(id, md5Of(id), CHANGES, "first")).toBe(true);
    expect(rescore(id, md5Of(id), [{ path: ["complete"], value: true }], "second")).toBe(true);
    const report = JSON.parse(value(`select report from scans where id = '${id}';`)!) as Record<string, unknown>;
    expect(report.previous).toEqual(REPORT);
    expect(report.previousColumns).toMatchObject({ score: 0, status: "done" });
    expect(report.rescoredBy).toBe("second");
    expect((report.previous as Record<string, unknown>).previous).toBeUndefined();
  });
});

describe("rescore_scan — a true means every change landed", () => {
  function call(id: string, md5: string, changes: unknown): string {
    return `select rescore_scan('${id}', '${md5}', '${JSON.stringify(changes)}'::jsonb, null, 'degraded', null, '2026-11-01T12:00:00.000Z', 'abc1234');`;
  }

  it("raises and writes nothing where a change's parent is missing or its index is past the array", () => {
    for (const lost of [
      { path: ["missing", "child"], value: 1 },
      { path: ["aiAnswers", "rows", "5"], value: { cell: "absent" } },
    ]) {
      const id = scan();
      const before = value(`select report::text || score from scans where id = '${id}';`);
      expect(raises(call(id, md5Of(id), [CHANGES[1], lost]))).toBe(true);
      expect(value(`select report::text || score from scans where id = '${id}';`)).toBe(before);
    }
  });

  it("a new key under a parent that exists lands, and a stale checksum still writes nothing", () => {
    const id = scan();
    const read = md5Of(id);
    expect(rescore(id, read, [{ path: ["verdict", "fresh"], value: true }])).toBe(true);
    expect(value(`select report->'verdict'->>'fresh' from scans where id = '${id}';`)).toBe("true");
    expect(rescore(id, read, [{ path: ["complete"], value: false }])).toBe(false);
    expect(value(`select report->>'complete' from scans where id = '${id}';`)).toBe("true");
  });
});

/** The writes `rescore-write.test.ts` computes for gusto.com's report wound
 *  back to versions 6 and 12, kept so this suite imports no scan code. */
const OLD_VERSIONS = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures/rescore/old-versions.json"), "utf8")) as Record<
  string,
  {
    stored: { status: string; score: number | null; drivers: unknown; report: Record<string, unknown> };
    write: { changes: { path: string[]; value: Record<string, unknown> }[]; score: number | null; status: string; drivers: unknown };
  }
>;

const lit = (json: unknown): string => `'${JSON.stringify(json).replaceAll("'", "''")}'::jsonb`;

describe("rescore_scan — a re-score of an older blob, through the function", () => {
  for (const [version, { stored, write }] of Object.entries(OLD_VERSIONS)) {
    it(`a version-${version} blob takes the whole upgraded report and keeps the original`, () => {
      const id = value(
        `insert into scans (domain, tier, status, score, drivers, report) values ('gusto.com', 'free', '${stored.status}', ${stored.score ?? "null"}, ${lit(stored.drivers)}, ${lit(stored.report)}) returning id;`
      )!;
      const wrote = value(
        `select rescore_scan('${id}', '${md5Of(id)}', ${lit(write.changes)}, ${write.score ?? "null"}, '${write.status}', ${lit(write.drivers)}, '2026-11-01T12:00:00.000Z', 'abc1234');`
      );
      expect(wrote).toBe("t");
      const report = JSON.parse(value(`select report from scans where id = '${id}';`)!) as Record<string, unknown>;
      const { previous, previousColumns, rescoredAt, rescoredBy, ...rest } = report;
      void rescoredAt;
      void rescoredBy;
      expect(rest).toEqual(write.changes[0]!.value);
      expect(previous).toEqual(stored.report);
      expect(previousColumns).toEqual({ score: stored.score, status: stored.status, drivers: stored.drivers });
      expect(psqlRows(`select score, status from scans where id = '${id}';`)[0]).toEqual([String(write.score ?? ""), write.status]);
    });
  }
});

describe("rescore_reports — the re-score's read, without the kept copy", () => {
  it("returns a re-scored report without the four keys, with the checksum rescore_scan guards on", () => {
    run("delete from scans;");
    const first = scan();
    const rescored = scan();
    run(`update scans set created_at = created_at + interval '1 second' where id = '${rescored}';`);
    run("insert into scans (domain, tier, status) values ('gusto.com', 'free', 'running');");
    expect(rescore(rescored, md5Of(rescored), CHANGES)).toBe(true);
    const rows = psqlRows("select id, report::text, report_md5 from rescore_reports();");
    expect(rows.map((r) => r[0])).toEqual([first, rescored]);
    const report = JSON.parse(rows[1]![1]!) as Record<string, unknown>;
    for (const key of ["previous", "previousColumns", "rescoredAt", "rescoredBy"]) expect(report).not.toHaveProperty(key);
    expect(report.complete).toBe(false);
    expect(rows[1]![2]).toBe(md5Of(rescored));
    expect(rescore(rescored, rows[1]![2]!, [{ path: ["complete"], value: true }])).toBe(true);
  });

  it("pages after (created_at, id), a page at a time", () => {
    run("delete from scans;");
    const ids = [scan(), scan(), scan()];
    run(`update scans set created_at = '2026-11-01T00:00:00Z';`);
    const all = psqlRows("select id, created_at from rescore_reports(null, null, 10);");
    expect(all.map((r) => r[0])).toEqual([...ids].sort());
    const [id, at] = all[0]!;
    const page = psqlRows(`select id from rescore_reports('${at}', '${id}', 1);`);
    expect(page.map((r) => r[0])).toEqual([all[1]![0]]);
  });
});

/** `rescore_reports` as `20261101130000_scans_rescore_reads.sql` wrote it:
 *  the trim and checksum in the same select as the order and limit. */
const BEFORE_BODY = `
  select s.id, s.domain, s.created_at, s.status, s.score, s.drivers,
         s.report - 'previous' - 'previousColumns' - 'rescoredAt' - 'rescoredBy',
         md5(s.report::text), s.site_id, s.is_current
    from public.scans s
   where s.report is not null
     and (p_after_created_at is null or (s.created_at, s.id) > (p_after_created_at, p_after_id))
   order by s.created_at, s.id
   limit p_limit`;

type PlanNode = { "Node Type": string; Output?: string[]; "Sort Key"?: string[]; "Actual Rows": number; "Actual Loops": number; Plans?: PlanNode[] };

/** A body's executed plan for the first page of 25, its parameters left
 *  generic as the function's own cached plan has them. */
function planOf(body: string): PlanNode {
  const sql = body.replace(/\bp_after_created_at\b/g, "$1").replace(/\bp_after_id\b/g, "$2").replace(/\bp_limit\b/g, "$3");
  const out = psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    `set plan_cache_mode = force_generic_plan; prepare page(timestamptz, uuid, integer) as ${sql}; explain (analyze, verbose, format json) execute page(null, null, 25);`,
  ]);
  return (JSON.parse(out) as { Plan: PlanNode }[])[0]!.Plan;
}

function nodes(node: PlanNode, under: PlanNode[] = []): { node: PlanNode; under: PlanNode[] }[] {
  return [{ node, under }, ...(node.Plans ?? []).flatMap((child) => nodes(child, [...under, node]))];
}

const hashes = (node: PlanNode) => (node.Output ?? []).some((o) => o.includes("md5("));

/** Every node that checksums a report sees at most a page of rows, above a
 *  limit that carries no report and sorts on `(created_at, id)` alone. */
function hashesOnlyThePage(plan: PlanNode): boolean {
  const all = nodes(plan);
  const hashing = all.filter(({ node }) => hashes(node));
  const keysetLimit = all.some(
    ({ node, under }) =>
      node["Node Type"] === "Limit" &&
      !(node.Output ?? []).some((o) => o.includes("report")) &&
      under.some(hashes) &&
      nodes(node).some(({ node: sort }) => sort["Sort Key"]?.every((k) => /\.(created_at|id)$/.test(k)) === true)
  );
  return hashing.length > 0 && hashing.every(({ node }) => node["Actual Rows"] * node["Actual Loops"] <= 25) && keysetLimit;
}

describe("rescore_reports — a page's ids first, then its reports", () => {
  const page = (fn: string, after: string[] | undefined, limit: number) =>
    psqlRows(`select * from ${fn}(${after ? `'${after[2]}', '${after[0]}'` : "null, null"}, ${limit});`);

  function walk(fn: string, limit: number): string[][][] {
    const pages: string[][][] = [];
    for (let rows = page(fn, undefined, limit); rows.length > 0; rows = page(fn, rows.at(-1), limit)) pages.push(rows);
    return pages;
  }

  beforeAll(() => {
    run("delete from scans;");
    // Sixty scans, three to a timestamp; every seventh has no report and every fourth carries a re-score's kept copy.
    run(`insert into scans (domain, tier, status, score, created_at, report)
      select 'site' || g || '.example', 'free', 'done', g,
             '2026-11-01T00:00:00Z'::timestamptz + (g / 3) * interval '1 second',
             case when g % 7 = 0 then null
                  else jsonb_build_object('domain', 'site' || g || '.example', 'n', g, 'body', repeat(md5(g::text), 200))
                       || case when g % 4 = 0 then '{"previous": {"n": 0}, "previousColumns": {"score": 1}, "rescoredAt": "2026-11-01T12:00:00.000Z", "rescoredBy": "abc1234"}'::jsonb else '{}'::jsonb end
             end
        from generate_series(1, 60) g;`);
    run(`create function rescore_reports_before(p_after_created_at timestamptz default null, p_after_id uuid default null, p_limit integer default 25)
      returns table (id uuid, domain text, created_at timestamptz, status text, score integer, drivers jsonb, report jsonb, report_md5 text, site_id uuid, is_current boolean)
      language sql stable set search_path = '' as $$${BEFORE_BODY}$$;`);
  });

  afterAll(() => run("drop function rescore_reports_before(timestamptz, uuid, integer);"));

  it("returns byte-identical pages to the body it replaced, report and checksum included", () => {
    for (const limit of [25, 2]) {
      const now = walk("rescore_reports", limit);
      expect(now.length).toBeGreaterThan(2);
      expect(now).toEqual(walk("rescore_reports_before", limit));
    }
    expect(psqlRows("select count(*) from rescore_reports(null, null, 100) where report ? 'previous' or report ? 'rescoredAt';")).toEqual([["0"]]);
  });

  it("pages every scan with a report exactly once in (created_at, id) order, ties broken by id, from the first row on null", () => {
    const expected = psqlRows("select id from scans where report is not null order by created_at, id;").map((r) => r[0]);
    expect(value("select count(*) > count(distinct created_at) from scans where report is not null;")).toBe("t");
    for (const limit of [25, 2]) {
      expect(walk("rescore_reports", limit).flat().map((r) => r[0])).toEqual(expected);
      expect(page("rescore_reports", undefined, limit)[0]![0]).toBe(expected[0]);
    }
  });

  it("checksums and trims only the page's rows, after a limit sorted on (created_at, id)", () => {
    expect(hashesOnlyThePage(planOf(BEFORE_BODY))).toBe(false);
    expect(hashesOnlyThePage(planOf(psql(["-v", "ON_ERROR_STOP=1", "-At", "-c", "select prosrc from pg_proc where proname = 'rescore_reports';"])))).toBe(true);
  });

  it("keeps the signature, result, volatility, security, search_path and grants of the function it replaced", () => {
    expect(readsBefore).toHaveLength(1);
    expect(readsCatalog()).toEqual(readsBefore);
    expect(readsBefore[0]!.slice(2, 5)).toEqual(["s", "f", 'search_path=""']);
  });
});

describe("rescore_runs — the master session's request", () => {
  it("is a dry run unless it says apply, and says nothing else", () => {
    const id = value("insert into rescore_runs default values returning id;");
    expect(value(`select mode from rescore_runs where id = '${id}';`)).toBe("dry");
    expect(raises("insert into rescore_runs (mode) values ('apply');")).toBe(false);
    expect(raises("insert into rescore_runs (mode) values ('wet');")).toBe(true);
  });

  it("no customer's session reaches it, and no function is theirs to call", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'rescore_runs';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'rescore_runs';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      expect(value(`select has_function_privilege('${role}', 'rescore_scan(uuid, text, jsonb, integer, text, jsonb, text, text)', 'execute');`)).toBe("f");
      expect(value(`select has_function_privilege('${role}', 'report_md5(scans)', 'execute');`)).toBe("f");
      expect(value(`select has_function_privilege('${role}', 'rescore_reports(timestamptz, uuid, integer)', 'execute');`)).toBe("f");
      expect(value(`select has_table_privilege('${role}', 'rescore_runs', 'select');`)).toBe("f");
    }
    expect(value("select has_function_privilege('service_role', 'rescore_scan(uuid, text, jsonb, integer, text, jsonb, text, text)', 'execute');")).toBe("t");
    expect(value("select has_function_privilege('service_role', 'rescore_reports(timestamptz, uuid, integer)', 'execute');")).toBe("t");
  });
});

describe("rescore_runs — the tick's own request and its answer (issue 1481)", () => {
  it("a row nobody marks auto is a person's; the tick's records its derivation, its guard and the scans still stale", () => {
    const person = value("insert into rescore_runs (mode) values ('dry') returning id;");
    expect(value(`select auto from rescore_runs where id = '${person}';`)).toBe("f");
    const scanId = scan();
    const id = value("insert into rescore_runs (mode, auto) values ('dry', true) returning id;");
    run(
      `update rescore_runs set finished_at = now(), derivation = 'f026342a5919', held = 'gusto.com loses its score (0 → none)', scans_unreadable = 0, stale_scans = array['${scanId}']::uuid[] where id = '${id}';`
    );
    expect(psqlRows(`select auto, derivation, held, scans_unreadable from rescore_runs where id = '${id}';`)[0]).toEqual([
      "t",
      "f026342a5919",
      "gusto.com loses its score (0 → none)",
      "0",
    ]);
    expect(value(`select '${scanId}'::uuid = any(stale_scans) from rescore_runs where id = '${id}';`)).toBe("t");
  });
});

describe("fetch_facts — the re-score's facts of each stored read", () => {
  it("adds no column to fetches and changes none", () => expect([fetchesBefore.length > 0, fetchesColumns()]).toEqual([true, fetchesBefore]));

  it("keeps one row per read, overwritten at a new version, deleted by its scan before its read, and reached by the service role alone", () => {
    const scanId = scan();
    const id = value(`insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload) values ('${scanId}', 'egress.safeFetch', 'https://gusto.com/', 1, 0, 0, '{}'::jsonb) returning id;`)!;
    const put = (version: string) => run(`insert into fetch_facts (fetch_id, scan_id, facts_version, facts) values ('${id}', '${scanId}', '${version}', '{"v":"${version}"}'::jsonb) on conflict (fetch_id) do update set facts_version = excluded.facts_version, facts = excluded.facts;`);
    ["v1", "v2"].forEach(put);
    expect(psqlRows(`select facts_version, facts->>'v' from fetch_facts where fetch_id = '${id}';`)).toEqual([["v2", "v2"]]);
    expect(raises(`insert into fetch_facts (fetch_id, scan_id, facts_version, facts) values (gen_random_uuid(), '${scanId}', 'v1', '{}'::jsonb);`)).toBe(true);
    expect(raises(`delete from fetches where id = '${id}';`)).toBe(true);
    run(`delete from fetch_facts where scan_id = '${scanId}'; delete from fetches where scan_id = '${scanId}';`);
    expect(psqlRows("select relrowsecurity, (select count(*) from pg_policies where tablename = 'fetch_facts') from pg_class where relname = 'fetch_facts';")).toEqual([["t", "0"]]);
    for (const [role, can] of [["anon", "f"], ["authenticated", "f"], ["service_role", "t"]]) {
      for (const privilege of ["select", "insert", "update", "delete"]) expect(value(`select has_table_privilege('${role}', 'fetch_facts', '${privilege}');`)).toBe(can);
    }
  });
});

describe("fetch_text — the grounding's text of each stored read", () => {
  it("adds no column to fetches and changes none", () => expect(fetchesColumns()).toEqual(fetchesBefore));

  it("keeps one row per read with its timestamp as written, deleted by its scan before its read, and reached by the service role alone", () => {
    const scanId = scan();
    const id = value(`insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload) values ('${scanId}', 'egress.safeFetch', 'https://gusto.com/', 1, 0, 0, '{}'::jsonb) returning id;`)!;
    const put = (version: string) => run(`insert into fetch_text (fetch_id, scan_id, text_version, url, read_at, rendered, document, text, examples, questions) values ('${id}', '${scanId}', '${version}', 'https://gusto.com/', '2026-11-02T09:00:00.123Z', false, true, 'Payroll ${version}', '[]'::jsonb, '[]'::jsonb) on conflict (fetch_id) do update set text_version = excluded.text_version, text = excluded.text;`);
    ["t1", "t2"].forEach(put);
    expect(psqlRows(`select text_version, text, read_at from fetch_text where fetch_id = '${id}';`)).toEqual([["t2", "Payroll t2", "2026-11-02T09:00:00.123Z"]]);
    expect(raises(`insert into fetch_text (fetch_id, scan_id, text_version, url, read_at, rendered, document, text, examples, questions) values (gen_random_uuid(), '${scanId}', 't1', 'u', 'r', false, false, '', '[]'::jsonb, '[]'::jsonb);`)).toBe(true);
    expect(raises(`delete from fetches where id = '${id}';`)).toBe(true);
    run(`delete from fetch_text where scan_id = '${scanId}'; delete from fetches where scan_id = '${scanId}';`);
    expect(value(`select count(*) from fetches where scan_id = '${scanId}';`)).toBe("0");
    expect(value("select count(*) from pg_indexes where tablename = 'fetch_text' and indexdef like '%(scan_id)%';")).toBe("1");
    expect(psqlRows("select relrowsecurity, (select count(*) from pg_policies where tablename = 'fetch_text') from pg_class where relname = 'fetch_text';")).toEqual([["t", "0"]]);
    for (const [role, can] of [["anon", "f"], ["authenticated", "f"], ["service_role", "t"]]) {
      for (const privilege of ["select", "insert", "update", "delete"]) expect(value(`select has_table_privilege('${role}', 'fetch_text', '${privilege}');`)).toBe(can);
    }
  });
});
