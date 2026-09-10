// tests/vendors/harness.ts — the fixtures `labs.test.ts` and `serp-ai.test.ts`
// share (issue #23). Not a suite of its own: vitest collects `*.test.ts`.
//
// Two doubles and nothing else:
//
//  - `stubVendorFetch()` replaces the global `fetch` `tests/setup.ts` refuses
//    with one that records every request and answers from a caller-supplied
//    handler. No test here reaches DataForSEO.
//  - `fakeCostContext()` is the `CostContext` shape `src/lib/costs/index.ts`
//    declares, reproduced rather than imported for the same reason
//    `tests/llm/seam.test.ts` reproduces it: these suites exercise the vendor
//    client against a seam they control; the real `withCostContext` has its
//    own DB-backed suite in `tests/costs/context.test.ts`.
import { vi } from "vitest";
import type { CapName, CostContext } from "../../src/lib/costs/index.ts";

/** A complete, validly-shaped set of the bindings `env.ts` requires — the
 *  same fixture shape `tests/vendors/never-list.test.ts` uses. */
export const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: "postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch",
  SUPABASE_URL: "http://127.0.0.1:3001",
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  MAIL_FROM: "hello@reachkit.example",
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

export interface SeenRequest {
  url: string;
  method: string;
  /** The one task object the transport sends, or `undefined` on a `GET`. */
  task: Record<string, unknown> | undefined;
}

export interface VendorFetchStub {
  requests: SeenRequest[];
  /** Every task body sent, in order — the shape the never-list assertions read. */
  tasks: Record<string, unknown>[];
}

/** Replaces `fetch` with one answering `handler(request, callIndex)`. A
 *  handler may return a vendor JSON body (answered `200`), or an explicit
 *  `{ status }` to exercise the non-2xx path, or throw to exercise a
 *  rejected `fetch`. */
export function stubVendorFetch(
  handler: (request: SeenRequest, index: number) => unknown
): VendorFetchStub {
  const stub: VendorFetchStub = { requests: [], tasks: [] };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : undefined;
      const task = Array.isArray(body) && typeof body[0] === "object" && body[0] !== null
        ? (body[0] as Record<string, unknown>)
        : undefined;
      const request: SeenRequest = { url, method: init?.method ?? "GET", task };
      stub.requests.push(request);
      if (task) stub.tasks.push(task);

      const answer = handler(request, stub.requests.length - 1);
      if (isStatus(answer)) {
        return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, statusText: answer.statusText ?? "", json: async () => ({}) };
      }
      return { ok: true, status: 200, statusText: "OK", json: async () => answer };
    })
  );

  return stub;
}

function isStatus(value: unknown): value is { status: number; statusText?: string } {
  return typeof value === "object" && value !== null && "status" in value && typeof (value as { status: unknown }).status === "number";
}

/** The vendor envelope every DataForSEO response carries. */
export function envelope(result: unknown, statusCode = 20000): unknown {
  return { tasks: [{ id: "task-id-fixture", status_code: statusCode, status_message: "Ok.", result: result === undefined ? null : [result] }] };
}

/** A `task_post` acknowledgement (status 20100, "Task Created"). */
export function taskCreated(id = "task-id-fixture"): unknown {
  return { tasks: [{ id, status_code: 20100, status_message: "Task Created.", result: null }] };
}

/** A `task_get` on a task the queue has not finished (40602, "Task In Queue"). */
export function taskInQueue(id = "task-id-fixture"): unknown {
  return { tasks: [{ id, status_code: 40602, status_message: "Task In Queue.", result: null }] };
}

export interface RecordedCall {
  source: string;
  cacheKey: string;
  freshnessDays: number;
  costCents: number;
  settleCents?: (payload: unknown) => number;
  run: () => Promise<unknown>;
}

export interface FakeContext {
  ctx: CostContext;
  calls: RecordedCall[];
  /** What `recordFetch` returned as the ledgered figure, per call. */
  ledgered: number[];
}

/** `recordFetch` as `withCostContext` implements it, minus the database:
 *  always a cache miss, reserve then settle, `settled` clamped to
 *  `reserved` (BUILD §6.5). */
export function fakeCostContext(cap: CapName = "DEEP"): FakeContext {
  const calls: RecordedCall[] = [];
  const ledgered: number[] = [];
  const ctx: CostContext = {
    cap,
    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }) {
      calls.push(call as unknown as RecordedCall);
      const payload = await call.run();
      const proposed = call.settleCents ? call.settleCents(payload) : call.costCents;
      const costCents = proposed > call.costCents ? call.costCents : proposed;
      ledgered.push(costCents);
      return { payload, fresh: true, costCents };
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
  return { ctx, calls, ledgered };
}

/** A context whose cap is already spent: `recordFetch` never calls `run()`
 *  — exactly `withCostContext`'s own `{ skipped: "cap" }` path. */
export function cappedCostContext(cap: CapName = "DEEP"): FakeContext {
  const calls: RecordedCall[] = [];
  const ctx: CostContext = {
    cap,
    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }) {
      calls.push(call as unknown as RecordedCall);
      return { skipped: "cap" as const };
    },
    capHit: () => true,
    spentCents: () => 9999,
    degraded: () => true,
  };
  return { ctx, calls, ledgered: [] };
}
