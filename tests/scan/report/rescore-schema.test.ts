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
];

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
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
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
