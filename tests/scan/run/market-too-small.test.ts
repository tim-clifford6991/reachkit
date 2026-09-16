// tests/scan/run/market-too-small.test.ts — issue #770 (cold-start RCA #764).
//
// A pass that reads the market and finds too little of it to phrase a
// question from is recorded as that — not degraded by the presence it
// could not buy — the founder's release notice names it, and the owner's
// incident mail is composed. Every vendor is doubled, and so is the mail
// transport: nothing is bought and nothing is sent.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, ON_PAGE, PROFILE, ROBOTS } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const measureDomain = vi.fn();
vi.mock("@/lib/measure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/measure")>()),
  measureDomain: (...args: unknown[]) => measureDomain(...args),
}));

const deriveProfile = vi.fn();
vi.mock("@/lib/market/questions/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/profile")>()),
  deriveProfile: (...a: unknown[]) => deriveProfile(...a),
}));

const deriveMarketSet = vi.fn();
vi.mock("@/lib/market/questions/market-set", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/market-set")>()),
  deriveMarketSet: (...a: unknown[]) => deriveMarketSet(...a),
}));

const serpOrganic = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
}));

const storeCurrentReport = vi.fn();
vi.mock("@/lib/scan/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/store")>()),
  storeCurrentReport: (...a: unknown[]) => storeCurrentReport(...a),
}));

let current: StoredReport | null = null;
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/report")>()),
  readCurrentReport: async () => current,
}));

vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: async () => null,
  advanceCorrectionState: async () => true,
  registerCorrectionRunner: () => undefined,
  correctionRunner: () => null,
}));

const mails: { kind: string; blocks: readonly { block: string; text?: string; items?: unknown }[] }[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: (typeof mails)[number]) => {
    mails.push(m);
    return { sent: true, id: "doubled" };
  },
}));

const { runScan } = await import("../../../src/lib/scan/run");
const { statusOf } = await import("../../../src/lib/scan/store");
const { releaseNotice } = await import("../../../src/lib/scan/deep/notice");

const DOMAIN = "example.com";
const CLAIMED_ID = "44444444-4444-4444-8444-444444444444";

const MEASUREMENT: DomainMeasurement = {
  drivers: {
    foundations: measured(52, AT),
    answerability: measured(38, AT),
    searchPresence: measuredZero(0, AT),
    aiPresence: unmeasured("not_attempted", AT),
  },
  text: { home: "Onboarding for product teams.", pricing: null },
  onPage: measured(ON_PAGE, AT),
  pricing: null,
  robots: measured(ROBOTS, AT),
  ownRanked: measuredZero(0, AT),
  ownRankedRows: [],
  homeRefusal: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  mails.length = 0;
  current = null;
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  // The sub-floor market: the vendor answered, with nothing.
  deriveMarketSet.mockResolvedValue(measuredZero([], AT));
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport; degraded: boolean }) => {
    current = a.report;
    return { scanId: a.report.scanId, status: statusOf({ stoppedReason: a.report.stoppedReason, degraded: a.degraded }) };
  });
});

describe("#770 — a pass that finds too little market says so", () => {
  it("a deep pass is stored as too small (not degraded), the founder is told, and the owner's mail is composed", async () => {
    const result = await runScan({ domain: DOMAIN, tier: "deep", siteId: "site-1" });

    const stored = storeCurrentReport.mock.calls[0]![0] as { report: StoredReport; degraded: boolean };
    expect(stored.report.questions.kind).toBe("zero");
    expect(stored.degraded).toBe(false);
    expect(result.status).toBe("done");
    expect(serpOrganic).not.toHaveBeenCalled();

    expect(await releaseNotice({ domain: DOMAIN })).toEqual({
      key: "setup.release.market-too-small",
      vars: {},
      parts: [],
    });

    expect(mails).toHaveLength(1);
    expect(mails[0]!.kind).toBe("ops");
    expect(mails[0]!.blocks).toContainEqual({ block: "paragraph", text: "mail.ops.incident.market-too-small" });
    expect(mails[0]!.blocks).toContainEqual({
      block: "facts",
      items: [
        { label: "mail.ops.incident.fact.scan", value: CLAIMED_ID },
        { label: "mail.ops.incident.fact.tier", value: "deep" },
      ],
    });
  });

  it("a free pass with no site mails nobody", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(mails).toHaveLength(0);
  });
});
