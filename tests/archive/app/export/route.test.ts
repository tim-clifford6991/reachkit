// tests/app/export/route.test.ts — REQ-078 c2, c5
//
// The transport adapter over `exportEverything`. Everything it delegates is
// mocked at its seam, so what is under test is exactly what the route
// decides on its own account — which is meant to be almost nothing.
//
// Criterion 2 is carried here by **two independent checks**, because "the
// ordinary customer is active" makes this the defect no fixture finds by
// accident: a source assertion that the gate is unreachable from this file,
// and a behavioural one that the route asks about no account state at all.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportFailure } from "@/lib/account/export";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/app/api/export/route.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
/** The route's code with its prose stripped: these assertions are about
 *  what the adapter calls, not about what its header explains it never
 *  calls. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

type Session = { userId: string; siteId: string | null } | null;
type Result =
  | { ok: true; archive: ReadableStream<Uint8Array>; filename: string; pages: number }
  | { ok: false; reason: ExportFailure; lineKey: "export.failed" };

let session: Session = { userId: "u-1", siteId: "site-1" };
let result: Result;
const exportEverything = vi.fn(async (siteId: string): Promise<Result> => {
  asked.push(siteId);
  return result;
});
const asked: string[] = [];

vi.mock("@/lib/account/identity", () => ({
  currentSession: async (): Promise<Session> => session,
}));

vi.mock("@/lib/account/export", () => ({
  exportEverything: (siteId: string) => exportEverything(siteId),
}));

const { GET } = await import("@/app/api/export/route");

function archiveOf(bytes: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}

beforeEach(() => {
  asked.length = 0;
  session = { userId: "u-1", siteId: "site-1" };
  result = {
    ok: true,
    archive: archiveOf([80, 75, 3, 4]),
    filename: "reachkit-export-2026-09-06.zip",
    pages: 2,
  };
});

function request(): Request {
  return new Request("https://app.example/api/export");
}

describe("REQ-078 c2 — the gate is unreachable from here", () => {
  it("route.ts resolves no import into src/lib/account/billing/**", () => {
    expect(CODE).not.toMatch(/from\s+["'][^"']*account\/billing/);
  });

  it("route.ts names neither hasActiveAccess nor paid_through nor plan_status", () => {
    for (const forbidden of ["hasActiveAccess", "paid_through", "plan_status"]) {
      expect(CODE, `route.ts names ${forbidden} — REQ-078 c2`).not.toContain(forbidden);
    }
  });

  it("watch it fail first: the same sweep flags a fixture that does import it", () => {
    expect('import { hasActiveAccess } from "@/lib/account/billing";').toMatch(
      /from\s+["'][^"']*account\/billing/
    );
  });

  it("it imports the export leaf and the session, and nothing else of the engine", () => {
    const specifiers = [...CODE.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers.sort()).toEqual([
      "../_adapter",
      "@/lib/account/export",
      "@/lib/account/identity",
    ]);
  });
});

describe("REQ-078 c2 — three subscription states, one behaviour", () => {
  it("the route passes the session's site and nothing else — there is no state to vary", async () => {
    const response = await GET(request(), undefined);
    expect(asked).toEqual(["site-1"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="reachkit-export-2026-09-06.zip"'
    );
  });

  it("the archive is streamed through unchanged", async () => {
    const response = await GET(request(), undefined);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([80, 75, 3, 4]);
  });

  it("a signed-out request says nothing about whether an account or a payment exists", async () => {
    session = null;
    const response = await GET(request(), undefined);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(asked).toEqual([]);
  });

  it("a session with no site yet is the same answer — and asks for no archive", async () => {
    session = { userId: "u-1", siteId: null };
    const response = await GET(request(), undefined);
    expect(response.status).toBe(401);
    expect(asked).toEqual([]);
  });
});

describe("REQ-078 c5 — a line, never a truncated zip", () => {
  const reasons: ExportFailure[] = ["asset_unreadable", "record_unreadable", "timeout", "internal"];

  it.each(reasons)("%s returns the line key, no attachment header and no zip bytes", async (reason) => {
    result = { ok: false, reason, lineKey: "export.failed" };
    const response = await GET(request(), undefined);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({ lineKey: "export.failed" });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("the body carries a key, never a sentence", async () => {
    result = { ok: false, reason: "timeout", lineKey: "export.failed" };
    const body = await (await GET(request(), undefined)).text();
    expect(body).not.toMatch(/[ ][a-z]+[ ]/);
  });
});
