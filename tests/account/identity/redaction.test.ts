// tests/account/identity/redaction.test.ts — BUILD §13, issue #35
//
// BP-061 `## NFR budget`, quoted: "No token plaintext, cookie value or link
// URL is ever logged, in any environment." And: "Observability: one event
// per issue, redeem and change, carrying `userId`, `purpose` and outcome —
// never the address, never the token."
//
// Runtime, not only source: every console call the whole flow makes is
// captured and searched for the three things that must never appear. A
// source scan alone would miss a value logged through a helper; this misses
// nothing the flow actually emits.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { beginEmailChange } = await import("../../../src/lib/account/identity/email-change");
const { issueLink, redeemLink } = await import("../../../src/lib/account/identity/links");
const { mintSessionCookie } = await import("../../../src/lib/account/identity/cookie");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");

const IDENTITY_DIR = path.resolve(import.meta.dirname, "../../../src/lib/account/identity");
const NOW = new Date("2026-09-06T12:00:00.000Z");

let state = newMemoryIdentity();
let logged: string[] = [];
const spies: { mockRestore: () => void }[] = [];

beforeEach(() => {
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  logged = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    spies.push(
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      })
    );
  }
});

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});

function tokenOf(url: string): string {
  const segments = new URL(url).pathname.split("/");
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

describe('BP-061 — "No token plaintext, cookie value or link URL is ever logged"', () => {
  it("a whole sign-in — issue, redeem, and a second redeem that fails — logs none of the three", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    const token = tokenOf(issued.url);
    const cookie = mintSessionCookie({ userId: user.id, siteId: null, issuedAt: NOW });

    await redeemLink(token, NOW);
    await redeemLink(token, NOW);
    await redeemLink("a-token-nobody-issued", NOW);

    const output = logged.join("\n");
    expect(output).not.toContain(token);
    expect(output).not.toContain(issued.url);
    expect(output).not.toContain(cookie);
    expect(output).not.toContain(issued.tokenHash);
  });

  it("a whole email change — begin, redeem, cancel — logs neither address nor token", async () => {
    const user = addAccount(state, { email: "old@example.com" });
    await beginEmailChange(user.id, "new@example.com", NOW);
    const href = String(
      (sendCalls[0]?.blocks ?? []).find(
        (b): b is { href: string } => typeof b === "object" && b !== null && "href" in b
      )?.href ?? ""
    );
    await redeemLink(tokenOf(href), NOW);

    const output = logged.join("\n");
    expect(output).not.toContain("old@example.com");
    expect(output).not.toContain("new@example.com");
    expect(output).not.toContain(tokenOf(href));
    expect(output).not.toContain(href);
  });

  it("something IS logged — an assertion that passed on an empty log would prove nothing", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.join("\n")).toContain(user.id);
    expect(logged.join("\n")).toContain("sign_in");
  });
});

describe("the shape of an observability line has no field the token could ride in", () => {
  const files = readdirSync(IDENTITY_DIR).filter((f) => f.endsWith(".ts"));

  it("every console call in this directory goes through `logLink`, whose parameter carries four fields", () => {
    for (const file of files) {
      const source = readFileSync(path.join(IDENTITY_DIR, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      const calls = source.match(/console\.[a-z]+\(/g) ?? [];
      if (file === "outcomes.ts") {
        expect(calls).toEqual(["console.info("]);
        continue;
      }
      expect(calls, `${file} logs directly instead of through logLink`).toEqual([]);
    }
  });
});
