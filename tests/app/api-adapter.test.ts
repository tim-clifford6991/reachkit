// tests/app/api-adapter.test.ts — BUILD §11
//
// The `src/app/api/**` convention, and the jobs route written to it.
//
//   - one structured request log line per call: route id, status, duration
//     and, where one exists, scan id — never a payload, never a body,
//     never a header value;
//   - a thrown error never reaches the response body: no vendor payload,
//     no stack, no message;
//   - the jobs route is transport only — it mounts the registry and adds
//     no logic of its own.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adapter } from "@/app/api/_adapter";
import { lineFor, LINE_FIELDS, recordRequest } from "@/app/api/_log";

const ROOT = path.resolve(import.meta.dirname, "../..");
const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  vi.spyOn(console, "log").mockImplementation((line: string) => void logged.push(line));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("one request log line, four fields and nothing else", () => {
  it("carries exactly route id, status and duration when there is no scan", () => {
    expect(Object.keys(lineFor({ routeId: "/api/jobs", status: 200, durationMs: 4 }))).toEqual([
      "event",
      "routeId",
      "status",
      "durationMs",
    ]);
  });

  it("carries the scan id where the route has one", () => {
    const line = lineFor({ routeId: "/api/scan", status: 200, durationMs: 4, scanId: "scan-1" });
    expect(line.scanId).toBe("scan-1");
    for (const key of Object.keys(line)) expect(LINE_FIELDS).toContain(key);
  });

  it("drops a field outside the allow-list — a body never reaches a line", () => {
    const line = lineFor({
      routeId: "/api/jobs",
      status: 200,
      durationMs: 4,
      // @ts-expect-error — the point of the test
      body: { secret: "customer data" },
    });
    expect(line).not.toHaveProperty("body");
    expect(JSON.stringify(line)).not.toContain("customer data");
  });

  it("emits one line per call", () => {
    recordRequest({ routeId: "/api/jobs", status: 204, durationMs: 1 });
    expect(logged).toHaveLength(1);
  });
});

describe("adapter() — the convention as code", () => {
  it("logs the handler's own status and passes its response through untouched", async () => {
    const wrapped = adapter("/api/thing", async () => Response.json({ ok: true }, { status: 201 }));
    const response = await wrapped(new Request("https://app.example.com/api/thing"), undefined);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(JSON.parse(logged[0] as string)).toMatchObject({
      event: "request",
      routeId: "/api/thing",
      status: 201,
    });
  });

  it("a thrown vendor payload never reaches the response body", async () => {
    const wrapped = adapter("/api/thing", async () => {
      const error = new Error("dataforseo said: {\"password\":\"hunter2\"}");
      throw error;
    });
    const response = await wrapped(new Request("https://app.example.com/api/thing"), undefined);
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("dataforseo");
    expect(JSON.parse(body)).toEqual({ error: "unavailable" });
  });

  it("logs the failure as one line, and that line carries no payload either", async () => {
    const wrapped = adapter("/api/thing", async () => {
      throw new Error("hunter2");
    });
    await wrapped(new Request("https://app.example.com/api/thing"), undefined);
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain("hunter2");
    expect(JSON.parse(logged[0] as string)).toMatchObject({ status: 500 });
  });

  it("the request's own URL is never logged — the route id is", async () => {
    const wrapped = adapter("/api/thing", async () => new Response(null, { status: 204 }));
    await wrapped(new Request("https://app.example.com/api/thing?value=customer-domain.com"), undefined);
    expect(logged[0]).not.toContain("customer-domain.com");
  });
});

describe("the jobs route is transport only", () => {
  const source = readFileSync(path.join(ROOT, "src/app/api/jobs/[[...slug]]/route.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("registers nothing itself — it mounts the registry", () => {
    expect(code).toMatch(/from\s+["']@\/jobs["']/);
    expect(code).not.toMatch(/createFunction|cron:|triggers:/);
  });

  it("exports exactly GET, POST and PUT, and the platform's ceiling on an invocation (issue 798)", () => {
    const exported = [...code.matchAll(/export const (\w+)/g)].map((m) => m[1]);
    expect(exported.sort()).toEqual(["GET", "POST", "PUT", "maxDuration"]);
    expect(code).toMatch(/^export const maxDuration = \d+;$/m);
  });

  it("imports no engine module", () => {
    expect(code).not.toMatch(/from\s+["']@\/lib\//);
  });

  it("holds no logic beyond the mount and the log wrapper", () => {
    expect(code).not.toMatch(/\bif\b|\bfor\b|\bwhile\b|\bswitch\b|function\b/);
  });
});

describe("_adapter.ts cannot become a place logic accumulates", () => {
  const source = readFileSync(path.join(ROOT, "src/app/api/_adapter.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("imports no engine module and no job", () => {
    expect(code).not.toMatch(/from\s+["']@\/(lib|jobs)\//);
    expect(code).not.toMatch(/from\s+["']@\/jobs["']/);
  });

  it("answers a failure with a machine handle, never a sentence", () => {
    // A handle is one lowercase token a caller branches on. Anything with a
    // space in it would be copy, and copy is the registry's.
    const handles = [...code.matchAll(/"([a-z-]+)" satisfies FailureHandle/g)].map((m) => m[1]);
    expect(handles).toEqual(["unavailable"]);
  });
});
