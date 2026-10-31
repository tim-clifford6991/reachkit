// The sign-in action under the shared limiter: past a limit it mails nothing and answers exactly as it does below it.
// `take_rate_limits` is stood in for at the PostgREST boundary with its fixed-window count; its SQL is
// `tests/db/rate-limits.test.ts`'s.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock } from "../../account/send-mock";

applyEnvFixture();

let client = new Headers({ "x-forwarded-for": "203.0.113.7" });
vi.mock("next/headers", () => ({ headers: async () => client }));
vi.mock("@/lib/mail/send", () => sendMock());

const { sendLink } = await import("@/app/(public)/signin/actions");
const { SIGN_IN_INITIAL, EMAIL_FIELD } = await import("@/app/(public)/signin/state");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../../account/memory-store");

const MINUTE = 60_000;
const START = Date.parse("2026-10-31T00:00:00Z");

type Rpc = { p_scopes: string[]; p_keys: string[]; p_window_s: number[]; p_max: number[] };
let hits = new Map<string, number>();
let limiter: "up" | "down" = "up";
/** What reached the store and the limiter, in order. */
let trail: string[] = [];

function fakeTakeRateLimits(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!String(input).endsWith("/rest/v1/rpc/take_rate_limits")) throw new Error(`unexpected fetch ${String(input)}`);
  trail.push("limit");
  if (limiter === "down") return Promise.resolve(new Response("{}", { status: 503 }));
  const args = JSON.parse(String(init?.body)) as Rpc;
  const now = Date.now() / 1000;
  const allowed = args.p_scopes.every((scope, i) => {
    const windowS = args.p_window_s[i] ?? 1;
    const row = `${scope}|${args.p_keys[i]}|${Math.floor(now / windowS)}`;
    const count = (hits.get(row) ?? 0) + 1;
    hits.set(row, count);
    return count <= (args.p_max[i] ?? 0);
  });
  return Promise.resolve(new Response(JSON.stringify(allowed), { headers: { "content-type": "application/json" } }));
}

let accounts = newMemoryAccounts();

async function openAccount(email: string) {
  await memoryAccountStore(accounts).insertAccount({
    email,
    checkoutSessionId: `cs_${email}`,
    facts: { stripe_customer_id: "cus_x", billing_country: null, vat_number: null },
  });
}

async function ask(email: string) {
  const form = new FormData();
  form.set(EMAIL_FIELD, email);
  return sendLink(SIGN_IN_INITIAL, form);
}

const mailsTo = (email: string) => sendCalls.filter((m) => m.to === email).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: START });
  vi.stubGlobal("fetch", fakeTakeRateLimits);
  hits = new Map();
  limiter = "up";
  trail = [];
  client = new Headers({ "x-forwarded-for": "203.0.113.7" });
  sendCalls.length = 0;
  accounts = newMemoryAccounts();
  const store = memoryAccountStore(accounts);
  setAccountStore({
    ...store,
    accountByEmail: (email) => {
      trail.push("account");
      return store.accountByEmail(email);
    },
  });
  registerSignInLinkIssuer(async () => ({ issued: true, url: "https://reachkit.example/signin?t=tok", expiresAt: new Date() }));
});

afterEach(() => {
  registerSignInLinkIssuer(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sign-in link requests are throttled, silently", () => {
  it("4th request in 15 min is silent", async () => {
    await openAccount("owner@acme.example");
    const answers = [];
    for (let i = 0; i < 4; i++) {
      answers.push(await ask("owner@acme.example"));
      vi.setSystemTime(Date.now() + 3 * MINUTE);
    }
    expect(mailsTo("owner@acme.example")).toBe(3);
    expect(answers[3]).toEqual({ ...answers[0], sentAt: answers[3]?.sentAt });
    expect(answers[3]).toMatchObject({ answer: "requested", value: "owner@acme.example" });

    vi.setSystemTime(START + 15 * MINUTE);
    await ask("owner@acme.example");
    expect(mailsTo("owner@acme.example")).toBe(4);
  });

  it("daily cap per address", async () => {
    await openAccount("owner@acme.example");
    for (let i = 0; i < 11; i++) {
      vi.setSystemTime(START + i * 20 * MINUTE);
      await ask("owner@acme.example");
    }
    expect(mailsTo("owner@acme.example")).toBe(10);

    vi.setSystemTime(START + 24 * 60 * MINUTE);
    await ask("owner@acme.example");
    expect(mailsTo("owner@acme.example")).toBe(11);
  });

  it("no account oracle under the limit", async () => {
    for (let i = 0; i < 3; i++) await ask("Late@Acme.example");
    expect(trail).toEqual(["limit", "account", "limit", "account", "limit", "account"]);

    // The account opens now; the three requests made before it still count against the address.
    await openAccount("late@acme.example");
    trail = [];
    const known = await ask("late@acme.example");
    const unknown = await (async () => {
      for (let i = 0; i < 3; i++) await ask("nobody@acme.example");
      return ask("nobody@acme.example");
    })();
    expect(sendCalls).toEqual([]);
    expect(known).toEqual({ ...unknown, value: "late@acme.example", sentAt: known.sentAt });
    // A limited request stops at the limiter, account or not, so its work and timing are one class.
    expect(trail).toEqual(["limit", "limit", "account", "limit", "account", "limit", "account", "limit"]);
  });

  it("per-network cap", async () => {
    const addresses = Array.from({ length: 21 }, (_, i) => `person${i}@acme.example`);
    for (const email of addresses) await openAccount(email);
    for (const email of addresses) {
      await ask(email);
      vi.setSystemTime(Date.now() + 2 * MINUTE);
    }
    expect(sendCalls.map((m) => m.to)).toEqual(addresses.slice(0, 20));

    client = new Headers({ "x-forwarded-for": "198.51.100.4" });
    await ask(addresses[20] ?? "");
    expect(mailsTo(addresses[20] ?? "")).toBe(1);
  });

  it("fails open", async () => {
    limiter = "down";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await openAccount("owner@acme.example");
    for (let i = 0; i < 4; i++) await ask("owner@acme.example");
    expect(mailsTo("owner@acme.example")).toBe(4);
  });
});
