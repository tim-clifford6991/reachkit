/** @vitest-environment jsdom */
// tests/app/overview/release-notice.test.tsx — SPEC §5/§6, issue #784
//
// The founder is told when their market was too small, and a zero supply
// over a market that was never measured is never "no pages left".
//
// **Driven through the wiring.** The real `/app` page and layout for a live
// account: the real `readOverview` → `readOverviewFacts` → the real
// `supplyDepth`/`supplyMeasured` over a stood-in opportunity store, and the
// real `readOnboarding` → `passProgressFor` over the `sites` row →
// `releaseNotice` → `marketTooSmall` over the current report. Doubled: the
// database (a PostgREST-shaped fake), the shell's facts (week zero or
// counted), the report reader and §7's week read.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb } from "../../publish/harness";
import { LIVE_ACCOUNT } from "../accounts";
import { measured, measuredZero } from "@/lib/measure/measured";
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

const shell = vi.hoisted(() => ({ weekZero: true }));
vi.mock("@/app/(account)/app/_shell/store", async () => {
  const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
  return {
    readShellFacts: async () => ({
      ...FIXTURE_SHELL_FACTS,
      domain: "acme.test",
      weeks: shell.weekZero ? [] : [{ domain: "acme.test", weekStart: new Date(Date.UTC(2026, 8, 7)), measured: true }],
    }),
  };
});

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

/** The current report `releaseNotice` reads: complete, with `questions`
 *  of the given length — zero is §6's market too small (#770). */
function reportWith(questions: number): StoredReport {
  return {
    complete: true,
    stoppedReason: "complete",
    questions:
      questions === 0
        ? measuredZero([], AT)
        : measured(Array.from({ length: questions }, (_, i) => ({ id: `q${i}` })), AT),
    market: measured({}, AT),
    aiAnswers: {},
    presence: {},
    rivals: measured([], AT),
  } as unknown as StoredReport;
}

const current = vi.hoisted(() => ({ report: null as unknown }));
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/report")>()),
  readCurrentReport: async () => current.report,
}));

vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  readWeek: async () => [],
}));

const { setOpportunityStore } = await import("@/lib/opportunities/store");
const { default: OverviewPage } = await import("@/app/(account)/app/page");
const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { COPY } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("../account-door");

/** The reads `supplyDepth` and `supplyMeasured` are made of. */
function storeWith(a: { unused: number; questions: number; everHeld: boolean }): OpportunityStore {
  const report = reportWith(a.questions);
  return {
    countUnused: async () => a.unused,
    lastStatusChangeAt: async () => (a.everHeld ? AT : null),
    latestCompletedScanAt: async () => AT,
    currentReport: async () => report,
  } as unknown as OpportunityStore;
}

async function screen(): Promise<Element> {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(await AppLayout({ children: await OverviewPage() }));
  return container;
}

const text = (tree: Element, id: string) => tree.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;

beforeEach(() => {
  db.reset();
  db.seed("sites", [
    {
      id: LIVE_ACCOUNT.siteId,
      user_id: LIVE_ACCOUNT.userId,
      domain: LIVE_ACCOUNT.domain,
      timezone: LIVE_ACCOUNT.timeZone,
      setup_completed_at: AT.toISOString(),
      setup_released_at: AT.toISOString(),
      setup_released_reason: "completed",
      setup_stage: null,
      setup_stage_times: {},
    },
  ]);
  db.seed("publications", []);
  db.seed("drafts", []);
  shell.weekZero = true;
  signedInAs(LIVE_ACCOUNT);
});

afterEach(() => {
  resetAccount();
  setOpportunityStore(null);
});

describe("#784 — a market too small is told, and a never-measured zero is not 'no pages left'", () => {
  it("week zero, market too small: the panel states the reason once, and Overview's supply line says never measured", async () => {
    current.report = reportWith(0);
    setOpportunityStore(storeWith({ unused: 0, questions: 0, everHeld: false }));
    const tree = await screen();

    const notices = tree.querySelectorAll('[data-testid="shell-onboarding-notice"]');
    expect(notices.length).toBeGreaterThan(0);
    for (const n of notices) {
      expect(n.textContent).toContain(COPY["setup.release.market-too-small"]);
      // Issue 837: with the choice that measures again now, never a wait.
      expect(n.querySelector('[data-testid="category-choice"]')).not.toBeNull();
      expect(n.textContent).not.toMatch(/Monday/);
    }
    // The panel offers the choice, so Overview does not offer it twice.
    expect(tree.querySelector('[data-testid="overview-market-choice"]')).toBeNull();
    // The panel already says it: Overview does not say it a second time.
    expect(text(tree, "overview-release-notice")).toBeNull();

    expect(text(tree, "overview-supply")).toBe(COPY["overview.supply.unmeasured"]);
    expect(tree.innerHTML).not.toContain(COPY["overview.supply.exhausted"]);
  });

  it("after week zero, a weekly pass that found the market too small is told on Overview", async () => {
    shell.weekZero = false;
    current.report = reportWith(0);
    setOpportunityStore(storeWith({ unused: 0, questions: 0, everHeld: true }));
    const tree = await screen();

    expect(text(tree, "shell-onboarding-notice")).toBeNull();
    expect(text(tree, "overview-release-notice")).toBe(COPY["setup.release.market-too-small"]);
    expect(text(tree, "overview-supply")).toBe(COPY["overview.supply.unmeasured"]);
    // Issue 837: Overview offers the choice itself once the panel does not.
    expect(tree.querySelector('[data-testid="overview-market-choice"] [data-testid="category-choice"]')).not.toBeNull();
  });

  it("a market that had pages and used them up still reads exhausted, with no notice", async () => {
    shell.weekZero = false;
    current.report = reportWith(12);
    setOpportunityStore(storeWith({ unused: 0, questions: 12, everHeld: true }));
    const tree = await screen();

    expect(text(tree, "overview-release-notice")).toBeNull();
    expect(text(tree, "overview-supply")).toBe(COPY["overview.supply.exhausted"]);
  });

  it("a measured-ness read that fails states neither zero", async () => {
    shell.weekZero = false;
    current.report = reportWith(12);
    setOpportunityStore({
      ...storeWith({ unused: 0, questions: 12, everHeld: true }),
      currentReport: async () => {
        throw new Error("the database is down");
      },
    } as unknown as OpportunityStore);
    expect(text(await screen(), "overview-supply")).toBeNull();
  });
});
