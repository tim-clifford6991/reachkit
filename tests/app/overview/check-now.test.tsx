/** @vitest-environment jsdom */
// tests/app/overview/check-now.test.tsx — SPEC §5: Overview's "I've added it,
// check now" while the address is not connected.
//
// The press runs the real Server Function, `checkHostnameNow` and
// `addProjectDomain`; the doubles are the Domains API's one `safeFetch` and
// the public resolver. Each press asks the vendor once and the status line
// says when; a second press inside the hourly window is still asked.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();
const EDGE = "hosted.reachkit.app";
process.env.HOSTED_EDGE_CNAME_TARGET = EDGE;

import dns from "node:dns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fakeDb } from "../../publish/harness";
import { resetSetupSession, sessionFactory, setupSession, storeFactory } from "../setup/session-door";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

/** What the Domains API answers, and every call it was sent. */
const vendor = vi.hoisted(() => ({ verified: false, calls: [] as { url: string; method: string | undefined }[] }));

vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  const bindings: Record<string, string> = { VERCEL_API_TOKEN: "vercel-token-test", VERCEL_PROJECT_ID: "prj_test" };
  return {
    ...actual,
    env: new Proxy({}, { get: (_target, key: string) => (key in bindings ? bindings[key] : actual.env[key]) }),
  };
});

vi.mock("@/lib/egress", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  safeFetch: async (url: string, opts: { method?: string }) => {
    vendor.calls.push({ url, method: opts.method });
    return {
      ok: true,
      status: 200,
      url,
      html: JSON.stringify({ verified: vendor.verified }),
      bytes: 0,
      readAt: new Date(),
      headers: {},
    };
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/account/identity", () => sessionFactory());

const { copy } = await import("@/lib/presentation/copy");
const { CheckNow } = await import("@/app/(account)/app/_overview/CheckNow");

const ZONE = "America/Chicago";
const HOST = "help.harborplumbing.example";
const MINUTE = 60_000;
// Every test starts an hour after the last, so one test's press floor never
// reaches the next.
let clock = Date.parse("2026-10-09T14:00:00.000Z");
const roots: Root[] = [];

function dnsError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  clock += 60 * MINUTE;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  db.reset();
  resetSetupSession();
  setupSession.address = { siteId: "site-1", domain: "harborplumbing.example" };
  vendor.verified = false;
  vendor.calls.length = 0;
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "hosted",
      hostname: HOST,
      hostname_state: "pending_dns",
      hostname_checked_at: null,
      health: "expired",
      created_at: "2026-10-08T15:00:00.000Z",
      deleted_at: null,
    },
  ]);
  vi.spyOn(dns.promises, "resolveCname").mockRejectedValue(dnsError("ENOTFOUND"));
  vi.spyOn(dns.promises, "resolve4").mockRejectedValue(dnsError("ENODATA"));
});

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function mount(checkedAt: string | null): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(<CheckNow checkedAt={checkedAt} timeZone={ZONE} />);
  });
  return host;
}

async function press(scope: HTMLElement): Promise<void> {
  const button = scope.querySelector<HTMLButtonElement>('[data-testid="connect-check"]')!;
  expect(button.textContent).toBe(copy("overview.connect.check"));
  await act(async () => {
    button.click();
  });
  // The first press pays the Server Function's cold imports.
  await vi.waitFor(() => expect(button.disabled).toBe(false), { timeout: 15_000 });
}

const checked = (scope: HTMLElement): string => scope.querySelector('[data-testid="connect-checked"]')?.textContent ?? "";
const note = (scope: HTMLElement): string | null => scope.querySelector('[data-testid="connect-note"]')?.textContent ?? null;
const asked = (): number => vendor.calls.filter((call) => call.method === "POST").length;

/** The site-local clock time, as the status line states it. */
function at(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit" }).format(ms);
}

describe("Overview: I've added it, check now", () => {
  it("asks the domain list once per press and says when, and a second press ten minutes later is asked again", async () => {
    const scope = await mount("2026-10-09T14:00:00.000Z");
    expect(checked(scope)).toBe(copy("overview.connect.checked", { time: "9:00 AM" }));

    await press(scope);
    expect(asked()).toBe(1);
    expect(checked(scope)).toBe(copy("overview.connect.checked", { time: at(clock) }));
    expect(note(scope)).toBeNull();

    clock += 10 * MINUTE;
    vi.setSystemTime(clock);
    await press(scope);
    expect(asked()).toBe(2);
    expect(checked(scope)).toBe(copy("overview.connect.checked", { time: at(clock) }));
    expect(note(scope)).toBeNull();
  });

  it("a host never checked says not found yet, and a verified host says connected", async () => {
    const scope = await mount(null);
    expect(checked(scope)).toBe(copy("overview.connect.unchecked"));

    vendor.verified = true;
    await press(scope);
    expect(asked()).toBe(1);
    expect(checked(scope)).toBe(copy("settings.destination.check.live"));
    expect(db.rows("destinations")[0]).toMatchObject({ hostname_state: "live" });
  });
});

