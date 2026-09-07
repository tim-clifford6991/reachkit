// tests/db/domainblocks.test.ts
//
// BUILD §4.1 · REQ-002 · BP-002 decision 1 — `domain_blocks`, the table
// with no writer anywhere in the product. Carries WO-012's test plan.
//
// **Promoted to a live-schema suite (issue #78, via #6).** This file used
// to assert the migration's *text*, because `vitest.config.ts`'s
// `LIVE_SCHEMA_TESTS` — both the `db` project's `include` and the `node`
// project's `exclude` — is an owner file a feature PR could not add a row
// to. Issue #6 owns that file and adds the row, so the schema half now
// applies the baseline plus `*_domainblocks*.sql` to the scratch database
// and queries `information_schema`, `pg_policies` and `role_table_grants`
// the way `tests/db/baseline.test.ts` does. What a person verified by hand
// during #28 is what CI now verifies every run.
//
// The source-level half stays exactly as it was: "no writer anywhere in
// the product" (REQ-002 c4) is a property of every file under `src/`, not
// a schema fact, and only a repository-wide source assertion can discharge
// it. So is the topic-token check and the sweep proving no migration
// resurrects the rejected `scans.removed_at`.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../src/lib/db/topics";
import {
  psql,
  psqlRows,
} from "./substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATION_NAME = "20260905120000_domainblocks.sql";
const BASELINE_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql");
const DOMAINBLOCKS_MIGRATION = path.join(REPO_ROOT, "supabase/migrations", MIGRATION_NAME);
const BASELINE = readFileSync(BASELINE_MIGRATION, "utf8");

/** One tuple-only row per line, `|`-separated columns — easy to split. */
/** Runs `sql` and returns whether it raised (never throws itself). */
function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
}

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

beforeAll(() => {
  resetSchema();
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", DOMAINBLOCKS_MIGRATION]);
});

afterAll(() => {
  resetSchema();
});

/** Text with every `--` comment line stripped, so an assertion about what
 *  the schema *does* is never satisfied — or failed — by prose describing
 *  it. This file's own migration explains the rejected `scans.removed_at`
 *  alternative in a comment, which the sweep below would otherwise read as
 *  the column itself. */
function statementsOf(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
    }
  })(path.join(REPO_ROOT, "src"));
  return out;
}

const SOURCES = sourceFiles().map((file) => ({
  file,
  text: readFileSync(path.join(REPO_ROOT, file), "utf8"),
}));

describe('BP-002 data-model delta — "REQ-002 criterion 3 removes a report for a **domain**, permanently and across every future scan; a scan-scoped column cannot bind a scan that does not exist yet."', () => {
  it("`domain_blocks` exists, keyed by domain and by nothing else — no `scan_id`, no `site_id`", () => {
    const columns = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'domain_blocks' order by column_name;`
    ).map(([name]) => name);
    expect(columns).toEqual(["blocked_at", "domain", "id", "note"]);
  });

  it("carries the four columns WO-012 names, with the types and nullability it names", () => {
    const rows = psqlRows(
      `select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'domain_blocks' order by column_name;`
    );
    expect(rows).toEqual([
      ["blocked_at", "timestamp with time zone", "NO"],
      ["domain", "text", "NO"],
      ["id", "uuid", "NO"],
      ["note", "text", "NO"],
    ]);
  });

  it("the domain is unique — one domain is blocked once", () => {
    expect(raises(`insert into domain_blocks (domain, note) values ('dup.example.com', 'request A');`)).toBe(false);
    expect(raises(`insert into domain_blocks (domain, note) values ('dup.example.com', 'request B');`)).toBe(true);
  });

  it("the domain is lowercased, so a mixed-case row cannot block nothing silently (ADR-020)", () => {
    expect(raises(`insert into domain_blocks (domain, note) values ('Mixed.Example.com', 'request C');`)).toBe(true);
    expect(raises(`insert into domain_blocks (domain, note) values ('mixed.example.com', 'request C');`)).toBe(false);
  });

  it("records the written request the block was granted against — a row with no note is refused (REQ-002 c4)", () => {
    expect(raises(`insert into domain_blocks (domain) values ('no-note.example.com');`)).toBe(true);
  });
});

describe('BP-002 decision 1 — the rejected alternative: "a `removed_at` column on `scans` — rejected, REQ-002 criterion 3 must refuse a scan for a domain that has no scan row"', () => {
  it("`scans` carries no `removed_at` column in the applied schema", () => {
    const rows = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'removed_at';`
    );
    expect(rows).toEqual([]);
  });

  it("`scans` carries no `removed_at` in the baseline text either, and no migration in the repository adds one", () => {
    expect(statementsOf(BASELINE)).not.toMatch(/removed_at/);
    const dir = path.join(REPO_ROOT, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      expect(statementsOf(readFileSync(path.join(dir, file), "utf8"))).not.toMatch(/removed_at/);
    }
  });
});

describe('BP-002 error behaviour — "RLS is default-deny"', () => {
  it("row level security is enabled on the table", () => {
    const rows = psqlRows(
      `select relrowsecurity from pg_class where oid = 'public.domain_blocks'::regclass;`
    );
    expect(rows).toEqual([["t"]]);
  });

  it("the table carries no policy at all — unreadable by anyone holding an anon or authenticated key", () => {
    const rows = psqlRows(
      `select policyname from pg_policies where schemaname = 'public' and tablename = 'domain_blocks';`
    );
    expect(rows).toEqual([]);
  });

  it("`anon` reads zero rows even when rows exist — RLS, not an empty table", () => {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into domain_blocks (domain, note) values ('rls-visible.example.com', 'written request on file');`,
    ]);
    expect(psqlRows(`select count(*) from domain_blocks where domain = 'rls-visible.example.com';`)).toEqual([["1"]]);
    expect(psqlRows(`set role anon; select count(*) from domain_blocks;`)).toEqual([["0"]]);
  });
});

describe('`structure.md` rule 3 — "`*_domainblocks*.sql` (REQ-002\'s table has no writer anywhere in the product, so no feature node can own it)"', () => {
  it("the migration carries exactly one topic token, and it is `domainblocks`", () => {
    expect(topicOf(MIGRATION_NAME)).toEqual({ token: "domainblocks", owner: "BP-002" });
  });

  it("grants `anon` and `authenticated` select only — the absence of a writer holds one layer below the policies", () => {
    const rows = psqlRows(
      `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'domain_blocks' and grantee in ('anon', 'authenticated') order by grantee, privilege_type;`
    );
    expect(rows).toEqual([
      ["anon", "SELECT"],
      ["authenticated", "SELECT"],
    ]);
  });

  it("an `anon` insert is refused by the grants, one layer below the policies", () => {
    expect(
      raises(`set role anon; insert into domain_blocks (domain, note) values ('anon-write.example.com', 'nope');`)
    ).toBe(true);
  });

  it("grants the write verbs to `service_role` alone — the manual operator path, and no other", () => {
    const rows = psqlRows(
      `select privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'domain_blocks' and grantee = 'service_role' order by privilege_type;`
    );
    expect(rows).toEqual([["DELETE"], ["INSERT"], ["SELECT"], ["UPDATE"]]);
  });
});

describe('REQ-002 c4 — "a report is taken down only by a removal request received at the address criterion 1 names, never at ReachKit\'s own initiative"', () => {
  const mentioning = SOURCES.filter((s) => s.text.includes("domain_blocks"));

  it("exactly one file under `src/` names the table at all — the one reader of it", () => {
    // #104 moved that reader out of `admission.ts` into its own module, so
    // the report address's removal check can reach it from the Edge
    // runtime without dragging `node:crypto` (admission's network-key
    // HMAC) along. Still one file, and still only a read: admission, the
    // correction offer and the 410 all resolve the same fact here.
    expect(mentioning.map((s) => s.file)).toEqual(["src/lib/scan/removal.ts"]);
  });

  it("no file under `src/` writes to it — no insert, update, upsert or delete", () => {
    for (const source of mentioning) {
      const [, ...afterTable] = source.text.split('"domain_blocks"');
      for (const chunk of afterTable) {
        const statement = chunk.slice(0, 400);
        for (const verb of [".insert(", ".update(", ".upsert(", ".delete("]) {
          expect(statement).not.toContain(verb);
        }
      }
    }
  });

  it("the reader selects and nothing else", () => {
    const reader = SOURCES.find((s) => s.file === "src/lib/scan/removal.ts");
    expect(reader).toBeDefined();
    const [, after = ""] = (reader?.text ?? "").split('from<DomainBlockRow>("domain_blocks")');
    expect(after.slice(0, 200)).toContain('.select("domain")');
  });
});
