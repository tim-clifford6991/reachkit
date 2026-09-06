// tests/app/stripe/webhook.test.ts — BUILD §13, issue #33
//
// The one adapter in this repository whose whole correctness is that it
// does nothing. Two properties, and both are the kind that pass every unit
// test and fail every live webhook if broken:
//
//   1. It verifies nothing and decides nothing. A route that checked the
//      signature "as well" makes the real check look optional and puts a
//      security decision in an adapter.
//   2. The bytes handed over are the bytes received. A signature is
//      computed over bytes; a JSON round-trip anywhere in the route turns
//      every valid webhook into an invalid one, invisibly, because every
//      test that stubs the verifier still passes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const ROUTE_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/api/stripe/webhook/route.ts"
);
const SOURCE = readFileSync(ROUTE_PATH, "utf8");
/** Comments stripped: the route's header describes the checks it does not
 *  make, and prose describing a rule must not fail the test for it. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const handled: { rawBody: Buffer | null; signature: string | null; calls: number } = {
  rawBody: null,
  signature: null,
  calls: 0,
};

vi.mock("@/lib/account/provisioning/webhook", () => ({
  handleStripeWebhook: async (rawBody: Buffer, signature: string) => {
    handled.rawBody = rawBody;
    handled.signature = signature;
    handled.calls += 1;
    return signature === "t_good"
      ? { handled: true, event: "checkout.session.completed", route: "provision" }
      : { handled: false, reason: "signature" };
  },
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

beforeEach(() => {
  handled.rawBody = null;
  handled.signature = null;
  handled.calls = 0;
});

function request(body: Buffer, signature?: string): Request {
  return new Request("https://reachkit.example/api/stripe/webhook", {
    method: "POST",
    body: new Uint8Array(body),
    headers: signature === undefined ? {} : { "stripe-signature": signature },
  });
}

describe("stripe-webhook/body — the bytes handed over are the bytes received", () => {
  it("a body with a multi-byte character, a CRLF and trailing whitespace arrives byte-identical", async () => {
    const raw = Buffer.from('{"type":"x","note":"é\r\n"} ', "utf8");
    await POST(request(raw, "t_good"), undefined);
    expect(Buffer.isBuffer(handled.rawBody)).toBe(true);
    expect(Buffer.compare(handled.rawBody as Buffer, raw)).toBe(0);
  });

  it("rawBody is a Buffer, never a string and never a parsed object", async () => {
    await POST(request(Buffer.from("{}", "utf8"), "t_good"), undefined);
    expect(typeof handled.rawBody).not.toBe("string");
    expect(Buffer.isBuffer(handled.rawBody)).toBe(true);
  });

  it("the route parses nothing: no JSON.parse, no text(), no re-encoding", () => {
    expect(CODE).not.toMatch(/JSON\.parse/);
    expect(CODE).not.toMatch(/\.text\(\)/);
    expect(CODE).not.toMatch(/\.json\(\)/);
    expect(CODE).not.toMatch(/toString\(/);
  });
});

describe("stripe-webhook/verification — this route verifies nothing and decides nothing", () => {
  it("names no signing secret, no constructEvent and no event type", () => {
    expect(CODE).not.toMatch(/STRIPE_WEBHOOK_SECRET|whsec_/);
    expect(CODE).not.toMatch(/constructEvent/);
    expect(CODE).not.toMatch(/checkout\.session|customer\.subscription|invoice\./);
    expect(CODE).not.toMatch(/\bstripe\s*\(/);
  });

  it("resolves exactly one import into src/lib/account/**", () => {
    const accountImports = [...CODE.matchAll(/from\s+["']([^"']+)["']/g)]
      .map((match) => match[1] ?? "")
      .filter((specifier) => specifier.includes("account"));
    expect(accountImports).toEqual(["@/lib/account/provisioning/webhook"]);
  });

  it("a forged signature reaches the seam unchanged — the route makes no judgement of its own", async () => {
    const raw = Buffer.from('{"type":"x"}', "utf8");
    await POST(request(raw, "t_forged"), undefined);
    expect(handled.calls).toBe(1);
    expect(handled.signature).toBe("t_forged");
    expect(Buffer.compare(handled.rawBody as Buffer, raw)).toBe(0);
  });

  it("a missing signature header is passed on as an empty string, not refused here", async () => {
    await POST(request(Buffer.from("{}", "utf8")), undefined);
    expect(handled.calls).toBe(1);
    expect(handled.signature).toBe("");
  });
});

describe("the two arms, and nothing in either body", () => {
  it("handled: true is 200 with no body", async () => {
    const response = await POST(request(Buffer.from("{}", "utf8"), "t_good"), undefined);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("");
  });

  it("handled: false is 400 with no body — no event, no reason, no vendor text", async () => {
    const response = await POST(request(Buffer.from("{}", "utf8"), "t_bad"), undefined);
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("");
  });
});

describe("the runtime is declared, so the body stays raw", () => {
  it("route.ts exports runtime = 'nodejs'", () => {
    expect(CODE).toMatch(/export const runtime = "nodejs"/);
  });
});
