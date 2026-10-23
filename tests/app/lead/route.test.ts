// BUILD §4.2 — POST /api/lead: a transport adapter and nothing else.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import {
  memoryStore,
  newMemoryState,
  type MemoryState,
} from "../../mail/leads/memory-store";
import { codeOf } from "../../mail/leads/source";

applyEnvFixture();

const { POST } = await import("../../../src/app/api/lead/route");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

let state: MemoryState;

function post(body: unknown, raw?: string): Request {
  return new Request("https://reachkit.example/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  state = newMemoryState();
  state.scans.set("scan-1", "acme.com");
  setLeadStore(memoryStore(state));
});

afterEach(() => setLeadStore(null));

describe("the two arms of captureLead map to two responses, totally", () => {
  it("a capture answers 202 with the acceptance key — the address was accepted, not the page delivered", async () => {
    const response = await POST(post({ scanId: "scan-1", email: "anna@example.com" }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, message: "lead.accepted" });
    expect(state.leads).toHaveLength(1);
  });

  it("a malformed address answers 422 with its own key", async () => {
    const response = await POST(post({ scanId: "scan-1", email: "not-an-address" }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "lead.invalid_address" });
  });

  it("a store that will not take the row answers 503, and confirms nothing", async () => {
    state.failInsert = true;
    const response = await POST(post({ scanId: "scan-1", email: "anna@example.com" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "lead.unavailable" });
    expect(state.leads).toEqual([]);
  });
});

describe('REQ-010 c1 — the body carries an address and nothing else: "no account, no password, no payment, no further field"', () => {
  it("a body carrying a further property is rejected rather than silently ignored", async () => {
    const response = await POST(
      post({ scanId: "scan-1", email: "anna@example.com", password: "hunter2" })
    );
    expect(response.status).toBe(400);
    // A field quietly dropped here is a field that could be added to the
    // form tomorrow and reach the engine.
    expect(state.leads).toEqual([]);
  });

  it("a body missing either field, or holding a non-string, is a 400", async () => {
    for (const body of [
      {},
      { scanId: "scan-1" },
      { email: "anna@example.com" },
      { scanId: 1, email: "anna@example.com" },
      { scanId: "scan-1", email: null },
    ]) {
      const response = await POST(post(body));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(state.leads).toEqual([]);
  });

  it("an unparseable body is a 400 and reaches no engine module", async () => {
    const response = await POST(post(undefined, "{not json"));
    expect(response.status).toBe(400);
    expect(state.leads).toEqual([]);
  });
});

describe("every response body carries a CopyKey, never a sentence and never a vendor payload", () => {
  it("the three responses carry exactly a key", async () => {
    state.failInsert = true;
    const unavailable = await (await POST(post({ scanId: "scan-1", email: "a@b.example" }))).json();
    expect(unavailable.message).toBe("lead.unavailable");
    // The message is a key, not a rendered line: no space, no punctuation
    // that a sentence would carry.
    expect(unavailable.message).toMatch(/^[a-z][a-z_.]*$/);
  });

  it("the adapter holds no lead logic: no clock, no database, no mail call, no address validation of its own", () => {
    const code = codeOf("src/app/api/lead/route.ts");
    expect(code).not.toMatch(/dbAdmin|from "@\/lib\/db"|new Date|Date\.now/);
    expect(code).not.toMatch(/sendEmail|scheduleSequence|deliverFirstPage|@\/lib\/mail\/send/);
    // No address rule of its own: no regex over an address, no `.test(`.
    expect(code).not.toMatch(/\/\^?\[\^\\s@\]|\.test\(/);
  });

  it("it imports exactly one engine module", () => {
    const code = codeOf("src/app/api/lead/route.ts");
    const engineImports = [...code.matchAll(/from "(@\/lib\/[^"]+)"/g)].map((m) => m[1]);
    // The copy type is a type-only import of the registry's `CopyKey`; the
    // one value import is the capture seam.
    expect(engineImports).toEqual(["@/lib/presentation/copy", "@/lib/mail/leads"]);
  });
});

describe("the log line names the scan and never the address", () => {
  it("an accepted capture logs the scan id alone", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => lines.push(String(line));
    try {
      await POST(post({ scanId: "scan-1", email: "anna@example.com" }));
    } finally {
      console.log = original;
    }
    const apiLine = lines.find((line) => line.includes("api_lead"));
    expect(apiLine).toBeDefined();
    expect(apiLine).toContain("scan-1");
    expect(apiLine).not.toContain("anna@example.com");
  });
});
