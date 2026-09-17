/** @vitest-environment jsdom */
// tests/app/settings/dns-where.test.tsx — SPEC §5, issue 760
// (owner ruling 2026-09-16)
//
// Beside the CNAME record the founder is told where their DNS actually is,
// because ReachKit looked: the provider the nameservers name, the nameserver
// itself where no provider is known, and the generic line where nothing
// could be looked up. The Cloudflare line shows only on Cloudflare.
//
// **Driven through the wiring, not the table.** Each screen is rendered from
// its own real read — `/setup` from its page, Settings from
// `readLiveSettingsFacts` over destination rows — and mounted, so the record
// block's own lookup runs the real Server Function, the real zone and
// provider mapping and the real egress lookup. The one double is the
// resolver itself, `dns.promises.resolveNs`.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();
process.env.HOSTED_EDGE_CNAME_TARGET = "edge.reachkit-760.example";

import dns from "node:dns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fakeDb } from "../../publish/harness";
import { LIVE_ACCOUNT } from "../accounts";
import {
  passFactory,
  reportFactory,
  resetSetupSession,
  sessionFactory,
  setupSession,
  storeFactory,
} from "../setup/session-door";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}));
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/report", async (importOriginal) =>
  reportFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/deep/progress", () => passFactory());
vi.mock("@/app/(account)/setup/label-actions", () => ({
  checkSubdomainLabel: async () => ({ refusal: null }),
}));
vi.mock("@/lib/account/identity", () => ({
  ...sessionFactory(),
  accountCard: async () => ({
    name: "A Founder",
    email: "founder@acme.test",
    pending: null,
    noteKeys: ["settings.account.magic-link", "settings.account.note.change"],
  }),
}));
vi.mock("@/lib/mail/notifications", () => ({
  readNotifyPrefs: async () => ({}),
}));
vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: () => ({
    kind: "hosted",
    servesPublicly: true,
    hostedByUs: true,
    health: async () => ({ health: "expired", reason: "dns_unset" }),
  }),
}));

const { AWAITING_COPY, COPY, TODO_COPY_MARKER, copy } = await import("@/lib/presentation/copy");
const { default: SetupPage } = await import("@/app/(account)/setup/page");
const { readLiveSettingsFacts } = await import("@/app/(account)/app/settings/store");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { PublishingPanel } = await import("@/app/(account)/app/settings/panels/PublishingPanel");

const DOMAIN = LIVE_ACCOUNT.domain;
const ACCOUNT = { ...LIVE_ACCOUNT, siteId: "site-1", timeZone: "America/New_York" };

const roots: Root[] = [];

beforeEach(() => {
  db.reset();
  resetSetupSession();
  setupSession.address = { siteId: "site-1", domain: DOMAIN };
  setupSession.reports = new Map([[DOMAIN, { scanId: "scan-1", category: "agency software", rivals: [] }]]);
});

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/** The doubled resolver: answers `answer` for every zone, and records what
 *  it was asked. */
function resolver(answer: () => Promise<string[]>): string[] {
  const asked: string[] = [];
  vi.spyOn(dns.promises, "resolveNs").mockImplementation((name: string) => {
    asked.push(name);
    return answer();
  });
  return asked;
}

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  return host;
}

/** The two screens, each scoped to the block that holds the record. */
async function screens(): Promise<Record<"setup" | "settings", HTMLElement>> {
  const setup = await mount(await SetupPage());

  db.seed("sites", [
    {
      id: "site-1",
      user_id: "user-1",
      domain: DOMAIN,
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00",
      timezone: "America/New_York",
      publishing_enabled: true,
    },
  ]);
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "hosted",
      config: null,
      health: "expired",
      health_reason: "dns_unset",
      health_changed_at: "2026-09-16T00:00:00.000Z",
      broken_mail_sent_at: null,
      last_checked_at: new Date().toISOString(),
      created_at: "2026-09-16T00:00:00.000Z",
      deleted_at: null,
      publish_capable: true,
      hostname: `content.${DOMAIN}`,
      hostname_state: "pending_dns",
    },
  ]);
  const settings = await mount(
    <PublishingPanel settings={assembleSettings(await readLiveSettingsFacts(ACCOUNT))} />
  );

  return {
    setup: setup.querySelector<HTMLElement>('[data-testid="setup-destination-hosted"]')!,
    settings: settings.querySelector<HTMLElement>('[data-testid="dns-dest-1"]')!,
  };
}

/** What the block says, once its lookup has settled on `kind`. */
async function whereIn(block: HTMLElement, kind: string): Promise<{ where: string; proxy: string | null }> {
  await vi.waitFor(() =>
    expect(block.querySelector('[data-testid="dns-where"]')?.getAttribute("data-where")).toBe(kind)
  );
  // The record itself is on screen whatever the lookup said.
  expect(block.querySelector('[data-testid="dns-record"]')).not.toBeNull();
  return {
    where: block.querySelector('[data-testid="dns-where"]')!.textContent ?? "",
    proxy: block.querySelector('[data-testid="dns-proxy"]')?.textContent ?? null,
  };
}

describe("SPEC §5 — beside the record, where the founder's DNS actually is (issue 760)", () => {
  it("Cloudflare: named, with the proxy line, on both screens — looked up on the site's zone", async () => {
    const asked = resolver(async () => ["hasslo.ns.cloudflare.com", "connie.ns.cloudflare.com"]);
    for (const [screen, block] of Object.entries(await screens())) {
      expect(await whereIn(block, "provider"), screen).toEqual({
        where: copy("setup.destination.dnsAt", { provider: "Cloudflare" }),
        proxy: COPY["setup.destination.dnsProxy"],
      });
    }
    expect(new Set(asked)).toEqual(new Set([DOMAIN]));
  });

  it("a known provider that is not Cloudflare: named, and no proxy line", async () => {
    resolver(async () => ["ns51.domaincontrol.com", "ns52.domaincontrol.com"]);
    for (const [screen, block] of Object.entries(await screens())) {
      expect(await whereIn(block, "provider"), screen).toEqual({
        where: copy("setup.destination.dnsAt", { provider: "GoDaddy" }),
        proxy: null,
      });
    }
  });

  it("an unknown provider: the nameserver is named as itself, never a guessed brand", async () => {
    resolver(async () => ["ns1.tiny-host.example.", "ns2.tiny-host.example."]);
    for (const [screen, block] of Object.entries(await screens())) {
      expect(await whereIn(block, "nameserver"), screen).toEqual({
        where: copy("setup.destination.dnsNameserver", { nameserver: "ns1.tiny-host.example" }),
        proxy: null,
      });
    }
  });

  it("the lookup failed: the generic line, and the record block is whole", async () => {
    const asked = resolver(() => Promise.reject(Object.assign(new Error("nope"), { code: "ESERVFAIL" })));
    const blocks = await screens();
    await vi.waitFor(() => expect(asked.length).toBe(2));
    for (const [screen, block] of Object.entries(blocks)) {
      expect(await whereIn(block, "unknown"), screen).toEqual({
        where: COPY["setup.destination.dnsWhere"],
        proxy: null,
      });
    }
  });

  it("the resolver throws before answering: the generic line", async () => {
    const asked: string[] = [];
    vi.spyOn(dns.promises, "resolveNs").mockImplementation((name: string) => {
      asked.push(name);
      throw new Error("resolver broke");
    });
    const blocks = await screens();
    await vi.waitFor(() => expect(asked.length).toBe(2));
    for (const [screen, block] of Object.entries(blocks)) {
      expect((await whereIn(block, "unknown")).where, screen).toBe(COPY["setup.destination.dnsWhere"]);
    }
  });

  it("the lookup hangs: the record block renders at once, with the generic line, and waits for nothing", async () => {
    const asked = resolver(() => new Promise<string[]>(() => {}));
    const blocks = await screens();
    await vi.waitFor(() => expect(asked.length).toBe(2));
    for (const [screen, block] of Object.entries(blocks)) {
      expect(await whereIn(block, "unknown"), screen).toEqual({
        where: COPY["setup.destination.dnsWhere"],
        proxy: null,
      });
      expect(block.querySelector('[data-testid="dns-state"]'), screen).not.toBeNull();
    }
  });

  it("an address that is not the site's own is not looked up", async () => {
    setupSession.address = { siteId: "site-1", domain: "someone-else.test" };
    const asked = resolver(async () => ["hasslo.ns.cloudflare.com"]);
    const { settings } = await screens();
    expect((await whereIn(settings, "unknown")).where).toBe(COPY["setup.destination.dnsWhere"]);
    expect(asked).not.toContain(DOMAIN);
  });

  it("every line is written — none awaits copy", () => {
    for (const key of [
      "setup.destination.dnsAt",
      "setup.destination.dnsNameserver",
      "setup.destination.dnsWhere",
      "setup.destination.dnsProxy",
    ] as const) {
      expect(AWAITING_COPY, key).not.toContain(key);
      expect(COPY[key], key).not.toContain(TODO_COPY_MARKER);
    }
  });
});
