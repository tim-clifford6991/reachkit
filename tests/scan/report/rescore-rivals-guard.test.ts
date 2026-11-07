// A re-score that would leave a report with many measured rivals with none is
// a move nobody expected: the guard holds it before any write, and names it.
import "../../opportunities/env";
import { describe, expect, it } from "vitest";
import { RESCORE_GUARD } from "../../../src/lib/config/constants";
import { heldBecause, type ScoreMove } from "../../../src/lib/scan/derivation";
import { rescoreStored } from "../../../src/lib/scan/rescore-run";
import { apply, fixture, read, storeOf } from "./rescore-store";

const from = RESCORE_GUARD.rivalsLostFrom;
const move = (domain: string, rivalsBefore: number | null, rivalsAfter: number | null): ScoreMove => ({ domain, before: 40, after: 40, rivalsBefore, rivalsAfter });
const guard = (moves: ScoreMove[]) => heldBecause({ moves, unreadable: 0, unreadableBefore: 0, afterApply: false, changed: 0 });

describe("heldBecause holds a report that loses all its measured rivals", () => {
  it(`${from + 2} → 0 is held and named; ${from} → 1, ${from - 1} → 0 and a move to or from unmeasured are not`, () => {
    expect(guard([move("bakersdelight.com.au", from + 2, 0)])).toBe(`bakersdelight.com.au loses all its rivals (${from + 2} → 0)`);
    expect(guard([move("a.com", from, 1), move("b.com", from - 1, 0), move("c.com", from + 2, null), move("d.com", null, 0)])).toBeNull();
  });

  it("several such reports are one segment, after the existing reasons", () => {
    const moves = [move("a.com", from, 0), { ...move("b.com", from + 4, 0), before: 40, after: null }];
    expect(guard(moves)).toBe(`b.com loses its score (40 → none); 2 reports lose all their rivals: a.com (${from} → 0), b.com (${from + 4} → 0)`);
  });
});

describe("a guarded apply whose re-read leaves a stored report with none of its 5 rivals writes nothing", () => {
  // The stored "baker" rows that resolve, under an overview citing only a career guide, which this build drops as a rival.
  const organic = (read("../../market/rivals/fixtures/au-baker-d149c119.json") as { organic: { domain: string }[] }).organic.filter((row) => row.domain !== "google.com");
  const scan = fixture("gusto.com");
  const report = scan.report as Record<string, { at: string; value?: unknown }> & { serps: { at: string }[] };
  const at = report.serps[0]!.at;
  const rivals = ["bakingcareer.com.au", "brumbys.com.au", "banjos.com.au", "breadtop.com.au", "muffinbreak.com.au"];
  const searches = ["baker near me", "baker"];
  const stored = {
    ...structuredClone(scan.report),
    domain: "bakersdelight.com.au",
    market: { ...report.market, value: { profile: { category: "bread and bakery", town: "Adelaide" } } },
    questions: { kind: "measured", at: report.questions!.at, value: searches.map((keyword, i) => ({ id: `q${i + 1}`, text: `Who is a ${keyword}?`, search: { keyword, volume: 40 }, phrasing: "model" })) },
    serps: searches.map(() => ({ kind: "measured", at, value: { organic, aiOverview: { present: true, referenceDomains: ["bakingcareer.com.au"], referenceUrls: ["https://bakingcareer.com.au/what-does-a-baker-do/"] } } })),
    rivals: { kind: "measured", at: report.rivals!.at, value: rivals.map((domain) => ({ domain, top10Appearances: 1, aiCitations: 1, score: 3 })) },
  };

  it("held names the rule and the scan, the summary carries it, and the stored report is unchanged", async () => {
    const db = storeOf([{ ...scan, report: stored, home: null, rendered: [] }]);
    const answer = await rescoreStored(db.store, { ...apply, guard: { unreadableBefore: null } });
    expect(answer.scoreMoves).toContainEqual(expect.objectContaining({ domain: "bakersdelight.com.au", rivalsBefore: 5, rivalsAfter: 0 }));
    expect(answer.held).toContain("bakersdelight.com.au loses all its rivals (5 → 0)");
    expect(answer.summary).toContain(`**Held:** ${answer.held}.`);
    expect([answer.scansWritten, db.written.length, db.sitesWritten.length]).toEqual([0, 0, 0]);
    expect(db.rows.get(scan.id)!.report).toEqual(stored);
  });
});
