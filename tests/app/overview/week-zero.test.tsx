// tests/app/overview/week-zero.test.tsx — SPEC §4, issue #793: the deep pass
// is week 0.
//
// The Overview read weekly scans only, so a paying customer saw dashes for
// the score, the AI answers and the rival lines until the first Monday,
// although the deep pass had measured all three. Every case below is a
// database state — a `deep` scan and the `weekly` scans after it — driven
// through the real provider, store and model, and the last two render the
// tiles and the rival card the page renders from that model.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { REPORT_VERSION } from "@/lib/scan/report";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  // issue 784: read only where the depth is zero; these week-0 sites hold measured supply.
  supplyMeasured: async () => true,
  readWeek: async () => [],
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { readOverview } = await import("@/app/(account)/app/_overview/provider");
const { TileRow } = await import("@/app/(account)/app/_overview/TileRow");
const { RivalModule } = await import("@/app/(account)/app/_overview/RivalModule");
const { copy } = await import("@/lib/presentation/copy");
const { formatDate } = await import("@/app/(account)/app/_shell/format");

const ZONE = "UTC";
const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
const SITE_ID = ACCOUNT.siteId;

/** Wednesday of the week of Monday 7 September 2026. */
const NOW = new Date(Date.UTC(2026, 8, 9, 10, 0, 0));
/** The deep pass ran the Wednesday before — the week of 31 August. */
const DEEP_AT = "2026-09-02T15:00:00.000Z";

function report(a: {
  at: string;
  score: number;
  ownRanked: number;
  citations: number;
  rival: number;
}): Row {
  return {
    version: REPORT_VERSION,
    verdict: {
      measuredAt: a.at,
      scoreAndBand: { kind: "measured", value: { score: a.score, band: "hard-to-find" }, at: a.at },
    },
    ownRanked: { kind: "measured", value: a.ownRanked, at: a.at },
    aiAnswers: { customerCitations: a.citations },
    rivalSizes: {
      kind: "measured",
      value: [
        { domain: "rival.io", state: "sized", rankedCount: a.rival, band: "near", at: a.at, current: true },
      ],
      at: a.at,
    },
    siteIssues: [],
  };
}

function scan(tier: "deep" | "weekly", at: string, r: Row, weekStart: string | null = null): Row {
  return {
    id: `scan-${tier}-${at}`,
    site_id: SITE_ID,
    domain: ACCOUNT.domain,
    tier,
    status: "done",
    week_start: weekStart,
    created_at: at,
    report: r,
  };
}

const DEEP = scan("deep", DEEP_AT, report({ at: DEEP_AT, score: 31, ownRanked: 4, citations: 1, rival: 90 }));
const MONDAY = "2026-09-07T09:00:00.000Z";
const FIRST_WEEKLY = scan(
  "weekly",
  MONDAY,
  report({ at: MONDAY, score: 38, ownRanked: 6, citations: 0, rival: 80 }),
  "2026-09-07"
);

beforeEach(() => {
  db.reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("sites", [
    { id: SITE_ID, user_id: ACCOUNT.userId, domain: ACCOUNT.domain, timezone: ZONE, competitors: ["rival.io"] },
  ]);
  db.seed("publications", []);
  db.seed("drafts", []);
  db.seed("scans", []);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

describe("before the first Monday, the deep pass is the starting measurement", () => {
  it("the score, the AI answers and the rival lines are the deep pass's", async () => {
    db.seed("scans", [DEEP]);
    const model = await readOverview();

    expect(model.weekZero?.startingOn).toEqual(new Date(DEEP_AT));
    expect(model.score.headline.value).toMatchObject({ kind: "measured", value: 31 });
    expect(model.score.band).toBe("hard-to-find");
    // Nothing to compare against yet: the tile carries its goal.
    expect(model.score.headline.delta).toBeUndefined();

    expect(model.aiAnswers.headline.value).toMatchObject({ kind: "measured", value: 1 });
    expect(model.aiAnswers.window.weeks.at(-1)).toEqual({
      weekStart: new Date("2026-08-31T12:00:00.000Z"),
      present: true,
    });

    expect(model.rivals.kind).toBe("absolute");
    if (model.rivals.kind !== "absolute") throw new Error("expected the cold-start arm");
    expect(model.rivals.own).toMatchObject({ kind: "measured", value: 4 });
    expect(model.rivals.rivals[0]?.ranked).toMatchObject({ kind: "measured", value: 90 });
    expect(model.rivals.rivals[0]?.series).toEqual([90]);
  });

  it("the tiles show the numbers named as the starting measurement, not a first-due dash", async () => {
    db.seed("scans", [DEEP]);
    const model = await readOverview();
    const markup = renderToStaticMarkup(
      <TileRow
        score={model.score}
        aiAnswers={model.aiAnswers}
        pagesPublished={model.pagesPublished}
        timeZone={ZONE}
        weekZero={model.weekZero}
      />
    );
    const starting = copy("overview.tile.starting", {
      on: formatDate(new Date(DEEP_AT), ZONE),
      due: formatDate(model.weekZero!.firstDueOn, ZONE),
    });
    expect(markup).toContain(">31<");
    expect(markup).toContain(">1/12<");
    expect(markup.split(starting).length - 1).toBe(2);
    expect(markup).not.toContain("TODO(copy)");
  });

  it("the rival card draws the deep pass's rows and says where they came from", async () => {
    db.seed("scans", [DEEP]);
    const model = await readOverview();
    const markup = renderToStaticMarkup(
      <RivalModule rivals={model.rivals} timeZone={ZONE} weekZero={model.weekZero} />
    );
    expect(markup).toContain("rival.io");
    expect(markup).toContain(
      copy("overview.rivals.line.starting", {
        on: formatDate(new Date(DEEP_AT), ZONE),
        due: formatDate(model.weekZero!.firstDueOn, ZONE),
      })
    );
    expect(markup).not.toContain(
      copy("overview.rivals.line.week-zero", { due: formatDate(model.weekZero!.firstDueOn, ZONE) })
    );
    expect(markup).not.toContain("TODO(copy)");
  });
});

describe("from the first Monday, the weekly scans take over and compare against week 0", () => {
  it("the score's delta is taken against the deep pass, and the rival lines start from it", async () => {
    db.seed("scans", [DEEP, FIRST_WEEKLY]);
    const model = await readOverview();

    expect(model.weekZero).toBeNull();
    expect(model.score.headline.value).toMatchObject({ value: 38 });
    expect(model.score.headline.delta).toMatchObject({ kind: "measured", value: 7 });

    // Week 0's cell, then Monday's: named once in two measured weeks.
    expect(model.aiAnswers.window.weeks.slice(-2).map((w) => w.present)).toEqual([true, false]);
    expect(model.aiAnswers.headline.value).toMatchObject({ value: 1 });
    expect(model.aiAnswers.headline.delta).toBeUndefined();

    if (model.rivals.kind !== "absolute") throw new Error("expected the cold-start arm");
    expect(model.rivals.own).toMatchObject({ value: 6 });
    expect(model.rivals.rivals[0]?.series).toEqual([90, 80]);
  });

  it("a deep pass run after the weeklies began is not week 0", async () => {
    const late = "2026-09-08T15:00:00.000Z";
    db.seed("scans", [
      FIRST_WEEKLY,
      scan("deep", late, report({ at: late, score: 20, ownRanked: 2, citations: 1, rival: 70 })),
    ]);
    const model = await readOverview();

    expect(model.score.headline.value).toMatchObject({ value: 38 });
    expect(model.score.headline.delta).toBeUndefined();
    expect(model.aiAnswers.window.weeks.filter((w) => w.present !== null)).toHaveLength(1);
    expect(model.rivals.rivals[0]?.series).toEqual([80]);
  });
});
