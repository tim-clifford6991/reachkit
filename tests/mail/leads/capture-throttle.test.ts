// POST /api/lead under the shared limiter: past a limit it writes no lead and answers exactly as an accepted one.
// `take_rate_limits` is stood in for at the PostgREST boundary with its fixed-window count; its SQL is
// `tests/db/rate-limits.test.ts`'s.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";

applyEnvFixture();

const { POST } = await import("@/app/api/lead/route");
const { setLeadStore } = await import("@/lib/mail/leads/store");

const MINUTE = 60_000;
const START = Date.parse("2026-10-31T00:00:00Z");

type Rpc = { p_scopes: string[]; p_keys: string[]; p_window_s: number[]; p_max: number[] };
let hits = new Map<string, number>();
let limiter: "up" | "down" = "up";
let limiterCalls = 0;
let state: MemoryState;

function fakeTakeRateLimits(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!String(input).endsWith("/rest/v1/rpc/take_rate_limits")) throw new Error(`unexpected fetch ${String(input)}`);
  limiterCalls += 1;
  if (limiter === "down") return Promise.resolve(new Response("{}", { status: 503 }));
  const args = JSON.parse(String(init?.body)) as Rpc;
  const now = Date.now() / 1000;
  const allowed = args.p_scopes.every((scope, i) => {
    const windowS = args.p_window_s[i] ?? 1;
    const row = `${scope}|${args.p_keys[i]}|${Math.floor(now / windowS)}`;
    const count = (hits.get(row) ?? 0) + 1;
    hits.set(row, count);
    return count <= (args.p_max[i] ?? 0);
  });
  return Promise.resolve(new Response(JSON.stringify(allowed), { headers: { "content-type": "application/json" } }));
}

async function lead(scanId: string, email: string, ip = "203.0.113.7") {
  const response = await POST(
    new Request("https://reachkit.example/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ scanId, email }),
    })
  );
  vi.setSystemTime(Date.now() + MINUTE);
  return { status: response.status, headers: [...response.headers], body: await response.text() };
}

const rowsFor = (email: string) => state.leads.filter((row) => row.email === email).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: START });
  vi.stubGlobal("fetch", fakeTakeRateLimits);
  vi.spyOn(console, "log").mockImplementation(() => {});
  hits = new Map();
  limiter = "up";
  limiterCalls = 0;
  state = newMemoryState();
  for (let i = 0; i < 12; i++) state.scans.set(`scan-${i}`, `site${i}.example`);
  setLeadStore(memoryStore(state));
});

afterEach(() => {
  setLeadStore(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("lead capture is throttled per address, network and scan, silently", () => {
  it("over-limit is silent and uniform", async () => {
    const answers = [];
    for (let i = 0; i < 4; i++) answers.push(await lead(`scan-${i}`, "anna@example.com", `203.0.113.${i}`));
    expect(rowsFor("anna@example.com")).toBe(3);
    expect(answers[3]).toEqual(answers[0]);
    expect(answers[0]).toMatchObject({ status: 202, body: JSON.stringify({ ok: true, message: "lead.accepted" }) });

    vi.setSystemTime(START + 24 * 60 * MINUTE);
    await lead("scan-4", "Anna@Example.com", "203.0.113.9");
    expect(rowsFor("anna@example.com")).toBe(4);
  });

  it("per-network cap", async () => {
    const answers = [];
    for (let i = 0; i < 11; i++) answers.push(await lead(`scan-${i}`, `person${i}@example.com`));
    expect(state.leads.map((row) => row.email)).toEqual(Array.from({ length: 10 }, (_, i) => `person${i}@example.com`));
    expect(answers[10]).toEqual(answers[0]);

    await lead("scan-11", "person10@example.com", "198.51.100.4");
    expect(rowsFor("person10@example.com")).toBe(1);
  });

  it("per-scan cap", async () => {
    const answers = [];
    for (let i = 0; i < 6; i++) answers.push(await lead("scan-0", `person${i}@example.com`, `203.0.113.${i}`));
    expect(state.leads.map((row) => row.email)).toEqual(Array.from({ length: 5 }, (_, i) => `person${i}@example.com`));
    expect(answers[5]).toEqual(answers[0]);

    await lead("scan-1", "person5@example.com", "203.0.113.5");
    expect(rowsFor("person5@example.com")).toBe(1);
  });

  it("malformed is not counted", async () => {
    for (let i = 0; i < 12; i++) expect((await lead("scan-0", "not-an-address")).status).toBe(422);
    expect(limiterCalls).toBe(0);

    // Twelve uncounted refusals leave the network's ten and the scan's five intact.
    for (let i = 0; i < 5; i++) expect((await lead("scan-0", `person${i}@example.com`)).status).toBe(202);
    expect(state.leads).toHaveLength(5);
  });

  it("fails open", async () => {
    limiter = "down";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 4; i++) await lead("scan-0", "anna@example.com");
    expect(rowsFor("anna@example.com")).toBe(4);
  });

  it("limited is logged without the address", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 4; i++) await lead("scan-0", "anna@example.com");

    const lines = [...log.mock.calls, ...warn.mock.calls].map((call) => String(call[0]));
    expect(lines.filter((line) => line.includes("api_lead")).map((line) => JSON.parse(line).outcome)).toEqual([
      "accepted",
      "accepted",
      "accepted",
      "limited",
    ]);
    for (const line of lines) {
      expect(line).not.toContain("anna@example.com");
      expect(line).not.toContain("203.0.113.7");
    }
  });
});
