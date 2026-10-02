// tests/vendors/vercel-domains.test.ts — SPEC §5 (2026-09-12)
//
// The call §5 rules: "on save the app adds the hostname to the project's
// domain list … with our server-only token". A 409 for a hostname this
// project already holds is the idempotent case, not a failure; no token is
// an answer, not a throw; and no payload or credential leaves this module.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();
process.env.VERCEL_API_TOKEN = "vercel-token-fixture-do-not-leak";
process.env.VERCEL_PROJECT_ID = "prj_fixture";
process.env.VERCEL_TEAM_ID = "team_fixture";

interface Call {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

const calls: Call[] = [];
const answers: { status: number; body: unknown }[] = [];

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    calls.push({
      url,
      method: opts.method as string | undefined,
      headers: opts.headers as Record<string, string> | undefined,
      body: opts.body as string | undefined,
    });
    const answer = answers.shift();
    if (answer === undefined) return { ok: false, reason: "timeout", url, readAt: new Date() };
    return {
      ok: true,
      status: answer.status,
      url,
      html: JSON.stringify(answer.body),
      bytes: 0,
      readAt: new Date(),
      headers: {},
    };
  },
}));

const { addProjectDomain } = await import("@/lib/vendors/vercel/domains");

beforeEach(() => {
  calls.length = 0;
  answers.length = 0;
});

describe("§5 — the hostname is added to the project's domain list", () => {
  it("a hostname the project accepts is attached, and the vendor's own verification state is what comes back", async () => {
    answers.push({ status: 200, body: { name: "blog.example.com", verified: true } });
    await expect(addProjectDomain("blog.example.com")).resolves.toEqual({
      ok: true,
      attached: true,
      verified: true,
    });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toBe(JSON.stringify({ name: "blog.example.com" }));
  });

  it("an accepted hostname whose record has not resolved is attached and not verified — never guessed", async () => {
    answers.push({ status: 200, body: { name: "blog.example.com" } });
    await expect(addProjectDomain("blog.example.com")).resolves.toEqual({
      ok: true,
      attached: true,
      verified: false,
    });
  });

  it("**idempotent**: a hostname this project already holds answers 409, and the read behind it says attached", async () => {
    // A second save of the same label must not leave the customer's record
    // pointing at a project that has never heard of them.
    answers.push({ status: 409, body: { error: { code: "domain_already_in_use" } } });
    answers.push({ status: 200, body: { name: "blog.example.com", verified: true } });
    await expect(addProjectDomain("blog.example.com")).resolves.toEqual({
      ok: true,
      attached: true,
      verified: true,
    });
    expect(calls).toHaveLength(2);
  });

  it("a hostname another project holds is `elsewhere`, which is the one refusal a customer could act on", async () => {
    answers.push({ status: 409, body: { error: { code: "domain_already_in_use" } } });
    answers.push({ status: 404, body: { error: { code: "not_found" } } });
    await expect(addProjectDomain("blog.example.com")).resolves.toEqual({
      ok: false,
      because: "elsewhere",
    });
  });

  it("a vendor that did not answer is `no_answer`, never a throw", async () => {
    // No answer queued: the seam returns its transport failure.
    await expect(addProjectDomain("blog.example.com")).resolves.toEqual({
      ok: false,
      because: "no_answer",
    });
  });
});

describe("the token, and what may leave this module", () => {
  it("the credential travels in one Authorization header and in nothing else", async () => {
    answers.push({ status: 200, body: { verified: false } });
    await addProjectDomain("blog.example.com");
    const call = calls[0];
    expect(call?.headers?.Authorization).toBe("Bearer vercel-token-fixture-do-not-leak");
    expect(call?.url).not.toContain("vercel-token-fixture-do-not-leak");
    expect(call?.body ?? "").not.toContain("vercel-token-fixture-do-not-leak");
  });

  it("no answer this module returns carries a vendor message, a status or the credential", async () => {
    answers.push({ status: 403, body: { error: { code: "forbidden", message: "Not authorized" } } });
    const answer = await addProjectDomain("blog.example.com");
    const printed = JSON.stringify(answer);
    expect(printed).not.toContain("Not authorized");
    expect(printed).not.toContain("403");
    expect(printed).not.toContain("vercel-token-fixture-do-not-leak");
  });

  it("every byte leaves through the audited seam — there is no bare fetch in this module", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../src/lib/vendors/vercel/domains.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/[^.\w]fetch\(/);
    expect(source).toContain("safeFetch");
  });
});

describe("a deployment that carries no token", () => {
  it("answers `not_configured` and reaches nothing, so a founder's save does not fail over a binding", async () => {
    const token = process.env.VERCEL_API_TOKEN;
    delete process.env.VERCEL_API_TOKEN;
    vi.resetModules();
    try {
      const fresh = await import("@/lib/vendors/vercel/domains");
      await expect(fresh.addProjectDomain("blog.example.com")).resolves.toEqual({
        ok: false,
        because: "not_configured",
      });
      await expect(fresh.projectDomainState("blog.example.com")).resolves.toEqual({
        ok: false,
        because: "not_configured",
      });
      expect(calls).toHaveLength(0);
    } finally {
      process.env.VERCEL_API_TOKEN = token;
      vi.resetModules();
    }
  });
});

describe("#1045 — a team-owned project is named on every call", () => {
  it("the add and the read behind a 409 both carry ?teamId=", async () => {
    answers.push({ status: 409, body: {} });
    answers.push({ status: 200, body: { name: "content.reachkit.app", verified: true } });
    await addProjectDomain("content.reachkit.app");
    expect(calls.map((c) => new URL(c.url).searchParams.get("teamId"))).toEqual([
      "team_fixture",
      "team_fixture",
    ]);
    expect(new URL(calls[0]!.url).pathname).toBe("/v10/projects/prj_fixture/domains");
    expect(new URL(calls[1]!.url).pathname).toBe("/v9/projects/prj_fixture/domains/content.reachkit.app");
  });
});
