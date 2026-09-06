// tests/scan/run/harness.ts — the doubles the pipeline suites share
// (issue #25). Not a suite of its own: vitest collects `*.test.ts`.
import { vi } from "vitest";

/** A complete, validly-shaped set of the bindings `env.ts` requires. */
export const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: "postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch",
  SUPABASE_URL: "http://127.0.0.1:3001",
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  DATAFORSEO_LOGIN: "dfs-login-fixture-do-not-leak",
  DATAFORSEO_PASSWORD: "dfs-password-fixture-do-not-leak",
  ANTHROPIC_API_KEY: "sk-ant-fixture",
  NANO_API_KEY: "nano-fixture",
  IP_HASH_SALT: "salt-fixture",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
};

export function setEnvFixture(): void {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
}

// Applied at module load, not only when a suite calls it: `env.ts` is read
// the moment `@/lib/db` is first imported, which is before any suite body
// runs. A file that imports this harness above its `src/` imports has the
// bindings in place by the time they are read.
setEnvFixture();

export interface DbQuery {
  table: string;
  verb: "select" | "update" | "insert";
  values?: Record<string, unknown>;
  filters: [string, unknown][];
}

export interface FakeDb {
  queries: DbQuery[];
  /** Rows the next `select` on this table answers with, by table name. */
  rows: Map<string, unknown[]>;
  /** Answers a `select` from the whole query — table and filters — where
   *  one table serves several different reads. `null` falls through to
   *  `rows`. */
  answer: ((query: DbQuery) => unknown[] | null) | null;
  /** What `.single()` resolves to, by table name. */
  singles: Map<string, unknown>;
  client: { from: (table: string) => unknown; rpc: (fn: string, args: unknown) => unknown };
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  reset(): void;
}

/** A PostgREST-shaped double: every builder member the engine calls,
 *  thenable, recording what was asked for. It answers `select` from
 *  `rows`, accepts every write, and never reaches a network. */
export function fakeDb(): FakeDb {
  const db: FakeDb = {
    queries: [],
    rows: new Map(),
    answer: null,
    singles: new Map(),
    rpcCalls: [],
    client: {
      from: (table: string) => builder(table),
      rpc: (fn: string, args: unknown) => {
        db.rpcCalls.push({ fn, args: args as Record<string, unknown> });
        return Promise.resolve({ data: null, error: null });
      },
    },
    reset() {
      db.queries.length = 0;
      db.rpcCalls.length = 0;
      db.rows.clear();
      db.singles.clear();
      db.answer = null;
    },
  };

  function builder(table: string) {
    const query: DbQuery = { table, verb: "select", filters: [] };
    db.queries.push(query);
    const self = {
      select() {
        return self;
      },
      update(values: Record<string, unknown>) {
        query.verb = "update";
        query.values = values;
        return self;
      },
      insert(values: Record<string, unknown>) {
        query.verb = "insert";
        query.values = values;
        return self;
      },
      eq(column: string, value: unknown) {
        query.filters.push([column, value]);
        return self;
      },
      is(column: string, value: unknown) {
        query.filters.push([column, value]);
        return self;
      },
      gte(column: string, value: unknown) {
        query.filters.push([column, value]);
        return self;
      },
      gt(column: string, value: unknown) {
        query.filters.push([column, value]);
        return self;
      },
      order() {
        return self;
      },
      limit() {
        return self;
      },
      in() {
        return self;
      },
      single() {
        const single = db.singles.get(table) ?? (db.rows.get(table) ?? [])[0] ?? null;
        return Promise.resolve({ data: single, error: null });
      },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        const answered = db.answer === null ? null : db.answer(query);
        const data = answered ?? (query.verb === "select" ? (db.rows.get(table) ?? []) : []);
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return self;
  }

  return db;
}

/** Every `stage_transition` line the run wrote, in order, as
 *  `"<stage>:<enter|done>"`. `stages.ts` is the only writer of that event. */
export function captureStages(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (typeof first !== "string") return;
    try {
      const record = JSON.parse(first) as { event?: string; stage?: string; done?: boolean };
      if (record.event === "stage_transition" && typeof record.stage === "string") {
        lines.push(`${record.stage}:${record.done === true ? "done" : "enter"}`);
      }
    } catch {
      // Not a JSON log line — nothing this capture reads.
    }
  });
  return { lines, restore: () => spy.mockRestore() };
}
