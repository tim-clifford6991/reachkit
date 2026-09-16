/** @vitest-environment jsdom */
// tests/app/shell/onboarding.test.tsx — SPEC §5, issue #782
//
// Finishing setup lands the founder in `/app`, and the deep pass and the
// first draft run in the background. What the founder sees is the shell's
// side panel: which step is under way while the pass runs, "writing your
// first page" while the first draft is written, and nothing — or the
// founder's reason — once the pass has released them.
//
// **Driven through the wiring.** The panel is read by the real `/app`
// layout for a live account, from the real `passProgressFor` over the
// `sites` row; the pass is the real `scan/run` job, through the real
// engine and the real `runDeepPass`, whose stage writes and release latch
// land in that same row. Doubled: the database (a PostgREST-shaped fake),
// the pipeline's own spend (`runScan`, which the journeys drive), §7's
// derivation, the daily selection and §8's generator — the last of which is
// where the test looks at the app while the first draft is being written.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { fakeDb } from "../../publish/harness";
import { LIVE_ACCOUNT } from "../accounts";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn(), refresh: nav.refresh }),
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

vi.mock("@/app/(account)/app/_shell/store", async () => {
  const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
  // Week zero: no weekly pass has run for a founder who just finished setup.
  return { readShellFacts: async () => ({ ...FIXTURE_SHELL_FACTS, domain: "acme.test", weeks: [] }) };
});

const pass = vi.hoisted(() => ({ status: "done" as "done" | "degraded" | "failed" }));
vi.mock("@/lib/scan/run", () => ({
  claimOnboardingPass: async () => "scan-onboarding",
  runScan: async (a: { onStage: (stage: string) => Promise<void> }) => {
    await a.onStage("reading_your_site");
    await a.onStage("scoring");
    return { scanId: "scan-onboarding", status: pass.status };
  },
}));
vi.mock("@/lib/opportunities", () => ({ deriveForPass: async () => undefined }));
vi.mock("@/lib/scan/site-category", () => ({ readSiteCategory: async () => undefined }));
vi.mock("@/lib/site-profile", () => ({ adoptVoiceText: async () => undefined }));
vi.mock("@/lib/publish/daily", () => ({
  sitesForDailyTick: async () => ({ sites: [{ siteId: LIVE_ACCOUNT.siteId, timeZone: "America/New_York" }], held: null }),
}));
const firstDraft = vi.hoisted(() => ({ during: null as null | (() => Promise<void>) }));
vi.mock("@/lib/generate", () => ({
  generateDayPage: async () => {
    await firstDraft.during?.();
    return { ok: false, because: "no_opportunity" };
  },
}));
const notice = vi.hoisted(() => ({ next: null as null | { key: string; vars: Record<string, string>; parts: string[] } }));
vi.mock("@/lib/scan/deep/notice", () => ({ releaseNotice: async () => notice.next }));

const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { scanRun } = await import("@/jobs/scan-run");
const { readOnboarding, onboardingPanel } = await import("@/app/(account)/app/_shell/onboarding");
const { FirstPageNotice } = await import("@/app/(account)/app/_shell/OnboardingStatus");
const { OnboardingPanel } = await import("@/app/(account)/app/_shell/OnboardingPanel");
const { COPY } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("../account-door");
const { default: nextConfig } = await import("../../../next.config");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SITE = LIVE_ACCOUNT.siteId;

async function app(): Promise<Element> {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(await AppLayout({ children: null }));
  return container;
}

beforeEach(() => {
  db.reset();
  db.seed("sites", [
    {
      id: SITE,
      domain: LIVE_ACCOUNT.domain,
      setup_completed_at: new Date().toISOString(),
      setup_released_at: null,
      setup_released_reason: null,
      setup_stage: null,
      setup_stage_times: {},
    },
  ]);
  pass.status = "done";
  notice.next = null;
  firstDraft.during = null;
  nav.refresh.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  signedInAs(LIVE_ACCOUNT);
});

afterEach(() => {
  resetAccount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("issue #782 — the founder waits in the app, not on a waiting screen", () => {
  it("/setup/waiting is no screen any more: an old tab is sent straight into the app", async () => {
    expect(await nextConfig.redirects?.()).toContainEqual({
      source: "/setup/waiting",
      destination: "/app",
      permanent: false,
    });
  });

  it("while the pass runs, the side panel says which step, and Overview/Calendar say the first page is being written", async () => {
    db.rows("sites")[0]!.setup_stage = "reading_your_market";
    const tree = await app();
    const panels = tree.querySelectorAll('[data-testid="shell-onboarding"]');
    // Header and sidebar: one per breakpoint.
    expect(panels).toHaveLength(2);
    expect(panels[0]?.querySelector(".loading")).not.toBeNull();
    expect(panels[0]?.textContent).toContain(COPY["setup.waiting.stage.measuring-your-market"]);
    expect(panels[0]?.textContent).toContain(COPY["setup.waiting.head"]);

    const html = renderToStaticMarkup(<FirstPageNotice state={await readOnboarding()} />);
    expect(html).toContain(COPY["shell.onboarding.first-page"]);
  });

  it("the scan/run job writes the first draft before the release: the panel reads 'Writing your first page' until it ends, then clears", async () => {
    let during: Element | null = null;
    firstDraft.during = async () => {
      expect(db.rows("sites")[0]!.setup_released_at).toBeNull();
      during = await app();
    };

    const outcome = await scanRun.run({
      data: { scanId: `setup-${SITE}`, domain: LIVE_ACCOUNT.domain, tier: "deep", siteId: SITE },
      now: new Date(),
    });
    expect(outcome).toEqual({ outcome: "ran", subjectId: `setup-${SITE}` });

    expect(during).not.toBeNull();
    const panel = during!.querySelector('[data-testid="shell-onboarding"]');
    expect(panel?.getAttribute("data-stage")).toBe("writing_first_draft");
    expect(panel?.textContent).toContain(COPY["setup.waiting.stage.writing-your-first-page"]);

    // Released by the pass itself, after the first draft.
    expect(db.rows("sites")[0]!.setup_released_reason).toBe("completed");
    const after = await app();
    expect(after.querySelector('[data-testid="shell-onboarding"]')).toBeNull();
    expect(after.querySelector('[data-testid="shell-onboarding-notice"]')).toBeNull();
    expect(renderToStaticMarkup(<FirstPageNotice state={await readOnboarding()} />)).toBe("");
  });

  it("a pass that found too little market releases into the founder's reason, not a silent app", async () => {
    notice.next = { key: "setup.release.market-too-small", vars: {}, parts: [] };
    await scanRun.run({
      data: { scanId: `setup-${SITE}`, domain: LIVE_ACCOUNT.domain, tier: "deep", siteId: SITE },
      now: new Date(),
    });
    const tree = await app();
    expect(tree.querySelector('[data-testid="shell-onboarding"]')).toBeNull();
    expect(tree.querySelector('[data-testid="shell-onboarding-notice"]')?.textContent).toBe(
      COPY["setup.release.market-too-small"]
    );
  });
});

describe("onboardingPanel — one state from the pass and its notice", () => {
  const ended = { running: false, degraded: true } as const;
  const tooSmall = { key: "setup.release.market-too-small" } as const;

  it("a running pass is its stage, whatever else is true", () => {
    expect(
      onboardingPanel({ progress: { running: true, stage: "scoring", enteredAt: {} }, notice: tooSmall, weekZero: true })
    ).toEqual({ kind: "running", stage: "scoring" });
  });

  it("a failed or thin pass states its reason in week zero only", () => {
    expect(onboardingPanel({ progress: ended, notice: tooSmall, weekZero: true })).toEqual({
      kind: "notice",
      key: "setup.release.market-too-small",
    });
    expect(
      onboardingPanel({ progress: ended, notice: { key: "setup.release.incomplete" }, weekZero: true })
    ).toEqual({ kind: "notice", key: "setup.release.incomplete" });
    expect(onboardingPanel({ progress: ended, notice: tooSmall, weekZero: false })).toEqual({ kind: "none" });
  });

  it("a pass that measured short in places is the Overview's to mark, not the panel's", () => {
    expect(
      onboardingPanel({ progress: ended, notice: { key: "setup.release.unmeasured" }, weekZero: true })
    ).toEqual({ kind: "none" });
  });
});

describe("OnboardingPanel — polls the progress read and refreshes the app when the pass ends", () => {
  it("moves the label with the pass, then asks the router for a fresh render", async () => {
    vi.useFakeTimers();
    // jsdom lays nothing out, so every element reads as hidden; this copy is
    // the one on screen.
    vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body);
    const answers: unknown[] = [
      { running: true, stage: "asking_the_twelve", enteredAt: {} },
      { running: false, degraded: false },
    ];
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return { ok: true, json: async () => answers.shift() };
    });

    const labels = {
      measuring_your_market: "row-1",
      sizing_your_rivals: "row-2",
      finding_pages: "row-3",
      writing_your_first_page: "row-4",
      checking_it: "row-5",
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(<OnboardingPanel heading="head" stage="reading_your_site" labels={labels} />);
    });
    expect(container.textContent).toContain("row-1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(asked).toEqual(["/api/setup/progress"]);
    expect(container.textContent).toContain("row-2");
    expect(nav.refresh).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
