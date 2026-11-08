// tests/app/instrumentation.test.ts — BUILD §15
//
// The boot path, driven end to end: `register()` is what Next calls once per server instance, on every cold start of
// every function. It asks no vendor anything and loads only what it registers: the mail and WordPress modules load
// on first use, and the price is the build's check (`tests/account/checkout/price-check.test.ts`).
//
// The fixture's app URL is an https address that is not this machine, so every case boots as a real deployment.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

// Each factory records that its module was loaded, which is the claim: nothing here is loaded by a boot.
const loaded = vi.hoisted(() => ({ mail: false, place: false, stripe: false, incidents: [] as unknown[], sends: [] as unknown[] }));
vi.mock("@/lib/mail/ops", async (importOriginal) => {
  loaded.mail = true;
  return {
    ...(await importOriginal<typeof import("@/lib/mail/ops")>()),
    reportIncident: async (incident: unknown) => void loaded.incidents.push(incident),
  };
});
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (mail: unknown) => {
    loaded.sends.push(mail);
    return { sent: true };
  },
}));
vi.mock("@/lib/publish/destinations/wordpress/stamp-place", () => {
  loaded.place = true;
  return { stampPlace: async () => ({ siteBaseUrl: "https://blog.example.com", stampSlug: "reachkit" }) };
});
vi.mock("stripe", async (importOriginal) => {
  loaded.stripe = true;
  return importOriginal();
});

const { register } = await import("@/instrumentation");
const { registerActiveAccessGate, sitesWithActiveAccess } = await import("@/lib/scan/weekly/access");
const { publishSpendAlert } = await import("@/lib/costs/sinks");
const { leftInWordPress } = await import("@/lib/account/lifecycle/left-in-wordpress");

let logged: string[] = [];
let errored: string[] = [];
const runtimeBefore = process.env.NEXT_RUNTIME;

/** The one line a case expects, parsed. Fails loudly rather than reading
 *  `[0]` off an array the run may not have filled. */
function onlyLine(lines: readonly string[]): Record<string, unknown> {
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0] ?? "") as Record<string, unknown>;
}

beforeEach(() => {
  logged = [];
  errored = [];
  loaded.incidents = [];
  loaded.sends = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => void logged.push(String(line)));
  vi.spyOn(console, "error").mockImplementation((line: unknown) => void errored.push(String(line)));
  process.env.NEXT_RUNTIME = "nodejs";
  // Unregistered before each case, so what is asserted below is this boot
  // registering it and never a leftover from another suite.
  registerActiveAccessGate(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  registerActiveAccessGate(null);
  if (runtimeBefore === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = runtimeBefore;
});

describe("a cold start registers everything and loads no mail, WordPress or payment module", () => {
  // First in the file: the module registry is the evidence, and a later case loads the mail module on purpose.
  it("comes up in order, and the registry holds no mail, stamp-place or Stripe module afterwards", async () => {
    await expect(register()).resolves.toBeUndefined();
    expect(logged.map((line) => JSON.parse(line))).toEqual([
      { event: "boot_invariants", check: "clock", outcome: "checked" },
      { event: "boot_invariants", check: "jobs", outcome: "checked" },
      { event: "boot_invariants", check: "access-gate", outcome: "checked" },
      { event: "boot_invariants", check: "stamp-place", outcome: "checked" },
      { event: "boot_invariants", check: "spend-alerts", outcome: "checked" },
    ]);
    expect(errored).toEqual([]);
    expect(loaded).toMatchObject({ mail: false, place: false, stripe: false });
  });

  it("the access gate is registered", async () => {
    await register();
    await expect(sitesWithActiveAccess("test", [])).resolves.toEqual(new Set());
  });

  it("a crossing published after boot still reaches the owner's mail, once", async () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    await register();
    // Synchronous, as the seam expects: the call returns before the mail module has loaded.
    expect(publishSpendAlert({ crossed: "warn", spentCents: 4000, ceilingCents: 5000 })).toBeUndefined();
    await vi.waitFor(() => expect(loaded.sends).toHaveLength(1));
    expect(loaded.mail).toBe(true);
    expect(JSON.stringify(loaded.sends[0])).toContain("mail.ops.spend-ceiling.warn");
  });

  it("a deleted-account mail built after boot still carries the WordPress place link", async () => {
    await register();
    const map = await leftInWordPress({
      outcomes: [{ destination: "wordpress", outcome: "returned_to_draft" }],
      destinationId: "dest-1",
    });
    expect(map.returned_to_draft).toEqual({
      count: 1,
      place: { siteBaseUrl: "https://blog.example.com", stampSlug: "reachkit" },
    });
    expect(loaded.place).toBe(true);
  });

  it("the edge runtime does nothing at all — the assertions read server-only bindings", async () => {
    process.env.NEXT_RUNTIME = "edge";
    await expect(register()).resolves.toBeUndefined();
    expect(logged).toEqual([]);
    expect(errored).toEqual([]);
  });
});

// ── the frozen clock a deployment may not carry (issue #305) ────────────

describe("a real deployment carrying RK_FIXED_NOW does not start", () => {
  const FIXED_NOW_BEFORE = process.env.RK_FIXED_NOW;

  afterEach(() => {
    if (FIXED_NOW_BEFORE === undefined) delete process.env.RK_FIXED_NOW;
    else process.env.RK_FIXED_NOW = FIXED_NOW_BEFORE;
  });

  it("throws out of register(), before the gate is reached", async () => {
    // `applyEnvFixture` binds `NEXT_PUBLIC_APP_URL` to an https address that
    // is not this machine, so this process looks exactly like a deployment a
    // customer reaches — which is the case that must not boot. The date it
    // would serve is not the date, on every screen, silently.
    process.env.RK_FIXED_NOW = "2026-09-08T12:00:00.000Z";
    await expect(register()).rejects.toThrow(/RK_FIXED_NOW is set on a real deployment/);
    // Nothing after the refusal ran: no line was logged, so the gate was not
    // registered.
    expect(logged).toEqual([]);
    // Issue 330: one line naming the refused check and the error's class,
    // and the owner told the same two names — never the binding's value.
    expect(onlyLine(errored)).toEqual({ event: "boot_invariants", check: "clock", outcome: "refused", reason: expect.any(String) });
    expect(loaded.incidents).toEqual([{ occasion: "boot-refused", check: "clock", errorName: expect.any(String) }]);
    expect(JSON.stringify(loaded.incidents)).not.toContain("2026-09-08");
    expect(sitesWithActiveAccess).toBeDefined();
  });

  it("comes up normally once the binding is gone", async () => {
    delete process.env.RK_FIXED_NOW;
    await expect(register()).resolves.toBeUndefined();
    expect(logged.map((line) => JSON.parse(line))[0]).toEqual({
      event: "boot_invariants",
      check: "clock",
      outcome: "checked",
    });
  });
});

// ── the jobs bindings a deployment must carry (issue #315) ───────────────
//
// **This block stays last in the file.** Its cases drop the module registry
// so that `env` re-parses a `process.env` one binding short, and every
// module `register()` imports after that is a fresh instance — the doubles
// this file installs at the top (the access gate) are bound to
// the old ones. Nothing may follow that expects them.

describe("a real deployment that cannot run a job does not start", () => {
  const SIGNING_BEFORE = process.env.INNGEST_SIGNING_KEY;
  const EVENT_BEFORE = process.env.INNGEST_EVENT_KEY;

  afterEach(() => {
    if (SIGNING_BEFORE === undefined) delete process.env.INNGEST_SIGNING_KEY;
    else process.env.INNGEST_SIGNING_KEY = SIGNING_BEFORE;
    if (EVENT_BEFORE === undefined) delete process.env.INNGEST_EVENT_KEY;
    else process.env.INNGEST_EVENT_KEY = EVENT_BEFORE;
    vi.resetModules();
  });

  it.each(["INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY"] as const)(
    "throws out of register() when %s is missing, before the gate is reached",
    async (name) => {
      delete process.env[name];
      vi.resetModules();
      const { register: freshRegister } = await import("@/instrumentation");
      await expect(freshRegister()).rejects.toThrow(new RegExp(name));
      // The clock check ran and logged; nothing after the refusal did.
      expect(logged.map((line) => JSON.parse(line))).toEqual([
        { event: "boot_invariants", check: "clock", outcome: "checked" },
      ]);
      expect(onlyLine(errored)).toMatchObject({ event: "boot_invariants", check: "jobs", outcome: "refused" });
    }
  );

  it("names no binding value in the refusal", async () => {
    delete process.env.INNGEST_SIGNING_KEY;
    vi.resetModules();
    const { register: freshRegister } = await import("@/instrumentation");
    const thrown = await freshRegister().catch((error: unknown) => error);
    expect(String(thrown)).not.toContain("event-key-fixture");
    expect([...logged, ...errored].join("\n")).not.toContain("event-key-fixture");
  });
});
