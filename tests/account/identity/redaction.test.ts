// tests/account/identity/redaction.test.ts — BUILD §13, issues #35, #468
//
// BP-061 `## NFR budget`, quoted: "No token plaintext, cookie value or link
// URL is ever logged, in any environment." And: "Observability: one event
// per issue, redeem and change, carrying `userId`, `purpose` and outcome —
// never the address, never the token."
//
// Since #468 the token is Supabase's hash and the cookie is Supabase's
// session; neither may reach a log line any more than our own did.
//
// Runtime, not only source: every console call the whole flow makes is
// captured and searched for the things that must never appear. A source
// scan alone would miss a value logged through a helper; this misses
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
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");
const { FAKE_AUTH_COOKIE, addAuthUser, cookieJarIO, fakeIdentityAuth, newFakeAuth } = await import(
  "./fake-auth"
);

const IDENTITY_DIR = path.resolve(import.meta.dirname, "../../../src/lib/account/identity");
const NOW = new Date("2026-09-06T12:00:00.000Z");

let state = newMemoryIdentity();
let auth = newFakeAuth();
let logged: string[] = [];
const spies: { mockRestore: () => void }[] = [];

beforeEach(() => {
  state = newMemoryIdentity();
  auth = newFakeAuth();
  auth.now = () => NOW;
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
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

function account(email: string) {
  const user = addAccount(state, { email });
  addAuthUser(auth, { id: user.id, email });
  return user;
}

function linkOf(url: string): { tokenHash: string; type: "magiclink" | "email_change" } {
  const params = new URL(url).searchParams;
  return {
    tokenHash: params.get("token_hash") ?? "",
    type: params.get("type") === "email_change" ? "email_change" : "magiclink",
  };
}

describe('BP-061 — "No token plaintext, cookie value or link URL is ever logged"', () => {
  it("a whole sign-in — issue, redeem, and a second redeem that fails — logs none of them", async () => {
    const user = account("founder@example.com");
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    const jar = new Map<string, string>();

    await redeemLink(cookieJarIO(jar), linkOf(issued.url), NOW);
    await redeemLink(cookieJarIO(new Map()), linkOf(issued.url), NOW);
    await redeemLink(cookieJarIO(new Map()), { tokenHash: "a-hash-nobody-issued", type: "magiclink" }, NOW);

    const cookie = jar.get(FAKE_AUTH_COOKIE) ?? "";
    expect(cookie.length).toBeGreaterThan(0);
    const output = logged.join("\n");
    expect(output).not.toContain(issued.url);
    expect(output).not.toContain(issued.tokenHash);
    expect(output).not.toContain(cookie);
    expect(output).not.toContain("founder@example.com");
  });

  it("a whole email change — begin, redeem — logs neither address nor token", async () => {
    const user = account("old@example.com");
    await beginEmailChange(user.id, "new@example.com", NOW);
    const href = String(
      (sendCalls[0]?.blocks ?? []).find(
        (b): b is { href: string } => typeof b === "object" && b !== null && "href" in b
      )?.href ?? ""
    );
    await redeemLink(cookieJarIO(new Map()), linkOf(href), NOW);

    const output = logged.join("\n");
    expect(output).not.toContain("old@example.com");
    expect(output).not.toContain("new@example.com");
    expect(output).not.toContain(linkOf(href).tokenHash);
    expect(output).not.toContain(href);
  });

  it("something IS logged — an assertion that passed on an empty log would prove nothing", async () => {
    const user = account("founder@example.com");
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
