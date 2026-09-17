/** @vitest-environment jsdom */
// tests/app/stopped-banner.test.tsx — SPEC §4/§7, REQ-092, issue 841
//
// "ReachKit stopped its own work today" is said only when work really
// stopped: the kill switch is engaged, or the day's spend ceiling is
// reached. The owner's walk found it on a new site whose pass came back
// with no market — the switch off, 4.41¢ of 5000¢ spent — where the
// market-too-small state is the true account.
//
// **Driven through the wiring.** The real `/app` layout over the real
// Overview and Calendar pages for a live account: the real `readShell` →
// `readShellFacts` → `readStop` → `stopCause`, the real calendar provider →
// `readCalendarFacts` → the same `readStop` and the real supply reads, and
// the real `readOnboarding` → `releaseNotice` → `marketTooSmall`. Doubled:
// the database (a PostgREST-shaped fake, the day's ledger among its RPCs),
// the environment's kill switch, the report reader, and the reads this
// suite is not about (§7's week, §9's month of pages, REQ-071's hold).
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb } from "../publish/harness";
import { LIVE_ACCOUNT } from "./accounts";
import { measuredZero } from "@/lib/measure/measured";
import type { OpportunityStore } from "@/lib/opportunities/store";
import type { StoredReport } from "@/lib/scan/report";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

/** The `KILL_SWITCH` binding, as `reachKitStopped` reads it. */
const binding = vi.hoisted(() => ({ killSwitch: false }));
vi.mock("@/lib/publish/switch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/publish/switch")>()),
  reachKitStopped: async () => binding.killSwitch,
}));

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));
const MONTH = "2026-09";

/** The deep pass the owner walked: complete, zero questions — §6's market
 *  too small — and so no SERPs, no rivals and no opportunities. */
const THIN: StoredReport = {
  complete: true,
  stoppedReason: "complete",
  questions: measuredZero([], AT),
  aiAnswers: {},
  presence: {},
} as unknown as StoredReport;

vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/report")>()),
  readCurrentReport: async () => THIN,
}));

vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  readWeek: async () => [],
  nextForDay: async () => null,
  rankOpen: async () => [],
}));

vi.mock("@/app/(account)/app/calendar/drafts-read", () => ({
  readPublishingFacts: async () => ({
    readable: true,
    pagesByDay: new Map(),
    publishAt: new Map(),
    heldDays: [],
    customerChangeHoldsPages: null,
  }),
}));

vi.mock("@/lib/market/changes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/market/changes")>()),
  declaredAnswers: async () => null,
  measuredAnswers: async () => null,
  declaredTimezone: async () => null,
}));

const { setOpportunityStore } = await import("@/lib/opportunities/store");
const { default: OverviewPage } = await import("@/app/(account)/app/page");
const { default: CalendarPage } = await import("@/app/(account)/app/calendar/page");
const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { COPY } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("./account-door");

/** Zero supply over a market never measured (issue 765's reads). */
const THIN_SUPPLY = {
  countUnused: async () => 0,
  lastStatusChangeAt: async () => null,
  latestCompletedScanAt: async () => AT,
  currentReport: async () => THIN,
} as unknown as OpportunityStore;

function render(html: string): Element {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

async function overview(): Promise<Element> {
  return render(renderToStaticMarkup(await AppLayout({ children: await OverviewPage() })));
}

async function calendar(): Promise<Element> {
  const page = await CalendarPage({ searchParams: Promise.resolve({ month: MONTH }) });
  return render(renderToStaticMarkup(await AppLayout({ children: page })));
}

const text = (tree: Element, id: string) => tree.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;

/** The day's product-wide spend, in cents, as `fetches_spend_since` sums it. */
function daySpent(cents: number): void {
  db.rpcs.set("fetches_spend_since", () => cents);
}

beforeEach(() => {
  db.reset();
  db.seed("sites", [
    {
      id: LIVE_ACCOUNT.siteId,
      user_id: LIVE_ACCOUNT.userId,
      domain: LIVE_ACCOUNT.domain,
      timezone: LIVE_ACCOUNT.timeZone,
      publishing_enabled: true,
      setup_completed_at: AT.toISOString(),
      setup_released_at: AT.toISOString(),
      setup_released_reason: "completed",
      setup_stage: null,
      setup_stage_times: {},
    },
  ]);
  // The pass's own row: no questions, so its sections are missing and the
  // row is `degraded` — the fact the old read turned into a stop.
  db.seed("scans", [
    {
      id: "2d5d2302",
      site_id: LIVE_ACCOUNT.siteId,
      tier: "deep",
      status: "degraded",
      stopped_reason: "complete",
      created_at: AT.toISOString(),
    },
  ]);
  db.seed("publications", []);
  db.seed("drafts", []);
  binding.killSwitch = false;
  daySpent(4.41);
  setOpportunityStore(THIN_SUPPLY);
  signedInAs(LIVE_ACCOUNT);
});

afterEach(() => {
  resetAccount();
  setOpportunityStore(null);
});

describe("issue 841 — a pass that found no market is not ReachKit stopping", () => {
  it("Overview: no stopped banner; the market-too-small state instead", async () => {
    const tree = await overview();
    expect(tree.querySelector('[data-testid="shell-stopped"]')).toBeNull();
    expect(tree.innerHTML).not.toContain(COPY["stopped.work.line"]);
    expect(text(tree, "shell-onboarding-notice")).toBe(COPY["setup.release.market-too-small"]);
    expect(text(tree, "overview-supply")).toBe(COPY["overview.supply.unmeasured"]);
  });

  it("Calendar: no stopped banner and no stopped day; the never-measured supply state instead", async () => {
    const tree = await calendar();
    expect(tree.querySelector('[data-testid="shell-stopped"]')).toBeNull();
    expect(tree.innerHTML).not.toContain(COPY["stopped.work.line"]);
    expect(text(tree, "calendar-supply-statement")).toBe(COPY["calendar.supply.unmeasured"]);
    const lines = [...tree.querySelectorAll('[data-testid="cell-empty-line"]')].map((n) => n.textContent);
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines)).toEqual(new Set([COPY["calendar.empty.supply-unmeasured"]]));
  });
});

describe("issue 841 — a real stop still says so", () => {
  it("kill switch engaged: the banner, on Overview and on Calendar", async () => {
    binding.killSwitch = true;
    for (const tree of [await overview(), await calendar()]) {
      expect(text(tree, "shell-stopped-line")).toBe(COPY["stopped.work.line"]);
      expect(text(tree, "shell-stopped-needs")).toBe(COPY["stopped.work.needs-nothing"]);
      expect(text(tree, "shell-stopped-resumes")).toBe(COPY["stopped.work.no-time-promised"]);
    }
  });

  it("the day's spend ceiling reached: the banner", async () => {
    daySpent(5000);
    expect(text(await overview(), "shell-stopped-line")).toBe(COPY["stopped.work.line"]);
  });
});
