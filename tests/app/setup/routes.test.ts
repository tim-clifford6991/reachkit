// tests/app/setup/routes.test.ts — BUILD §4.3
//
// The three transport adapters `/setup` speaks through, and the boundary
// that guards them. Each is a thin adapter (`ARCHITECTURE.md` rule 1):
// these tests assert the mapping and the refusals, never engine behaviour,
// which `submit.test.ts` and `tests/market/setup/**` own.
//
// `env` is parsed at module load by `src/lib/config/env.ts`, and the
// provider these routes read imports it, so every route is imported
// dynamically after the fixture bindings are applied — the convention
// `tests/mail/**` established.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture.ts";
// #104: importing `@/middleware` loads the removal reader, and through it
// the database client and the environment binding.
import "../../scan/run/harness";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { passFactory, reportFactory, resetSetupSession, storeFactory } from "./session-door";

vi.mock("@/lib/egress", () => ({
  // The one network fact these routes need, stubbed at the seam:
  // `tests/setup.ts` refuses a real resolver to every test in this corpus.
  resolvesInDns: vi.fn(async (host: string) => host !== "unreachable-site.com"),
}));


// #169: the setup screens name their founder through `currentSession()`
// and read the address, the report and the pass live. The factories live in
// `session-door.ts`; the `vi.mock` lines stay here, because vitest hoists a
// `vi.mock` found in an imported module and would install it for every
// suite that imports it.
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/report", async (importOriginal) =>
  reportFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/deep/progress", () => passFactory());

// The doubles are module-level mutable state, so a test that changes one
// must not leave it changed for the next.
beforeEach(() => resetSetupSession());


/** #133: `POST /api/setup` resolves the founder through
 *  `currentSession()`, and `_setup/provider.ts` now hands out the **live**
 *  store. Both are mocked here, and that is what keeps this file what its
 *  header says it is — the adapters' mapping and refusals, never a
 *  database and never `completeSetup`'s own rules. `submit.test.ts` owns
 *  those, and `store.test.ts` owns the rows. */
let session: { userId: string; siteId: string | null } | null = { userId: "user-fixture", siteId: "site-fixture" };

import { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } from "../../account/identity/fake-auth";

vi.mock("@/lib/account/identity", () => ({
  currentSession: async () => session,
}));

vi.mock("@/app/(account)/setup/_setup/provider", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/app/(account)/setup/_setup/provider")>();
  const { fixtureSetupStore } = await import("@/app/(account)/setup/_setup/fixture");
  return { ...original, setupStore: () => fixtureSetupStore() };
});

beforeAll(() => {
  applyEnvFixture();
});

beforeEach(() => {
  session = { userId: "user-fixture", siteId: "site-fixture" };
});

function post(path: string, body: unknown): Request {
  return new Request(`https://reachkit.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SUBMISSION = {
  domain: "example.com",
  category: "agency CRM",
  competitors: ["asana.com"],
  mode: "autopilot" as const,
  destination: { kind: "hosted" as const },
};

describe("the boundary — every setup route is signed-in-only", () => {
  function requestTo(path: string, cookie?: string): NextRequest {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    return new NextRequest(new Request(`https://reachkit.example${path}`, { headers }));
  }

  it.each([
    "/setup",
    "/setup/waiting",
    "/api/setup",
    "/api/setup/domain",
    "/api/setup/questions",
    "/api/setup/progress",
  ])(
    "%s without a session is redirected to the sign-in prompt",
    async (path) => {
      // `middleware` became async with #104's removal rewrite; every other
      // path it decides is still settled from the allow-list, the cookie
      // and §4.3's setup gate, with no database read on the way.
      const res = await middleware(requestTo(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "", "https://reachkit.example").pathname).toBe(
        "/signin"
      );
    }
  );

  it.each([
    "/setup",
    "/setup/waiting",
    "/api/setup",
    "/api/setup/domain",
    "/api/setup/questions",
    "/api/setup/progress",
  ])(
    "%s with a session is served",
    async (path) => {
      // #468: a Supabase Auth session, verified by `getUser()` — here the
      // in-memory double of it, with one live session.
      const { setIdentityAuth } = await import("@/lib/account/identity/auth");
      const auth = newFakeAuth();
      addAuthUser(auth, { id: "user-fixture", email: "founder@example.com" });
      setIdentityAuth(fakeIdentityAuth(auth));
      try {
        expect((await middleware(requestTo(path, signedInCookie(auth, "user-fixture")))).status).toBe(200);
      } finally {
        setIdentityAuth(null);
      }
    }
  );
});

describe("POST /api/setup — the one write path", () => {
  it("a well-formed submission completes and answers 200 with the site the account resolved to", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const response = await POST(post("/api/setup", SUBMISSION), undefined);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, siteId: "site-fixture" });
  });

  it("a body that is not a submission is a 400 with no refusal handle — it is not a founder's answer", async () => {
    const { POST } = await import("@/app/api/setup/route");
    for (const body of [null, 42, {}, { ...SUBMISSION, mode: "autopilot-plus" }]) {
      const response = await POST(post("/api/setup", body), undefined);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "malformed_body" });
    }
  });

  it("unparseable JSON is a 400, not a crash", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const request = new Request("https://reachkit.example/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect((await POST(request, undefined)).status).toBe(400);
  });

  it("a member the shape does not admit is dropped, never forwarded", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const response = await POST(
      post("/api/setup", { ...SUBMISSION, siteId: "someone-elses", vetoHours: 0 }),
      undefined
    );
    // The route resolved the site from the account, not from the body.
    await expect(response.json()).resolves.toEqual({ ok: true, siteId: "site-fixture" });
  });

  it("a refused submission answers 422 carrying the refusal, never a sentence", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const response = await POST(post("/api/setup", { ...SUBMISSION, category: "  " }), undefined);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, refused: "market_missing" });
  });

  it("the site the answer names is the session's, never the body's (#133)", async () => {
    // The fixture store answers with its own site whatever the payload
    // says; what this pins is that the route never read one from the body
    // and never passed one down.
    session = { userId: "someone-else", siteId: "their-site" };
    const { POST } = await import("@/app/api/setup/route");
    const response = await POST(
      post("/api/setup", { ...SUBMISSION, siteId: "not-yours", userId: "not-yours" }),
      undefined
    );
    await expect(response.json()).resolves.toEqual({ ok: true, siteId: "site-fixture" });
  });

  it("a request whose cookie names no account is refused, with a status and no sentence (#133)", async () => {
    // `src/middleware.ts` has already turned away a request with no cookie
    // at all; this arm is the forged, expired or ended one, and it must
    // never fall through to a fixture account.
    session = null;
    const { POST } = await import("@/app/api/setup/route");
    const response = await POST(post("/api/setup", SUBMISSION), undefined);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthenticated" });
  });
});

describe("the account behind setup is the session's, not a fixture (#133)", () => {
  it("_setup/provider.ts hands out the live store", async () => {
    // Asserted on the source, because the module is mocked above for
    // every other test in this file — and what the switch *is* is that one
    // line. `store.test.ts` owns what the live store then does.
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/setup/_setup/provider.ts"),
      "utf8"
    );
    expect(source).toMatch(/export function setupStore\(\): SetupStore \{\s*return liveSetupStore\(\);/);
  });

  it("the route names no fixture account of its own", async () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/api/setup/route.ts"),
      "utf8"
    );
    expect(source).not.toContain("FIXTURE_USER_ID");
    expect(source).toContain("currentSession");
  });
});

describe("POST /api/setup/domain — does this address resolve", () => {
  it("a resolving domain answers with its canonical form, however it was written", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    const response = await POST(post("/api/setup/domain", { host: "https://WWW.Example.com/x" }), undefined);
    const body = (await response.json()) as { domain: string; resolves: boolean };
    expect(body.domain).toBe("example.com");
    expect(body.resolves).toBe(true);
  });

  it("a value that is not a domain answers domain: null, and asks no resolver", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    const response = await POST(post("/api/setup/domain", { host: "not a domain" }), undefined);
    await expect(response.json()).resolves.toEqual({ domain: null, resolves: false, report: null });
  });

  it("a domain that does not resolve answers resolves: false, and still names the domain", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    const response = await POST(post("/api/setup/domain", { host: "unreachable-site.com" }), undefined);
    await expect(response.json()).resolves.toEqual({
      domain: "unreachable-site.com",
      resolves: false,
      report: null,
    });
  });

  it("REQ-021 c11 — nothing is presented as measured for a domain nobody has measured", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    for (const host of ["unmeasured-site.com", "unreachable-site.com"]) {
      const body = await (await POST(post("/api/setup/domain", { host }), undefined)).json();
      expect(body.report, host).toBeNull();
    }
  });

  it("REQ-026 c6 — the address the product did measure answers with its own report, so the market card re-derives", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    const body = await (await POST(post("/api/setup/domain", { host: "example.com" }), undefined)).json();
    expect(body.report).toEqual({
      scanId: "scan-fixture",
      category: "project management software for agencies",
      rivals: ["asana.com", "monday.com", "clickup.com"],
      // The twelve that address's own scan derived travel with it, so the
      // screen shows the new address's questions and not the old one's.
      questions: [
        {
          wording: "What's the best project management software for agencies?",
          search: "best project management software for agencies",
        },
      ],
    });
  });

  it("a body with no host is a 400", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    expect((await POST(post("/api/setup/domain", {}), undefined)).status).toBe(400);
  });
});

describe("POST /api/setup/questions — a corrected category re-derives the twelve", () => {
  it("re-selects over the market the stored report already holds", async () => {
    const { POST } = await import("@/app/api/setup/questions/route");
    const response = await POST(
      post("/api/setup/questions", { domain: "example.com", category: "agency time tracking" }),
      undefined
    );
    const body = (await response.json()) as { questions: { wording: string; search: string }[] };
    const searches = body.questions.map((question) => question.search);

    // What the founder corrected away from is gone, and what they
    // corrected to is chosen — from rows that scan had already bought.
    expect(searches).toContain("best agency time tracking software");
    expect(searches).not.toContain("best project management software for agencies");
    for (const question of body.questions) expect(question.wording.endsWith("?")).toBe(true);
  });

  it("an address nobody measured, and an unstated market, each answer with none", async () => {
    const { POST } = await import("@/app/api/setup/questions/route");
    for (const asked of [
      { domain: "unmeasured-site.com", category: "agency time tracking" },
      { domain: "example.com", category: "   " },
    ]) {
      const response = await POST(post("/api/setup/questions", asked), undefined);
      await expect(response.json()).resolves.toEqual({ questions: [] });
    }
  });

  it("a body that names no domain and category is a 400", async () => {
    const { POST } = await import("@/app/api/setup/questions/route");
    expect((await POST(post("/api/setup/questions", {}), undefined)).status).toBe(400);
  });
});

describe("GET /api/setup/progress — which step, never how long", () => {
  it("answers the pass's state, and the answer carries no time of any kind", async () => {
    const { GET } = await import("@/app/api/setup/progress/route");
    const response = await GET(
      new Request("https://reachkit.example/api/setup/progress"),
      undefined
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.running).toBe(true);
    expect(Object.keys(body).sort()).toEqual(["running", "stage"]);
    for (const key of Object.keys(body)) {
      expect(key).not.toMatch(/(elapsed|remaining|percent|eta|deadline|at$|started)/i);
    }
  });

  it("takes no parameter at all — a founder cannot ask about another founder's pass", async () => {
    const { GET } = await import("@/app/api/setup/progress/route");
    const withQuery = await GET(
      new Request("https://reachkit.example/api/setup/progress?siteId=someone-else"),
      undefined
    );
    const plain = await GET(new Request("https://reachkit.example/api/setup/progress"), undefined);
    await expect(withQuery.json()).resolves.toEqual(await plain.json());
  });
});
