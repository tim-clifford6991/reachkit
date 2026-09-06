// tests/scan/weekly/harness.ts — the doubles the weekly suites share
// (issue #41). Not a suite of its own: vitest collects `*.test.ts`.
//
// A PostgREST-shaped double, recording every statement the module sent, so
// a suite can assert both the answer and how many round trips produced it.
// It answers `select` from rows the suite installs, and lets a suite plant
// one error per table — which is how the unique violation on
// `(site_id, week_start)` is exercised without a database.
import { vi } from "vitest";
import { setEnvFixture } from "../run/harness";

setEnvFixture();

export interface Statement {
  table: string;
  verb: "select" | "insert" | "delete";
  values?: Record<string, unknown>;
  filters: [string, unknown][];
}

export interface FakeDb {
  statements: Statement[];
  /** Rows a `select` on this table answers with. */
  rows: Map<string, unknown[]>;
  /** Answers a select from the whole statement, where one table serves
   *  several reads. `null` falls through to `rows`. */
  answer: ((statement: Statement) => unknown[] | null) | null;
  /** The error the next statement against this table resolves with, once. */
  errors: Map<string, { message: string; code?: string }>;
  client: { from: (table: string) => unknown };
  reset(): void;
}

export function fakeDb(): FakeDb {
  const db: FakeDb = {
    statements: [],
    rows: new Map(),
    answer: null,
    errors: new Map(),
    client: { from: (table: string) => builder(table) },
    reset() {
      db.statements.length = 0;
      db.rows.clear();
      db.errors.clear();
      db.answer = null;
    },
  };

  function builder(table: string) {
    const statement: Statement = { table, verb: "select", filters: [] };
    db.statements.push(statement);
    const self = {
      select() {
        return self;
      },
      insert(values: Record<string, unknown>) {
        statement.verb = "insert";
        statement.values = values;
        return self;
      },
      delete() {
        statement.verb = "delete";
        return self;
      },
      eq(column: string, value: unknown) {
        statement.filters.push([column, value]);
        return self;
      },
      not(column: string, operator: string, value: unknown) {
        statement.filters.push([`not.${column}.${operator}`, value]);
        return self;
      },
      in(column: string, values: readonly unknown[]) {
        statement.filters.push([column, values]);
        return self;
      },
      limit() {
        return self;
      },
      then(resolve: (value: { data: unknown[] | null; error: unknown }) => unknown) {
        const planted = db.errors.get(table);
        if (planted !== undefined) {
          db.errors.delete(table);
          return Promise.resolve({ data: null, error: planted }).then(resolve);
        }
        const answered = db.answer === null ? null : db.answer(statement);
        const data = answered ?? (statement.verb === "select" ? (db.rows.get(table) ?? []) : []);
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return self;
  }

  return db;
}

export const DB = fakeDb();

vi.mock("@/lib/db", () => ({ dbAdmin: () => DB.client, db: () => DB.client }));

/** Keeps the log lines the modules write out of the suite's own output,
 *  and hands them back for the suites that assert one was written. */
export function captureLog(): { lines: Record<string, unknown>[]; restore: () => void } {
  const lines: Record<string, unknown>[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (typeof first !== "string") return;
    try {
      lines.push(JSON.parse(first) as Record<string, unknown>);
    } catch {
      // Not a JSON log line — nothing this capture reads.
    }
  });
  return { lines, restore: () => spy.mockRestore() };
}
