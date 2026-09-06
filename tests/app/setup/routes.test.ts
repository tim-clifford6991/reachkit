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
import { beforeAll, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture.ts";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

vi.mock("@/lib/egress", () => ({
  // The one network fact these routes need, stubbed at the seam:
  // `tests/setup.ts` refuses a real resolver to every test in this corpus.
  resolvesInDns: vi.fn(async (host: string) => host !== "unreachable-site.com"),
}));

beforeAll(() => {
  applyEnvFixture();
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

  it.each(["/setup", "/setup/waiting", "/api/setup", "/api/setup/domain", "/api/setup/progress"])(
    "%s without a session is redirected to the sign-in prompt",
    (path) => {
      const res = middleware(requestTo(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "", "https://reachkit.example").pathname).toBe(
        "/signin"
      );
    }
  );

  it.each(["/setup", "/setup/waiting", "/api/setup", "/api/setup/domain", "/api/setup/progress"])(
    "%s with a session is served",
    (path) => {
      expect(middleware(requestTo(path, "rk_session=a-token")).status).toBe(200);
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
    });
  });

  it("a body with no host is a 400", async () => {
    const { POST } = await import("@/app/api/setup/domain/route");
    expect((await POST(post("/api/setup/domain", {}), undefined)).status).toBe(400);
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
