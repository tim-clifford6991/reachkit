import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/app/plan/generate — surfaces already-computed synthesis recommendations
// (contentPlan + distributionPlan) as persisted `pending` actions. Pure unit
// test: every collaborator is mocked (DB, auth, entitlements, synthesis,
// action board) so it runs with no live/local Supabase, same pattern as
// app/api/scan/route.tier.test.ts.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

const FIXTURE_SYNTH = {
  domain: "example.com",
  category: "SaaS",
  summary: "",
  contentPlan: [
    {
      topic: "Content A (high)",
      targetKeywords: ["a"],
      estMonthlyVolume: 100,
      intent: "informational",
      format: "guide",
      depthTarget: "",
      buyerAngle: "buyer angle A",
      competitorExemplars: [],
      brief: "",
      agentPrompt: "",
      priority: "high" as const,
      evidence: "evidence A",
    },
    {
      topic: "Content B (medium)",
      targetKeywords: ["b"],
      estMonthlyVolume: 50,
      intent: "informational",
      format: "guide",
      depthTarget: "",
      buyerAngle: "buyer angle B",
      competitorExemplars: [],
      brief: "",
      agentPrompt: "",
      priority: "medium" as const,
      evidence: "evidence B",
    },
  ],
  distributionPlan: [
    {
      channel: "directory",
      action: "Submit to Directory X (high)",
      target: "Directory X",
      targetUrl: "",
      why: "why X",
      effort: "low" as const,
      priority: "high" as const,
      evidence: "evidence X",
      ease: 0.8,
      impact: 0.85,
    },
    {
      channel: "community",
      action: "Post in r/SaaS (low)",
      target: "r/SaaS",
      targetUrl: "",
      why: "why Y",
      effort: "medium" as const,
      priority: "low" as const,
      evidence: "evidence Y",
      ease: 0.5,
      impact: 0.3,
    },
  ],
};

const EMPTY_BOARD = { open: [], verifying: [], done: [], retry: [] };

function makeDbMock(insertedRows: Record<string, unknown>[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === "apps") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { store_url: "example.com" }, error: null }),
            }),
          }),
        };
      }
      if (table === "actions") {
        return {
          insert: (rows: Record<string, unknown>[]) => {
            insertedRows.push(...rows);
            return {
              select: async () => ({
                data: rows.map((r, i) => ({
                  id: `new-${insertedRows.length - rows.length + i}`,
                  title: r.title,
                  category: r.category,
                })),
                error: null,
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table "${table}"`);
    }),
  };
}

function mockCommonCollaborators(insertedRows: Record<string, unknown>[]) {
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(insertedRows) }));
  vi.doMock("@/lib/app/active-app", () => ({ activeAppId: vi.fn(async () => "app-1") }));
  vi.doMock("@/lib/app/latest-scan", () => ({
    // Run the callback directly — no cost-context needed for this unit test;
    // the wrapper itself is pinned by app/api/costed-routes.test.ts.
    costedIntelStep: vi.fn(async (_appId: string, _source: string, fn: () => unknown) => fn()),
    latestScanIdForApp: vi.fn(async () => null), // no persisted scan_signals → honest delta:0
  }));
  vi.doMock("@/lib/scan/competitor-selection", () => ({
    getSelectedCompetitors: vi.fn(async () => ["rival.com"]),
    MAX_SELECTED: 5,
  }));
  vi.doMock("@/lib/scan/synthesis/synthesize", () => ({
    gatherSynthesis: vi.fn(async () => FIXTURE_SYNTH),
  }));
}

function postGenerate(body: Record<string, unknown> = {}) {
  return import("@/app/api/app/plan/generate/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/app/plan/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as never,
    ),
  );
}

test("POST /api/app/plan/generate: unpaid viewer gets 402, no gather/insert happens", async () => {
  const insertedRows: Record<string, unknown>[] = [];
  mockCommonCollaborators(insertedRows);
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-1", user: { id: "user-free-1", app_ids: ["app-1"] } })),
  }));
  const { EntitlementError } = await vi.importActual<typeof import("@/lib/billing/entitlements")>(
    "@/lib/billing/entitlements",
  );
  vi.doMock("@/lib/billing/entitlements", async () => {
    const actual = await vi.importActual<typeof import("@/lib/billing/entitlements")>("@/lib/billing/entitlements");
    return { ...actual, assertPaid: vi.fn(async () => { throw new EntitlementError(); }) };
  });

  const res = await postGenerate();

  expect(res.status).toBe(402);
  expect(insertedRows).toHaveLength(0);
});

test("POST /api/app/plan/generate: paid viewer with un-actioned recommendations gets non-empty `added` and inserts pending rows", async () => {
  const insertedRows: Record<string, unknown>[] = [];
  mockCommonCollaborators(insertedRows);
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-1", user: { id: "user-paid-1", app_ids: ["app-1"] } })),
  }));
  vi.doMock("@/lib/billing/entitlements", async () => {
    const actual = await vi.importActual<typeof import("@/lib/billing/entitlements")>("@/lib/billing/entitlements");
    return { ...actual, assertPaid: vi.fn(async () => {}) };
  });
  vi.doMock("@/lib/scan/action-board", () => ({ actionBoard: vi.fn(async () => EMPTY_BOARD) }));

  const res = await postGenerate({ today: "2026-07-14" });
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.added.length).toBeGreaterThan(0);
  expect(json.added.length).toBeLessThanOrEqual(5);
  // Every added item carries the {id,title,category} contract.
  for (const a of json.added) {
    expect(a).toHaveProperty("id");
    expect(a).toHaveProperty("title");
    expect(a).toHaveProperty("category");
  }
  // All 4 fixture recommendations are un-actioned → all 4 persisted as pending rows.
  expect(insertedRows).toHaveLength(4);
  expect(insertedRows.every((r) => r.status === "pending")).toBe(true);
  expect(insertedRows.every((r) => r.draft === null && r.draft_requires_edit === true)).toBe(true);
  // Pinned to the founder's today so "generate more" lands on today's list.
  expect(insertedRows.every((r) => r.scheduled_for === "2026-07-14")).toBe(true);
  // Impact honesty: no scan_signals row exists (latestScanIdForApp → null) →
  // every card's delta degrades to 0, never a fabricated LLM number.
  expect(insertedRows.every((r) => (r.expected_outcome as { delta: number }).delta === 0)).toBe(true);
});

test("POST /api/app/plan/generate: higherImpactOnly keeps only priority='high' recommendations", async () => {
  const insertedRows: Record<string, unknown>[] = [];
  mockCommonCollaborators(insertedRows);
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-1", user: { id: "user-paid-1", app_ids: ["app-1"] } })),
  }));
  vi.doMock("@/lib/billing/entitlements", async () => {
    const actual = await vi.importActual<typeof import("@/lib/billing/entitlements")>("@/lib/billing/entitlements");
    return { ...actual, assertPaid: vi.fn(async () => {}) };
  });
  vi.doMock("@/lib/scan/action-board", () => ({ actionBoard: vi.fn(async () => EMPTY_BOARD) }));

  const res = await postGenerate({ higherImpactOnly: true });
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.added).toHaveLength(2);
  const titles = json.added.map((a: { title: string }) => a.title).sort();
  expect(titles).toEqual(["Content A (high)", "Submit to Directory X (high)"].sort());
  expect(insertedRows).toHaveLength(2);
});

test("POST /api/app/plan/generate: all recommendations already tracked → added: []", async () => {
  const insertedRows: Record<string, unknown>[] = [];
  mockCommonCollaborators(insertedRows);
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-1", user: { id: "user-paid-1", app_ids: ["app-1"] } })),
  }));
  vi.doMock("@/lib/billing/entitlements", async () => {
    const actual = await vi.importActual<typeof import("@/lib/billing/entitlements")>("@/lib/billing/entitlements");
    return { ...actual, assertPaid: vi.fn(async () => {}) };
  });
  // Every fixture recommendation's title already exists as an open action.
  vi.doMock("@/lib/scan/action-board", () => ({
    actionBoard: vi.fn(async () => ({
      open: [
        { id: "a1", title: "Content A (high)", category: "content" },
        { id: "a2", title: "Content B (medium)", category: "content" },
        { id: "a3", title: "Submit to Directory X (high)", category: "outreach" },
        { id: "a4", title: "Post in r/SaaS (low)", category: "outreach" },
      ],
      verifying: [],
      done: [],
      retry: [],
    })),
  }));

  const res = await postGenerate();
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.added).toEqual([]);
  expect(insertedRows).toHaveLength(0);
});
