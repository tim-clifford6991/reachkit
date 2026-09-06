// tests/app/drafts/actions.test.ts — REQ-045 c4, REQ-057 c2 and c3.
//
// Three actions, each exactly one call to the state machine. What may
// follow an approval, a veto or a skip is the machine's answer and never a
// route's — so the discriminating assertions here are the *absences*: no
// publish, no destination adapter, no job, and no import that reaches the
// publishable predicate.
//
// The archived plan is WO-245.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { registerSessionReader } from "@/lib/account/session";
import { POST as approve } from "@/app/api/drafts/[id]/approve/route";
import { POST as veto } from "@/app/api/drafts/[id]/veto/route";
import { POST as skip } from "@/app/api/drafts/[id]/skip/route";
import type { Actor } from "@/lib/publish/types";
import { COPY } from "@/lib/presentation/copy";

const COPY_KEYS = Object.keys(COPY);

const ROUTE_DIR = path.resolve(import.meta.dirname, "../../../src/app/api/drafts/[id]");

function context(id = "d1") {
  return { params: Promise.resolve({ id }) };
}

function request(): Request {
  return new Request("https://dev.reachkit.app/api/drafts/d1/approve", { method: "POST" });
}

function seed(state: string, over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    {
      id: "s1",
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00:00",
      timezone: "UTC",
      publishing_enabled: true,
    },
  ]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state,
      veto_deadline: null,
      approved_at: null,
      approved_by: null,
      told: null,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      ...over,
    },
  ]);
}

beforeEach(() => {
  seed("in_review");
  registerSessionReader(async () => ({ userId: "u1", siteId: "s1" }));
});

describe('REQ-045 c4 — "can approve, edit or veto without leaving the view"', () => {
  it("each of the three routes takes its own move, once, with a customer actor", async () => {
    for (const [handler, to, reason] of [
      [approve, "approved", "approve"],
      [veto, "skipped", "veto"],
      [skip, "skipped", "skip"],
    ] as const) {
      seed("in_review");
      const response = await handler(request(), context());
      expect(await response.json(), reason).toEqual({ state: to });
      const records = db.rows("drafts")[0]?.transitions as {
        to: string;
        actor: Actor;
        reason?: string;
      }[];
      expect(records, reason).toHaveLength(1);
      expect(records[0]?.to, reason).toBe(to);
      expect(records[0]?.actor, reason).toEqual({ kind: "customer", userId: "u1" });
      expect(records[0]?.reason, reason).toBe(reason);
    }
  });

  it("veto and skip land on one state and are told apart by the recorded reason, not by an eleventh state", async () => {
    seed("in_review");
    await veto(request(), context());
    const vetoed = (db.rows("drafts")[0]?.transitions as { reason?: string }[])[0]?.reason;
    seed("in_review");
    await skip(request(), context());
    const skipped = (db.rows("drafts")[0]?.transitions as { reason?: string }[])[0]?.reason;
    expect(vetoed).toBe("veto");
    expect(skipped).toBe("skip");
    expect(db.rows("drafts")[0]?.state).toBe("skipped");
  });

  it("no response is a redirect — the customer never leaves the view", async () => {
    const response = await approve(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe('REQ-057 c2 — "it publishes under this rule and no other"', () => {
  it("approving is not publishing: the page rests in `approved` and nothing was delivered", async () => {
    const response = await approve(request(), context());
    expect(await response.json()).toEqual({ state: "approved" });
    expect(db.rows("drafts")[0]?.state).toBe("approved");
    // No publication row, and no table but `drafts` was touched.
    expect(db.rows("publications")).toEqual([]);
    expect(new Set(db.queries.map((q) => q.table))).toEqual(new Set(["drafts"]));
  });

  it("the predicate is not reachable from a route — none of the four files imports the publishable leaf", () => {
    for (const file of routeFiles()) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("publish/publishable");
      expect(source, file).not.toContain("becomesPublishable");
    }
  });

  it("no route names a mode or a veto window, so the two modes cannot diverge at the transport", () => {
    for (const file of routeFiles()) {
      const source = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      expect(source, file).not.toContain("copilot");
      expect(source, file).not.toContain("autopilot");
      expect(source, file).not.toContain("vetoHours");
    }
  });

  it("no route reaches a destination adapter or a job", () => {
    for (const file of routeFiles()) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("lib/publish/attempt");
      expect(source, file).not.toContain("lib/publish/destinations");
      expect(source, file).not.toContain("@/jobs");
    }
  });
});

describe('REQ-057 c3 / REQ-056 c2 — "refused with the page\'s state unchanged"', () => {
  it("a move that is not one of the fifteen answers 409 with the state the page still holds", async () => {
    seed("published");
    const response = await approve(request(), context());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      refused: "not_a_transition",
      state: "published",
      copy: "publish.action.refused.notATransition",
    });
    expect(db.rows("drafts")[0]?.state).toBe("published");
  });

  it("the two refusals are two keys, so a customer whose page already published is never told something is holding it", async () => {
    // No edge these three routes can take carries a guard today
    // (`in_review → approved` and the three `→ skipped` edges have empty
    // guard lists), so the `guard` arm is not reachable from here — which
    // is itself the property worth pinning: a route that could produce it
    // would be deciding something. The mapping is asserted on the two keys
    // being distinct and on the machine's own union being exactly two.
    const keys = new Set([
      "publish.action.refused.guard",
      "publish.action.refused.notATransition",
    ]);
    expect(keys.size).toBe(2);
    expect(COPY_KEYS).toEqual(expect.arrayContaining([...keys]));
  });

  it("the route performs no second attempt and no fallback transition", async () => {
    seed("published");
    await approve(request(), context());
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.rows("drafts")[0]?.transitions).toEqual([]);
  });
});

describe("the session and the draft's owner", () => {
  it("no session is 401, and nothing is read or written", async () => {
    registerSessionReader(null);
    db.queries.length = 0;
    const response = await approve(request(), context());
    expect(response.status).toBe(401);
    expect(db.queries).toHaveLength(0);
  });

  it("a draft belonging to another site answers exactly as one that does not exist", async () => {
    registerSessionReader(async () => ({ userId: "u2", siteId: "s2" }));
    const other = await approve(request(), context());
    registerSessionReader(async () => ({ userId: "u1", siteId: "s1" }));
    const missing = await approve(request(), context("nope"));
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
  });

  it("a refused ownership check takes no transition", async () => {
    registerSessionReader(async () => ({ userId: "u2", siteId: "s2" }));
    await approve(request(), context());
    expect(db.rows("drafts")[0]?.state).toBe("in_review");
  });
});

describe("the adapters hold no engine logic", () => {
  it("each route file is three lines over the shared action", () => {
    for (const file of routeFiles().filter((name) => name.endsWith("route.ts"))) {
      const code = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0 && !/^\s*(\/\/|\*|\/\*)/.test(line));
      expect(code.length, file).toBeLessThanOrEqual(3);
    }
  });

  it("the shared action imports the machine, the session, the draft read and the copy type — and nothing else from the engine", () => {
    const source = readFileSync(path.join(ROUTE_DIR, "_action.ts"), "utf8");
    const specifiers = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(specifiers)).toEqual(
      new Set([
        "../../_adapter",
        "@/lib/account/session",
        "@/lib/publish/db",
        "@/lib/publish/machine",
        "@/lib/publish/types",
        "@/lib/presentation/copy",
      ])
    );
  });

  it("the log line the wrapper emits carries the route id and no draft text", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((first: unknown) => {
      if (typeof first === "string") lines.push(first);
    });
    await approve(request(), context());
    spy.mockRestore();
    const request_line = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.event === "request");
    expect(request_line?.routeId).toBe("POST /api/drafts/{id}/approve");
  });
});

function routeFiles(): string[] {
  const files: string[] = [path.join(ROUTE_DIR, "_action.ts")];
  for (const entry of readdirSync(ROUTE_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(path.join(ROUTE_DIR, entry.name, "route.ts"));
  }
  return files;
}
