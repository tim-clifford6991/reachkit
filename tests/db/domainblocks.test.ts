// tests/db/domainblocks.test.ts
//
// BUILD §4.1 · REQ-002 · BP-002 decision 1 — `domain_blocks`, the table
// with no writer anywhere in the product. Carries WO-012's test plan.
//
// **Why this file asserts source and not a live schema, flagged once.**
// Every other suite under `tests/db/` applies its migration to the native
// PostgreSQL scratch database and queries `information_schema`. Those
// files are named one by one in `vitest.config.ts`'s `LIVE_SCHEMA_TESTS`,
// which is both the `db` project's `include` and the `node` project's
// `exclude` (WO-283) — a live-schema file absent from that list runs under
// `node`, where there is no database, and fails. `vitest.config.ts` is an
// owner file (`CODEOWNERS`) and is not editable from a feature PR, so this
// suite asserts the migration's own text and the repository's own sources
// instead, and the PR that adds it names the one-line owner change that
// would promote it. The migration itself was applied to the scratch
// database by hand and verified there; see the PR body.
//
// The strongest of the four criteria below is not a schema fact in any
// case: "no writer anywhere in the product" (REQ-002 c4) is a property of
// every file under `src/`, and only a repository-wide source assertion can
// discharge it. That one would be written exactly like this even with a
// live database to hand.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "../../src/lib/db/topics";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATION_NAME = "20260905120000_domainblocks.sql";
const MIGRATION = readFileSync(
  path.join(REPO_ROOT, "supabase/migrations", MIGRATION_NAME),
  "utf8"
);
const BASELINE = readFileSync(
  path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql"),
  "utf8"
);

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

const SQL = statementsOf(MIGRATION);

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
  it("creates `domain_blocks`, keyed by domain and by nothing else — no `scan_id`, no `site_id`", () => {
    expect(SQL).toMatch(/create table domain_blocks/);
    expect(SQL).not.toMatch(/scan_id/);
    expect(SQL).not.toMatch(/site_id/);
  });

  it("carries the four columns WO-012 names — id, domain, blocked_at, note", () => {
    for (const column of ["id", "domain", "blocked_at", "note"]) {
      expect(SQL).toMatch(new RegExp(`^\\s*${column}\\s`, "m"));
    }
  });

  it("the domain is unique and lowercased, so one domain is blocked once and a mixed-case row blocks nothing silently (ADR-020)", () => {
    expect(SQL).toMatch(/domain text not null unique check \(domain = lower\(domain\)\)/);
  });

  it("records the written request the block was granted against — `note` is not null (REQ-002 c4)", () => {
    expect(SQL).toMatch(/note text not null/);
  });
});

describe('BP-002 decision 1 — the rejected alternative: "a `removed_at` column on `scans` — rejected, REQ-002 criterion 3 must refuse a scan for a domain that has no scan row"', () => {
  it("`scans` carries no `removed_at` in the baseline", () => {
    expect(statementsOf(BASELINE)).not.toMatch(/removed_at/);
  });

  it("no migration in the repository adds one", () => {
    const dir = path.join(REPO_ROOT, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      expect(statementsOf(readFileSync(path.join(dir, file), "utf8"))).not.toMatch(/removed_at/);
    }
  });
});

describe('BP-002 error behaviour — "RLS is default-deny"', () => {
  it("enables row level security on the table", () => {
    expect(SQL).toMatch(/alter table domain_blocks enable row level security/);
  });

  it("adds no policy at all — a table with no policy is unreadable by anyone holding an anon or authenticated key", () => {
    expect(SQL).not.toMatch(/create policy/i);
  });

  it("no other migration adds a policy on `domain_blocks` either", () => {
    const dir = path.join(REPO_ROOT, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const text = readFileSync(path.join(dir, file), "utf8");
      for (const statement of text.split(";")) {
        if (/create policy/i.test(statement)) expect(statement).not.toMatch(/on domain_blocks\b/);
      }
    }
  });
});

describe('`structure.md` rule 3 — "`*_domainblocks*.sql` (REQ-002\'s table has no writer anywhere in the product, so no feature node can own it)"', () => {
  it("the migration carries exactly one topic token, and it is `domainblocks`", () => {
    expect(topicOf(MIGRATION_NAME)).toEqual({ token: "domainblocks", owner: "BP-002" });
  });

  it("grants `anon` and `authenticated` select only — the absence of a writer holds one layer below the policies", () => {
    expect(SQL).toMatch(/grant select on domain_blocks to anon, authenticated;/);
    expect(SQL).not.toMatch(/grant[^;]*insert[^;]*to[^;]*\banon\b/);
    expect(SQL).not.toMatch(/grant[^;]*insert[^;]*to[^;]*\bauthenticated\b/);
  });

  it("grants the write verbs to `service_role` alone — the manual operator path, and no other", () => {
    expect(SQL).toMatch(/grant select, insert, update, delete on domain_blocks to service_role;/);
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
