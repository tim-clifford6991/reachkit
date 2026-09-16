/** @vitest-environment jsdom */
// tests/app/settings/check-connection.test.tsx — SPEC §5, issue #757
// (owner ruling 2026-09-16)
//
// A founder who has created their CNAME presses one control — on `/setup`
// before submitting, or in Settings — and is told now whether the host is
// connected. Three answers, never two: the domain list says live, the domain
// list says waiting, or nothing could be asked.
//
// **Driven through the wiring, not the unit.** Each screen is rendered from
// its own real read, the press runs the real Server Function, which runs the
// real `checkHostnameNow` and the real `addProjectDomain`. The fake is the
// vendor itself — the one `safeFetch` the Domains API goes out through — and
// the two bindings `addProjectDomain` reads, so "no token bound" is the
// deployment the owner has today and not a stub of the answer.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();
const EDGE = "edge.reachkit-757.example";
process.env.HOSTED_EDGE_CNAME_TARGET = EDGE;

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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

/** The vendor: what the Domains API answers, what it was asked, and whether
 *  the deployment carries the two bindings at all. */
const vendor = vi.hoisted(() => ({
  bound: true,
  answer: "unverified" as "verified" | "unverified" | "silent",
  calls: [] as { url: string; method: string | undefined; body: string | undefined }[],
}));

vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  const bindings: Record<string, string> = {
    VERCEL_API_TOKEN: "vercel-token-757",
    VERCEL_PROJECT_ID: "prj_757",
  };
  return {
    ...actual,
    env: new Proxy(
      {},
      {
        get: (_target, key: string) =>
          key in bindings ? (vendor.bound ? bindings[key] : undefined) : actual.env[key],
      }
    ),
  };
});

vi.mock("@/lib/egress", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  safeFetch: async (url: string, opts: { method?: string; body?: string }) => {
    vendor.calls.push({ url, method: opts.method, body: opts.body });
    if (vendor.answer === "silent") return { ok: false, reason: "timeout", url, readAt: new Date() };
    return {
      ok: true,
      status: 200,
      url,
      html: JSON.stringify({ verified: vendor.answer === "verified" }),
      bytes: 0,
      readAt: new Date(),
      headers: {},
    };
  },
}));

const revalidated = vi.hoisted(() => [] as string[]);
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidated.push(path),
}));
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
const { checkConnection } = await import("@/app/(account)/_destination/check-actions");
const { DESTINATION_HOSTNAME_CHECK_FLOOR_S } = await import("@/lib/config/constants");
const { liveSetupStore } = await import("@/app/(account)/setup/_setup/store");
const { destinationWorking } = await import("@/lib/publish/destinations");

const DOMAIN = LIVE_ACCOUNT.domain;
const HOST = `content.${DOMAIN}`;
const ACCOUNT = { ...LIVE_ACCOUNT, siteId: "site-1", timeZone: "America/New_York" };

// Every test starts an hour after the last, so the per-instance floor one
// test's press sets never reaches the next test's first press.
let clock = Date.parse("2026-09-16T12:00:00.000Z");
const MINUTE = 60_000;

const roots: Root[] = [];

beforeEach(() => {
  clock += 60 * MINUTE;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  db.reset();
  resetSetupSession();
  setupSession.address = { siteId: "site-1", domain: DOMAIN };
  setupSession.reports = new Map([[DOMAIN, { scanId: "scan-1", category: "agency software", rivals: [] }]]);
  vendor.bound = true;
  vendor.answer = "unverified";
  vendor.calls.length = 0;
  revalidated.length = 0;
});

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
});

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

/** Presses the one control inside `scope` and waits for the press to settle. */
async function press(scope: HTMLElement): Promise<void> {
  const button = scope.querySelector<HTMLButtonElement>('[data-testid="check-connection-press"]');
  expect(button).not.toBeNull();
  await act(async () => {
    button!.click();
  });
  await vi.waitFor(() => expect(button!.disabled).toBe(false));
}

function answerIn(scope: HTMLElement): { outcome: string | null; text: string } | null {
  const line = scope.querySelector('[data-testid="check-connection-answer"]');
  return line === null ? null : { outcome: line.getAttribute("data-outcome"), text: line.textContent ?? "" };
}

function tooSoonIn(scope: HTMLElement): string | null {
  return scope.querySelector('[data-testid="check-connection-too-soon"]')?.textContent ?? null;
}

/** The hosts the Domains API was asked to attach. */
function attached(): string[] {
  return vendor.calls
    .filter((call) => call.method === "POST")
    .map((call) => (JSON.parse(call.body ?? "{}") as { name: string }).name);
}

// ── /setup, before submit ────────────────────────────────────────────────

async function setupScreen(): Promise<HTMLElement> {
  const host = await mount(await SetupPage());
  return host;
}

function hostedRecordState(host: HTMLElement): string {
  return (
    host.querySelector('[data-testid="setup-destination-hosted"] [data-testid="dns-state"]')?.textContent ?? ""
  );
}

describe("SPEC §5 — /setup: the founder verifies their record before submitting (#757)", () => {
  it("live: the vendor is asked about <label>.<their address>, and the record reads live", async () => {
    vendor.answer = "verified";
    const host = await setupScreen();
    expect(hostedRecordState(host)).toBe(COPY["settings.destination.hostname.waiting"]);

    await press(host);

    expect(attached()).toEqual([HOST]);
    expect(vendor.calls[0]!.url).toContain("/projects/prj_757/domains");
    expect(answerIn(host)).toEqual({ outcome: "live", text: COPY["settings.destination.check.live"] });
    expect(hostedRecordState(host)).toBe(COPY["settings.destination.hostname.live"]);
    // Keyed on the host: no destination exists before submit, and none is made.
    expect(db.rows("destinations")).toEqual([]);
  });

  it("pending_dns: the vendor answered and the host is not verified", async () => {
    vendor.answer = "unverified";
    const host = await setupScreen();

    await press(host);

    expect(attached()).toEqual([HOST]);
    expect(answerIn(host)).toEqual({
      outcome: "pending_dns",
      text: COPY["settings.destination.check.pending-dns"],
    });
    expect(hostedRecordState(host)).toBe(COPY["settings.destination.hostname.waiting"]);
  });

  it("could not ask — no token bound (today's deployment): nothing is asked, and it does not read as waiting", async () => {
    vendor.bound = false;
    const host = await setupScreen();

    await press(host);

    expect(vendor.calls).toEqual([]);
    expect(answerIn(host)).toEqual({
      outcome: "could_not_ask",
      text: COPY["settings.destination.check.could-not-ask"],
    });
  });

  it("could not ask — the vendor did not answer", async () => {
    vendor.answer = "silent";
    const host = await setupScreen();

    await press(host);

    expect(vendor.calls).toHaveLength(1);
    expect(answerIn(host)?.outcome).toBe("could_not_ask");
  });

  it("the throttle: a second press inside the floor asks nothing, says when to ask again, and keeps the last answer as it was", async () => {
    const host = await setupScreen();
    await press(host);
    expect(answerIn(host)?.outcome).toBe("pending_dns");

    vi.setSystemTime(clock + 10_000);
    vendor.answer = "verified";
    await press(host);

    expect(vendor.calls).toHaveLength(1);
    const wait = DESTINATION_HOSTNAME_CHECK_FLOOR_S - 10;
    expect(tooSoonIn(host)).toBe(copy("settings.destination.check.too-soon", { seconds: wait }));
    // The earlier answer is not replaced by an answer nobody asked for.
    expect(answerIn(host)?.outcome).toBe("pending_dns");

    vi.setSystemTime(clock + DESTINATION_HOSTNAME_CHECK_FLOOR_S * 1000);
    await press(host);

    expect(vendor.calls).toHaveLength(2);
    expect(tooSoonIn(host)).toBeNull();
    expect(answerIn(host)?.outcome).toBe("live");
  });
});

describe("issue #791 — a press at /setup that verified is recorded on the row the submit creates", () => {
  it("verified before submit: the destination is created live and healthy, even when the vendor does not answer the submit", async () => {
    db.seed("sites", [
      {
        id: "site-1",
        user_id: "user-1",
        domain: DOMAIN,
        created_at: "2026-09-16T00:00:00.000Z",
        setup_completed_at: null,
        publishing_enabled: true,
      },
    ]);
    // `apply_setup_choice` as its migration writes the row: deferred,
    // `expired`, the host the founder chose and waiting for DNS.
    db.rpcs.set("apply_setup_choice", (args: Row) => {
      db.seed("destinations", [
        {
          id: "dest-setup",
          site_id: args.p_site_id,
          kind: args.p_kind,
          config: null,
          health: "expired",
          health_reason: "never_connected",
          health_changed_at: "2026-09-16T00:00:00.000Z",
          broken_mail_sent_at: null,
          last_checked_at: "2026-09-16T00:00:00.000Z",
          created_at: "2026-09-16T00:00:00.000Z",
          deleted_at: null,
          hostname: args.p_hostname,
          hostname_state: "pending_dns",
        },
      ]);
      return "dest-setup";
    });
    vendor.answer = "verified";
    await press(await setupScreen());
    expect(answerIn(document.body)?.outcome).toBe("live");

    // The submit's own vendor call finds nothing: the press's answer stands.
    vendor.answer = "silent";
    vendor.calls.length = 0;
    // The submit's write, as `completeSetup` makes it once the payload is
    // accepted (`.test` is not a registrable domain, so the shape checks in
    // front of it are not what this case drives).
    await liveSetupStore().commitSetup({
      siteId: "site-1",
      submission: {
        domain: DOMAIN,
        category: "agency software",
        competitors: [],
        destination: { kind: "hosted", label: "content" },
        voiceText: "",
      },
    });

    expect(vendor.calls).toEqual([]);
    const row = db.rows("destinations").find((r) => r.id === "dest-setup")!;
    expect(row).toMatchObject({ hostname: HOST, hostname_state: "live", health: "ok", health_reason: null });
    expect(await destinationWorking("site-1")).toBe(true);
  });
});

describe("#759 (owner ruling 2026-09-16) — every line the press draws is written", () => {
  it("the six keys are written, and the button, each answer and the throttle line render no marker", async () => {
    for (const key of [
      "settings.destination.check.button",
      "settings.destination.check.live",
      "settings.destination.check.pending-dns",
      "settings.destination.check.could-not-ask",
      "settings.destination.check.too-soon",
      "setup.destination.check.address-unsaved",
    ] as const) {
      expect(AWAITING_COPY, key).not.toContain(key);
    }

    const host = await setupScreen();
    const button = host.querySelector('[data-testid="check-connection-press"]');
    expect(button?.textContent).toBe(COPY["settings.destination.check.button"]);

    const seen: (string | undefined)[] = [];
    for (const answer of ["unverified", "silent", "verified"] as const) {
      vendor.answer = answer;
      clock += DESTINATION_HOSTNAME_CHECK_FLOOR_S * 1000;
      vi.setSystemTime(clock);
      await press(host);
      seen.push(answerIn(host)?.text);
    }
    expect(seen).toEqual([
      COPY["settings.destination.check.pending-dns"],
      COPY["settings.destination.check.could-not-ask"],
      COPY["settings.destination.check.live"],
    ]);

    await press(host);
    expect(tooSoonIn(host)).not.toBeNull();
    expect(host.textContent).not.toContain(TODO_COPY_MARKER);
  });
});

describe("SPEC §5 — the press asks only about the session's own site (#757)", () => {
  it("the host is composed from the site's stored address, never from a host the browser names", async () => {
    await checkConnection({ draft: { label: "blog", domain: DOMAIN } });
    expect(attached()).toEqual([`blog.${DOMAIN}`]);
  });

  it("an address that is not the site's own is refused, and the vendor is not asked", async () => {
    const answer = await checkConnection({ draft: { label: "www", domain: "somebody-else.example" } });
    expect(answer).toEqual({ outcome: "refused", because: "address_unsaved" });
    expect(vendor.calls).toEqual([]);
  });

  it("a label that is not a label is refused before the vendor is asked", async () => {
    const answer = await checkConnection({ draft: { label: "not a label!", domain: DOMAIN } });
    expect(answer).toEqual({ outcome: "refused", because: "not_a_label" });
    expect(vendor.calls).toEqual([]);
  });

  it("a host another site holds is refused as taken, and the vendor is not asked about somebody else's record", async () => {
    db.seed("destinations", [
      { id: "dest-other", site_id: "site-other", kind: "hosted", hostname: HOST, deleted_at: null },
    ]);
    const answer = await checkConnection({ draft: { label: "content", domain: DOMAIN } });
    expect(answer).toEqual({ outcome: "refused", because: "taken" });
    expect(vendor.calls).toEqual([]);
  });

  it("from Settings, an account with no hosted destination has nothing to check", async () => {
    const answer = await checkConnection({ draft: null });
    expect(answer).toEqual({ outcome: "refused", because: "no_host" });
    expect(vendor.calls).toEqual([]);
  });
});

// ── Settings ──────────────────────────────────────────────────────────────

function seedSettings(destination: Row): void {
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
      hostname: HOST,
      hostname_state: "pending_dns",
      ...destination,
    },
  ]);
}

async function settingsScreen(): Promise<HTMLElement> {
  const settings = assembleSettings(await readLiveSettingsFacts(ACCOUNT));
  return mount(<PublishingPanel settings={settings} />);
}

function destinationRow(): Row {
  return db.rows("destinations").find((row) => row.id === "dest-1")!;
}

/** Ten minutes ago: inside the scheduled pass's hourly window, outside the
 *  press's floor — the case a silently throttled button would lie about. */
function tenMinutesAgo(): string {
  return new Date(clock - 10 * MINUTE).toISOString();
}

describe("SPEC §5 — Settings: the same press, beside the record a waiting host shows (#757)", () => {
  it("live: the press bypasses the hourly window, records live, and the redrawn card reads live with no record", async () => {
    seedSettings({ hostname_checked_at: tenMinutesAgo() });
    vendor.answer = "verified";
    const host = await settingsScreen();
    const block = host.querySelector<HTMLElement>('[data-testid="dns-dest-1"]')!;

    await press(block);

    expect(attached()).toEqual([HOST]);
    expect(answerIn(block)).toEqual({ outcome: "live", text: COPY["settings.destination.check.live"] });
    expect(destinationRow().hostname_state).toBe("live");
    expect(destinationRow().hostname_checked_at).toBe(new Date(clock).toISOString());
    // Issue #791: verified is healthy, in the same press — the guard that
    // holds every page reads it now, not after some later pass.
    expect(destinationRow()).toMatchObject({
      health: "ok",
      health_reason: null,
      health_changed_at: new Date(clock).toISOString(),
      last_checked_at: new Date(clock).toISOString(),
    });
    expect(await destinationWorking("site-1")).toBe(true);
    expect(revalidated).toEqual(["/app/settings"]);

    // What revalidation redraws: the card from the row the press wrote.
    const redrawn = await settingsScreen();
    expect(redrawn.querySelector('[data-testid="dns-dest-1"]')).toBeNull();
    expect(redrawn.querySelector('[data-testid="destination-dest-1"]')?.textContent).toContain(
      COPY["settings.destination.hostname.live"]
    );
  });

  it("pending_dns: the vendor answered not yet, the row says so with a new date, and the record stays", async () => {
    seedSettings({ hostname_checked_at: tenMinutesAgo() });
    const host = await settingsScreen();
    const block = host.querySelector<HTMLElement>('[data-testid="dns-dest-1"]')!;

    await press(block);

    expect(attached()).toEqual([HOST]);
    expect(answerIn(block)?.outcome).toBe("pending_dns");
    expect(destinationRow().hostname_state).toBe("pending_dns");
    expect(destinationRow().hostname_checked_at).toBe(new Date(clock).toISOString());

    const redrawn = await settingsScreen();
    expect(redrawn.querySelector('[data-testid="dns-dest-1"] [data-testid="dns-record"]')).not.toBeNull();
  });

  it("could not ask — no token bound: the row's word is left standing, and the founder is told nothing was asked", async () => {
    seedSettings({ hostname_checked_at: tenMinutesAgo() });
    vendor.bound = false;
    const host = await settingsScreen();
    const block = host.querySelector<HTMLElement>('[data-testid="dns-dest-1"]')!;

    await press(block);

    expect(vendor.calls).toEqual([]);
    expect(answerIn(block)).toEqual({
      outcome: "could_not_ask",
      text: COPY["settings.destination.check.could-not-ask"],
    });
    expect(destinationRow().hostname_state).toBe("pending_dns");
  });

  it("could not ask — the vendor did not answer: the same line, and the recorded word is not raised or lowered", async () => {
    seedSettings({ hostname_checked_at: tenMinutesAgo() });
    vendor.answer = "silent";
    const host = await settingsScreen();
    const block = host.querySelector<HTMLElement>('[data-testid="dns-dest-1"]')!;

    await press(block);

    expect(vendor.calls).toHaveLength(1);
    expect(answerIn(block)?.outcome).toBe("could_not_ask");
    expect(destinationRow().hostname_state).toBe("pending_dns");
  });

  it("the throttle: a host asked about seconds ago — by the scheduled pass — is not asked again, and the founder is told when they may", async () => {
    seedSettings({ hostname_checked_at: new Date(clock - 5_000).toISOString() });
    const host = await settingsScreen();
    const block = host.querySelector<HTMLElement>('[data-testid="dns-dest-1"]')!;

    await press(block);

    expect(vendor.calls).toEqual([]);
    expect(answerIn(block)).toBeNull();
    expect(tooSoonIn(block)).toBe(
      copy("settings.destination.check.too-soon", { seconds: DESTINATION_HOSTNAME_CHECK_FLOOR_S - 5 })
    );
    expect(revalidated).toEqual([]);
  });
});
