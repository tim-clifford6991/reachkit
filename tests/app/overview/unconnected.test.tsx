// tests/app/overview/unconnected.test.tsx — SPEC §5 (2026-09-20): Overview
// while the hosted address waits for its DNS record, as board OverviewDNS
// draws it.
//
// The real `/app` page, driven from rows: the head, the one setting in three
// steps with its values and the check, other ways to connect, and the first
// page waiting to go live; no ladder and no go-live time (Q11). The same page
// over a live host, or a WordPress site, is the ordinary Overview.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();
// The edge every customer's record points at, as the board shows it.
const EDGE = "hosted.reachkit.app";
process.env.HOSTED_EDGE_CNAME_TARGET = EDGE;

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { fakeDb, type FakeDb } from "../../publish/harness";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { copy } = await import("@/lib/presentation/copy");

const ZONE = "America/Chicago";
const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
const SITE_ID = ACCOUNT.siteId;
// 10:00 AM in Chicago; the hourly check ran at 9:00 AM; setup was yesterday.
const NOW = new Date("2026-10-09T15:00:00.000Z");
const CHECKED_AT = "2026-10-09T14:00:00.000Z";
const SET_UP_AT = "2026-10-08T15:00:00.000Z";
const TITLE = "Emergency plumber in Austin: what to do in the first hour";

/** A local plumber's guides and a SaaS help centre (Q2). */
const PLUMBER = { label: "help", domain: "harborplumbing.example" };
const SAAS = { label: "guides", domain: "acmecrm.example" };

/** What the account's layout draws around this page: the shell's menu,
 *  publishing line and theme control, and the Overview tabs. */
const SHELL = ["ReachKit", "Overview", "Plan", "Settings", "Waiting for your domain", "Theme: light", "Google", "AI", "Competitors"];
// owner 2026-10-15 #1463: a title is at most six words, so the screen reads "Add one setting to your domain".
const RULED = ["Add one setting where your web address is managed"];

function seed(destination: { kind: "hosted" | "wordpress"; hostname?: string; state?: "pending_dns" | "live" }): void {
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: SITE_ID,
      kind: destination.kind,
      hostname: destination.hostname ?? null,
      hostname_state: destination.state ?? null,
      hostname_checked_at: CHECKED_AT,
      created_at: SET_UP_AT,
      health: "ok",
      deleted_at: null,
    },
  ]);
}

async function screen(): Promise<{ h1: string; html: string; text: string }> {
  const html = renderToStaticMarkup(await OverviewPage());
  const text = html
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ");
  return { h1: /<h1[^>]*>(.*?)<\/h1>/u.exec(html)?.[1] ?? "", html, text };
}

/** The strings the arm draws, in the board's order. */
function boardOrder(customer: { label: string; domain: string }): string[] {
  return [
    copy("overview.connect.day", { n: "2" }),
    copy("overview.connect.head.ready"),
    copy("overview.connect.lead.ready"),
    copy("overview.connect.eyebrow"),
    copy("overview.connect.title"),
    copy("overview.connect.step.open"),
    copy("overview.connect.step.open.line", { domain: customer.domain }),
    copy("overview.connect.step.paste"),
    copy("overview.connect.step.paste.line"),
    copy("overview.connect.step.rest"),
    copy("overview.connect.step.rest.line", { label: customer.label }),
    "Type",
    "CNAME",
    "Name",
    customer.label,
    "Value",
    EDGE,
    copy("overview.connect.check"),
    copy("overview.connect.guide"),
    copy("overview.connect.checked", { time: "9:00 AM" }),
    copy("overview.connect.hourly"),
    copy("overview.connect.other"),
    copy("overview.connect.wordpress"),
    copy("overview.connect.wordpress.link"),
    copy("overview.connect.later"),
    copy("overview.connect.page.eyebrow"),
    TITLE,
    copy("overview.connect.page.line"),
    copy("overview.connect.page.read"),
    copy("overview.connect.progress"),
  ];
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: ACCOUNT.userId,
      domain: ACCOUNT.domain,
      timezone: ZONE,
      competitors: [],
      veto_hours: 24,
      publish_time: "16:00",
      publishing_enabled: true,
    },
  ]);
  db.seed("publications", []);
  // The first page, in review, its window ending at 4:00 PM today.
  db.seed("drafts", [
    {
      id: "d1",
      site_id: SITE_ID,
      state: "in_review",
      title: TITLE,
      scheduled_for: "2026-10-09",
      created_at: "2026-10-08T16:00:00.000Z",
      veto_deadline: "2026-10-09T21:00:00.000Z",
    },
  ]);
  db.seed("scans", []);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/app/(account)/app/_overview/ConnectAddress"),
    import("@/app/(account)/app/_overview/search-provider"),
    import("@/app/(account)/app/_shell/store"),
  ]);
}, 60_000);

describe("Overview for an address not connected yet", () => {
  it.each([PLUMBER, SAAS])("$domain: the board's head, steps, values, check, other ways and first page, in order", async (customer) => {
    seed({ kind: "hosted", hostname: `${customer.label}.${customer.domain}`, state: "pending_dns" });
    const { h1, html, text } = await screen();

    expect(h1).toBe(copy("overview.connect.head.ready"));
    let at = -1;
    for (const line of boardOrder(customer)) {
      const next = text.indexOf(line, at + 1);
      expect(next, `"${line}" after position ${at}`).toBeGreaterThan(at);
      at = next;
    }
    for (const key of ["overview.connect.copy.type", "overview.connect.copy.name", "overview.connect.copy.value"] as const) {
      expect(html).toContain(`aria-label="${copy(key)}"`);
    }
    expect(html).toContain(`data-host="${customer.label}.${customer.domain}"`);
  });

  it("matches board OverviewDNS: every string it draws is on the page, but the layout's own and the allowed", async () => {
    seed({ kind: "hosted", hostname: `${PLUMBER.label}.${PLUMBER.domain}`, state: "pending_dns" });
    const { html } = await screen();
    const result = compare(readFileSync(boardFile("OverviewDNS"), "utf8"), segments(html), readAllow("OverviewDNS"));
    expect(result.missing.filter((line) => !SHELL.includes(line) && !RULED.includes(line))).toEqual([]);
  });

  it("names no go-live time and draws no ladder, week or other module", async () => {
    seed({ kind: "hosted", hostname: `${PLUMBER.label}.${PLUMBER.domain}`, state: "pending_dns" });
    const { html, text } = await screen();
    expect(text).not.toContain("4:00 PM");
    expect(text).not.toContain("{publish_time}");
    expect(html).not.toContain('data-testid="overview-waiting-when"');
    for (const part of ["overview-tiles", "overview-stop-action", "overview-week", "overview-needs-you"]) {
      expect(html).not.toContain(`data-testid="${part}"`);
    }
  });

  it("before the first page is written, the head says the pages wait and no page card is drawn", async () => {
    db.seed("drafts", []);
    seed({ kind: "hosted", hostname: `${SAAS.label}.${SAAS.domain}`, state: "pending_dns" });
    const { h1, html } = await screen();
    expect(h1).toBe(copy("overview.connect.head"));
    expect(html).toContain('data-testid="overview-connect"');
    expect(html).not.toContain('data-testid="overview-waiting"');
  });

  it("once the host is live, Overview is the ordinary one", async () => {
    seed({ kind: "hosted", hostname: `${PLUMBER.label}.${PLUMBER.domain}`, state: "live" });
    const { h1, html } = await screen();
    expect(h1).toBe(copy("overview.head.title"));
    expect(html).toContain('data-testid="overview-waiting"');
    expect(html).not.toContain('data-testid="overview-connect"');
  });

  it("a WordPress site never sees the record box", async () => {
    seed({ kind: "wordpress" });
    const { html } = await screen();
    expect(html).not.toContain('data-testid="dns-record"');
    expect(html).not.toContain('data-testid="overview-connect"');
    expect(html).toContain('data-testid="overview-head"');
  });
});
