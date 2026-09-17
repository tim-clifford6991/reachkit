/** @vitest-environment jsdom */
// tests/app/settings/dns-guide.test.tsx — SPEC §5, issue 760 (owner ruling
// 2026-09-16) and issue 856 (owner 2026-09-17)
//
// Beside the CNAME record the founder is told where their DNS actually is,
// because ReachKit looked: the provider the nameservers name, the nameserver
// itself where no provider is known, and the generic line where nothing
// could be looked up. That answer chooses the steps they follow (issue 856):
// the provider's own field labels, exactly what goes in the name field, a
// link to the provider's DNS page, and on Cloudflare only the one proxy
// instruction — DNS only.
//
// **Driven through the wiring, not the table.** Each screen is rendered from
// its own real read — `/setup` from its page, Settings from
// `readLiveSettingsFacts` over destination rows — and mounted, so the record
// block's own lookup runs the real Server Function, the real zone and
// provider mapping and the real egress lookup. The one double is the
// resolver itself, `dns.promises.resolveNs`.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();
const EDGE = "edge.reachkit-760.example";
process.env.HOSTED_EDGE_CNAME_TARGET = EDGE;

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
    setup: setup.querySelector<HTMLElement>('[data-testid="setup-dns"]')!,
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

/** The guide the block draws, once its lookup has settled on `id`. */
async function guideIn(
  block: HTMLElement,
  id: string
): Promise<{
  steps: string[];
  fields: [string, string][];
  proxy: string | null;
  link: string | null;
  linkText: string | null;
  fullName: string | null;
}> {
  await vi.waitFor(() => expect(block.querySelector('[data-testid="dns-guide"]')?.getAttribute("data-guide")).toBe(id));
  const link = block.querySelector('[data-testid="dns-link"]');
  return {
    steps: Array.from(block.querySelectorAll('[data-testid="dns-step"]')).map((step) => step.textContent ?? ""),
    fields: Array.from(block.querySelectorAll('[data-testid="dns-field"]')).map((row) => [
      row.querySelector('[data-testid="dns-field-label"]')?.textContent ?? "",
      row.querySelectorAll("td")[0]?.textContent ?? "",
    ]),
    proxy: block.querySelector('[data-testid="dns-proxy"]')?.textContent ?? null,
    link: link?.getAttribute("href") ?? null,
    linkText: link?.textContent ?? null,
    fullName: block.querySelector('[data-testid="dns-full-name"]')?.textContent ?? null,
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

  it("Cloudflare (issue 856): Name is the label alone, Proxy status is DNS only, and the steps say the grey cloud", async () => {
    resolver(async () => ["hasslo.ns.cloudflare.com", "connie.ns.cloudflare.com"]);
    for (const [screen, block] of Object.entries(await screens())) {
      const guide = await guideIn(block, "cloudflare");
      expect(guide.fields, screen).toEqual([
        [COPY["setup.destination.guide.field.type"], "CNAME"],
        [COPY["setup.destination.guide.field.name"], "content"],
        [COPY["setup.destination.guide.field.target"], EDGE],
        [COPY["setup.destination.guide.field.proxy-status"], COPY["setup.destination.guide.value.dns-only"]],
        [COPY["setup.destination.guide.field.ttl"], COPY["setup.destination.guide.value.auto"]],
      ]);
      expect(guide.steps, screen).toContain(
        copy("setup.destination.guide.cloudflare.3", { name: "content", zone: DOMAIN })
      );
      // One instruction, not a choice.
      expect(guide.proxy, screen).toContain("DNS only");
      expect(guide.proxy, screen).toContain("grey cloud");
      expect(guide.proxy, screen).not.toMatch(/either|try/i);
      expect(guide.link, screen).toMatch(/^https:\/\/dash\.cloudflare\.com\//);
      expect(guide.fullName, screen).toBe(copy("setup.destination.guide.full-name", { host: `content.${DOMAIN}` }));
    }
  });

  it.each([
    ["GoDaddy", ["ns51.domaincontrol.com", "ns52.domaincontrol.com"], "godaddy", "setup.destination.guide.field.name", "setup.destination.guide.field.value"],
    ["Namecheap", ["dns1.registrar-servers.com", "dns2.registrar-servers.com"], "namecheap", "setup.destination.guide.field.host", "setup.destination.guide.field.value"],
    ["Squarespace", ["ns-cloud-a1.googledomains.com", "ns-cloud-a2.googledomains.com"], "squarespace", "setup.destination.guide.field.host", "setup.destination.guide.field.data"],
    ["Amazon Route 53", ["ns-1.awsdns-01.org", "ns-2.awsdns-02.com"], "route53", "setup.destination.guide.field.record-name", "setup.destination.guide.field.value"],
    ["Vercel", ["ns1.vercel-dns.com", "ns2.vercel-dns.com"], "vercel", "setup.destination.guide.field.name", "setup.destination.guide.field.value"],
  ] as const)(
    "%s (issue 856): its own steps, its own field labels with the label alone as the name, a link, and no proxy line",
    async (provider, nameservers, id, nameLabel, targetLabel) => {
      resolver(async () => [...nameservers]);
      for (const [screen, block] of Object.entries(await screens())) {
        expect((await whereIn(block, "provider")).where, screen).toBe(copy("setup.destination.dnsAt", { provider }));
        const guide = await guideIn(block, id);
        expect(guide.fields, screen).toContainEqual([COPY[nameLabel], "content"]);
        expect(guide.fields, screen).toContainEqual([COPY[targetLabel], EDGE]);
        expect(guide.steps.length, screen).toBeGreaterThanOrEqual(3);
        expect(guide.steps.join(" "), screen).toContain(DOMAIN);
        expect(guide.link, screen).toMatch(/^https:\/\//);
        expect(guide.linkText, screen).toBe(copy("setup.destination.guide.open", { provider }));
        expect(guide.proxy, screen).toBeNull();
      }
    }
  );

  it("an unknown provider or no answer (issue 856): the generic steps, which name both the label and the full name, and no link", async () => {
    resolver(async () => ["ns1.tiny-host.example."]);
    for (const [screen, block] of Object.entries(await screens())) {
      await whereIn(block, "nameserver");
      const guide = await guideIn(block, "generic");
      expect(guide.steps, screen).toContain(
        copy("setup.destination.guide.generic.2", { name: "content", host: `content.${DOMAIN}` })
      );
      expect(guide.fields, screen).toContainEqual([COPY["setup.destination.guide.field.generic-name"], "content"]);
      expect(guide.link, screen).toBeNull();
      expect(guide.proxy, screen).toBeNull();
    }
  });

  it("each value has its own copy button, and pressing one puts that value on the clipboard (issue 856)", async () => {
    resolver(async () => ["ns51.domaincontrol.com"]);
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    });
    const { settings } = await screens();
    await guideIn(settings, "godaddy");
    const rows = Array.from(settings.querySelectorAll<HTMLElement>('[data-testid="dns-field"]'));
    for (const row of rows) {
      await act(async () => {
        row.querySelector<HTMLButtonElement>('[data-testid="dns-copy"]')!.click();
      });
    }
    expect(written).toEqual(["CNAME", "content", EDGE]);
    expect(rows[0]!.querySelector('[data-testid="dns-copy"]')?.getAttribute("aria-label")).toBe(
      COPY["setup.destination.guide.copied"]
    );
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
      ...(Object.keys(COPY).filter((key) => key.startsWith("setup.destination.guide.")) as (keyof typeof COPY)[]),
    ] as const) {
      expect(AWAITING_COPY, key).not.toContain(key);
      expect(COPY[key], key).not.toContain(TODO_COPY_MARKER);
    }
  });
});
