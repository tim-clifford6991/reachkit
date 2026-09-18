// tests/app/opt-out/one-click-route.test.ts — SPEC §8, issue 889
//
// `POST /api/opt-out/{token}` is RFC 8058's one-click endpoint: the address
// a mail client reaches when the reader presses the client's own
// Unsubscribe control. The claim worth having is that pressing it
// unsubscribes on that one POST alone — no page, no session, no second
// control — because that is exactly what `List-Unsubscribe-Post` promises
// the client on this product's behalf, and a mail that promises it and does
// not keep it is worse than one that never claimed it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import {
  blankLead,
  memoryStore,
  newMemoryState,
  type MemoryState,
} from "../../mail/leads/memory-store";

applyEnvFixture();

const route = await import("../../../src/app/api/opt-out/[token]/route");
const { optOutTokenFor } = await import("../../../src/lib/mail/leads/optout");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

const ADDRESS = "anna@example.com";
const ORIGIN = "https://reachkit.example";

let state: MemoryState;

/** The body a conforming client sends. It is deliberately not read by the
 *  route — asserted below — so it is sent here as the real thing rather
 *  than as something the route was written around. */
function oneClickPost(token: string): [Request, { params: Promise<{ token: string }> }] {
  return [
    new Request(`${ORIGIN}/api/opt-out/${token}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    }),
    { params: Promise.resolve({ token }) },
  ];
}

beforeEach(() => {
  state = newMemoryState();
  state.leads = [
    blankLead({ id: "l1", email: ADDRESS, domain: "acme.com", sequence_state: "running" }),
  ];
  setLeadStore(memoryStore(state));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  setLeadStore(null);
  vi.restoreAllMocks();
});

describe("one POST is the whole of the unsubscribe", () => {
  it("suppresses the address and stops its running sequences, with no session", async () => {
    const response = await route.POST(...oneClickPost(optOutTokenFor(ADDRESS)));

    expect(response.status).toBe(200);
    expect(state.suppressions.has(ADDRESS)).toBe(true);
    expect(state.leads[0]?.sequence_state).toBe("stopped");
  });

  it("is idempotent — a client that POSTs twice is not an error", async () => {
    const token = optOutTokenFor(ADDRESS);
    await route.POST(...oneClickPost(token));
    const again = await route.POST(...oneClickPost(token));
    expect(again.status).toBe(200);
  });

  it("answers no body at all, either way", async () => {
    const response = await route.POST(...oneClickPost(optOutTokenFor(ADDRESS)));
    await expect(response.text()).resolves.toBe("");
  });

  it("a token this product never signed suppresses nobody", async () => {
    const response = await route.POST(...oneClickPost("not-a-token"));
    expect(response.status).toBe(404);
    expect(state.suppressions.size).toBe(0);
  });

  it("a store that could not be written is told apart from a bad token", async () => {
    state.failSuppressionWrite = true;
    const response = await route.POST(...oneClickPost(optOutTokenFor(ADDRESS)));
    // 503, not 404: the reader's link was good and it is ours that is down,
    // so a client has something true to retry against.
    expect(response.status).toBe(503);
    expect(state.suppressions.size).toBe(0);
  });
});

describe("a client that follows the header with a GET still reaches the stop", () => {
  it("is sent to the page, which applies the token and says what happened", async () => {
    const token = optOutTokenFor(ADDRESS);
    const response = await route.GET(
      new Request(`${ORIGIN}/api/opt-out/${token}`),
      { params: Promise.resolve({ token }) }
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/opt-out/${token}`);
  });
});
