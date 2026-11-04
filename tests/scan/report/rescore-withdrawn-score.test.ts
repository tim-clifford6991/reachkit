// A free report whose market was withdrawn for having no words of the site's
// own carries no score counted over that market's searches: the 0¢ re-score
// leaves Presence unmeasured, so the score is not computed and never reads 0.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { rescoreStored } from "../../../src/lib/scan/rescore-run";
import type { StoredReport } from "../../../src/lib/scan/report";
import { apply, dry, fixture, IMPERVA, over, storeOf, type FixtureScan } from "./rescore-store";

const SHELL = '<html lang="en"><head><title>Gusto</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const AT = fixture("gusto.com").report.verdict as { measuredAt: string };
const wordless = (because = "home_wordless") => ({ kind: "unmeasured", reason: "undeterminable", at: AT.measuredAt, because });

/** gusto.com's stored row as another scan of it, so several share one store. */
const as = (id: string, s: FixtureScan): FixtureScan => ({ ...s, id });

/** gusto.com's stored row over a home of its own that says nothing, its market already withdrawn by an earlier pass. */
const WITHDRAWN = as("withdrawn", over("gusto.com", SHELL, { market: wordless(), freePage: null }));
/** The gymshark.com shape: its market withdrawn, and a pass that asked no search. */
const ASKED_NONE = as("asked-none", over("gusto.com", SHELL, {
  market: wordless(),
  freePage: null,
  serps: [],
  questions: { kind: "measured", value: [], at: AT.measuredAt },
  rivals: { kind: "measured", value: [], at: AT.measuredAt },
  presence: { you: { domain: "gusto.com", top10Count: 0 }, rivals: [], framing: "suppressed_no_rivals", absentFrom: [], measuredSearches: 0 },
  aiAnswers: null,
}));
/** A market withdrawn behind a protection, over a home read since that is the site's own. */
const PROTECTED = as("protected", over("gusto.com", SHELL, { market: wordless("bot_protection"), freePage: null }));
/** The same row with its market still standing on input: withdrawn in this pass. */
const THIS_PASS = as("this-pass", over("gusto.com", SHELL));

/** A stored free report from the panel's walks, as the re-score reads its row. */
function walkScan(walk: string, domain: string, report: Record<string, unknown> = {}): FixtureScan {
  const file = new URL(`../../../docs/walk/free/${walk}.json`, import.meta.url);
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: FixtureScan & { report: Record<string, unknown> } } | null }[] }).sites;
  const scan = sites.find((s) => s.domain === domain && s.stored !== null)!.stored!.scan;
  return { id: scan.id, createdAt: scan.createdAt, status: scan.status, score: scan.score, drivers: scan.drivers, report: { ...scan.report, ...report }, home: null, rendered: [] };
}
/** A market left unmeasured with no because: not withdrawn, so its score stands. */
const NOT_WITHDRAWN = { market: { kind: "unmeasured", reason: "not_attempted", at: AT.measuredAt } };

const CONTROLS: Record<string, FixtureScan> = {
  "sage.com (market read from search)": as("from-search", over("gusto.com", SHELL, { marketFrom: "search" })),
  "hiverhq.com (market unmeasured, no because)": { ...fixture("zapier.com"), report: { ...fixture("zapier.com").report, ...NOT_WITHDRAWN } },
  "trello.com (market unmeasured, no because)": walkScan("2026-10-15-1449-after", "trello.com", NOT_WITHDRAWN),
  "savvycal.com (panel, SaaS)": walkScan("2026-10-15-1449-after", "savvycal.com"),
  "austinplumbery.com (panel, local)": walkScan("2026-10-15", "austinplumbery.com"),
};

/** One apply over `scans`, with the network stubbed; what it wrote and what it summed up. */
async function applied(scans: readonly FixtureScan[], options = apply) {
  const fetched = vi.fn();
  vi.stubGlobal("fetch", fetched);
  try {
    const db = storeOf(scans);
    const answer = await rescoreStored(db.store, options);
    const report = (s: FixtureScan) => db.rows.get(s.id)!.report as unknown as StoredReport;
    const drivers = (s: FixtureScan) => db.rows.get(s.id)!.drivers as Record<string, unknown>;
    return { db, answer, report, drivers, fetched };
  } finally {
    vi.unstubAllGlobals();
  }
}

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;

describe("a free report whose market was withdrawn scores no Presence over it", () => {
  it.each([
    ["the gymshark.com shape: home_wordless, no search asked", ASKED_NONE, "home_wordless"],
    ["home_wordless over stored serps that hold measured searches", WITHDRAWN, "home_wordless"],
    ["bot_protection over a home read since that is the site's own", PROTECTED, "bot_protection"],
  ])("%s: no score, presence missing, the because kept, nothing bought", async (_, s, because) => {
    const { report, drivers, db, fetched } = await applied([s]);
    const verdict = report(s).verdict;
    expect(verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(verdict.missing.map((m) => m.factor)).toEqual(["presence"]);
    expect(verdict.estimate).toBeUndefined();
    expect(verdict.factors.presence).toMatchObject({ kind: "unmeasured", because });
    expect(drivers(s).searchPresence).toMatchObject({ kind: "unmeasured", reason: "undeterminable", because });
    expect(drivers(s).aiPresence).toMatchObject({ kind: "unmeasured", reason: "undeterminable", because });
    expect(report(s).market).toMatchObject({ kind: "unmeasured", because });
    expect(db.rows.get(s.id)!.score).toBeNull();
    // What the pass bought stays, and the previous report is kept beside it.
    for (const key of ["serps", "questions"] as const) expect(json(report(s)[key])).toEqual(json(s.report[key]));
    expect(report(s).presence).not.toBeNull();
    expect(json((report(s) as unknown as { previous: unknown }).previous)).toEqual(json(s.report));
    expect(db.written.every((w) => w.changes.every((c) => c.path[0] !== "serps" && c.path[0] !== "questions"))).toBe(true);
    expect(db.sitesWritten).toEqual([]);
    expect(db.namesWritten).toEqual([]);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("a market withdrawn in this pass gives the same verdict in one pass as one withdrawn before, and a second apply changes nothing", async () => {
    const once = await applied([THIS_PASS]);
    const before = await applied([WITHDRAWN]);
    expect(once.report(THIS_PASS).market).toMatchObject({ kind: "unmeasured", because: "home_wordless" });
    expect(once.report(THIS_PASS).verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(json(once.report(THIS_PASS).verdict)).toEqual(json(before.report(WITHDRAWN).verdict));
    expect(await rescoreStored(once.db.store, apply)).toMatchObject({ scansChanged: 0, scansWritten: 0 });
  });

  it("factors other than presence are deep-equal before and after", async () => {
    // The same row with its market standing is today's reading of the site's own pages.
    const standing = over("gusto.com", SHELL, { marketFrom: "search" });
    const kept = await applied([standing]);
    for (const s of [THIS_PASS, WITHDRAWN]) {
      const out = await applied([s]);
      for (const factor of ["foundations", "answerability"] as const) {
        expect(json(out.report(s).verdict.factors[factor])).toEqual(json(kept.report(standing).verdict.factors[factor]));
        expect(json(out.drivers(s)[factor])).toEqual(json(kept.drivers(standing)[factor]));
      }
    }
  });

  it("a home read that was a protection's page keeps the output it has: unscored by protection, presence as read", async () => {
    const s = over("gusto.com", IMPERVA);
    const { report } = await applied([s]);
    expect(report(s).verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(report(s).verdict.missing.map((m) => m.factor)).toEqual(["foundations", "answerability"]);
    expect(report(s).verdict.factors.presence.kind).not.toBe("unmeasured");
  });

  it("a market that stands, or was left unmeasured for no such because, keeps the verdict it has", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, s] of Object.entries(CONTROLS)) {
      const { db, report } = await applied([s]);
      expect(report(s).verdict.scoreAndBand.kind, name).not.toBe("unmeasured");
      out[name] = { score: db.rows.get(s.id)!.score, status: db.rows.get(s.id)!.status, verdict: report(s).verdict };
    }
    await expect(`${JSON.stringify(json(out), null, 2)}\n`).toMatchFileSnapshot("./fixtures/rescore/withdrawn-score-controls.golden.json");
  });

  it("the summary names each domain under its because", async () => {
    const { answer, db } = await applied([THIS_PASS, ASKED_NONE, PROTECTED, ...Object.values(CONTROLS)], dry);
    expect(answer.summary).toContain("- Score withdrawn (market not measured: home_wordless): 2 — gusto.com");
    expect(answer.summary).toContain("- Score withdrawn (market not measured: bot_protection): 1 — gusto.com");
    const none = await applied(Object.values(CONTROLS), dry);
    expect(none.answer.summary).toContain("- Score withdrawn (market not measured: home_wordless): 0 — none");
    expect(db.written).toEqual([]);
  });
});
