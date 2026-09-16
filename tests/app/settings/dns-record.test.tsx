/** @vitest-environment jsdom */
// tests/app/settings/dns-record.test.tsx — SPEC §5, issue #754
//
// The hosted CNAME record was shown once, on `/setup`, and never again:
// Settings said "waiting for DNS" and had no way to say what the record was,
// because `HOSTED_EDGE_CNAME_TARGET` reached the setup provider and nothing
// else. A founder who did not act during setup could never learn it.
//
// **One fact, two screens.** Each side goes through its own real read — the
// setup page through `readSetupScreen`, Settings through
// `readLiveSettingsFacts` over destination rows — with the deployment's
// binding set to a value no fixture carries, and the record Settings renders
// is held to the record setup rendered for the same site and label. A unit
// of `dnsRecordFor` alone would pass with the binding never reaching
// Settings, which is the defect.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();
// Not the fixture's value, which is also the default host of the fixture's
// own site: a record that happened to echo its name would pass against it.
const EDGE = "edge.reachkit-754.example";
process.env.HOSTED_EDGE_CNAME_TARGET = EDGE;

import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type Row } from "../../publish/harness";
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
// The row is freshly checked, so no check runs; were one to, it states the
// row's own state rather than resolving DNS from a test.
vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: () => ({
    kind: "hosted",
    servesPublicly: true,
    hostedByUs: true,
    health: async () => ({ health: "expired", reason: "dns_unset" }),
  }),
}));

const { COPY } = await import("@/lib/presentation/copy");
const { default: SetupPage } = await import("@/app/(account)/setup/page");
const { readLiveSettingsFacts } = await import("@/app/(account)/app/settings/store");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { PublishingPanel } = await import("@/app/(account)/app/settings/panels/PublishingPanel");

const DOMAIN = LIVE_ACCOUNT.domain;
const ACCOUNT = { ...LIVE_ACCOUNT, siteId: "site-1", timeZone: "America/New_York" };

interface Shown {
  name: string;
  type: string;
  value: string;
}

function recordIn(root: ParentNode): Shown | null {
  const record = root.querySelector('[data-testid="dns-record"]');
  if (record === null) return null;
  const part = (id: string) => record.querySelector(`[data-testid="dns-${id}"]`)?.textContent ?? "";
  return { name: part("name"), type: part("type"), value: part("value") };
}

/** The founder at setup, on the address `DOMAIN`, having typed `label` —
 *  or left the default where `label` is `null`. */
async function setupShows(label: string | null): Promise<Shown | null> {
  const host = document.createElement("div");
  document.body.append(host);
  const page = await SetupPage();
  await act(async () => {
    createRoot(host).render(page);
  });
  if (label !== null) {
    const field = host.querySelector<HTMLInputElement>('input[name="label"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(field, label);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  return recordIn(host.querySelector('[data-testid="setup-destination-hosted"]')!);
}

/** The same founder's Settings, over the destination row setup's commit
 *  left: the host they chose, in the state the domain list reported. */
async function settingsShows(destination: Row): Promise<{ host: HTMLElement; record: Shown | null }> {
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
      hostname_state: "pending_dns",
      ...destination,
    },
  ]);
  const settings = assembleSettings(await readLiveSettingsFacts(ACCOUNT));
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<PublishingPanel settings={settings} />);
  return { host, record: recordIn(host) };
}

beforeEach(() => {
  db.reset();
  resetSetupSession();
  setupSession.address = { siteId: "site-1", domain: DOMAIN };
  setupSession.reports = new Map([[DOMAIN, { scanId: "scan-1", category: "agency software", rivals: [] }]]);
});

describe("SPEC §5 — a host waiting for DNS shows its record in Settings, the record setup showed (#754)", () => {
  it("the default label: Settings renders the record setup rendered, with the deployment's edge", async () => {
    const atSetup = await setupShows(null);
    const { host, record } = await settingsShows({ hostname: `content.${DOMAIN}` });

    expect(atSetup).toEqual({ name: `content.${DOMAIN}`, type: "CNAME", value: EDGE });
    expect(record).toEqual(atSetup);
    // Under the action that names it, in the destination's own row.
    const block = host.querySelector('[data-testid="dns-dest-1"]');
    expect(block?.querySelector('[data-testid="dns-record"]')).not.toBeNull();
    expect(block?.textContent).toContain(COPY["settings.publishing.set-dns"]);
  });

  it("a label the founder chose: the record names their host on both screens", async () => {
    const atSetup = await setupShows("blog");
    const { record } = await settingsShows({ hostname: `blog.${DOMAIN}` });

    expect(atSetup?.name).toBe(`blog.${DOMAIN}`);
    expect(record).toEqual(atSetup);
  });

  it("once the host is live there is no record to create, and none is shown", async () => {
    const { host, record } = await settingsShows({
      hostname: `content.${DOMAIN}`,
      hostname_state: "live",
      health: "ok",
      health_reason: null,
    });
    expect(record).toBeNull();
    expect(host.querySelector('[data-testid="dns-dest-1"]')).toBeNull();
  });
});
