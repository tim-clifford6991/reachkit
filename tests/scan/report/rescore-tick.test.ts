// Issue 1481 — the `scan/rescore` tick follows every scoring deploy by
// itself: one guarded apply per derivation, through the store that stands in
// for the database.
import { describe, expect, it } from "vitest";
import { answerRequest, claimRequest, rescoreStored, type RescoreQueue, type RescoreStore } from "../../../src/lib/scan/rescore-run";
import { heldBecause, type RunRecord } from "../../../src/lib/scan/derivation";
import { apply, at, dry, fixture, storeOf, type FixtureScan } from "./rescore-store";

describe("issue 1481: a deploy that changes how a scan is read is followed by one guarded apply, with nobody asking", () => {
  const DERIVATION = "f026342a5919";

  /** `rescore_runs` as the tick reads and writes it, over the store above. */
  function queueOf(db: ReturnType<typeof storeOf>) {
    const runs: (RunRecord & { id: string; started: boolean; auto: boolean; stale: readonly string[] | null; scansChanged: number | null })[] = [];
    let asked = 0;
    /** A request: the tick's own, or one a person inserted. */
    function insert(mode: RunRecord["mode"], when: Date, auto: boolean) {
      asked += 1;
      runs.push({ id: `run-${asked}`, mode, auto, started: false, derivation: null, requestedAt: new Date(when.getTime() + asked).toISOString(), finishedAt: null, error: null, held: null, scansChanged: null, unreadable: null, stale: null });
    }
    const queue: RescoreQueue & RescoreStore = {
      ...db.store,
      async claim() {
        const next = runs.find((r) => !r.started);
        if (next === undefined) return null;
        next.started = true;
        return { id: next.id, mode: next.mode, auto: next.auto };
      },
      runs: async () => runs.map((r) => ({ ...r })),
      ask: async (mode, when) => insert(mode, when, true),
      async answer(id, a, o) {
        Object.assign(runs.find((r) => r.id === id)!, {
          finishedAt: o.at.toISOString(),
          derivation: o.derivation ?? null,
          held: a.held,
          scansChanged: a.scansChanged,
          unreadable: a.scansUnreadable,
          stale: a.stale,
        });
      },
      async failed(id, error, o) {
        Object.assign(runs.find((r) => r.id === id)!, { finishedAt: o.at.toISOString(), error, derivation: o.derivation ?? null });
      },
    };
    /** One tick of `scan/rescore` in production at the deployed derivation. */
    async function tick(derivation = DERIVATION) {
      const request = await claimRequest(at, derivation, queue, true);
      if (request !== null && "id" in request) await answerRequest(request, { version: "abc1234", derivation, at }, queue);
      return request;
    }
    return { queue, runs, tick, insert: (mode: RunRecord["mode"]) => insert(mode, at, false) };
  }

  /** zapier.com's stored scan with a stored score of 40: read again it is 47,
   *  a move the guard expects. */
  const near = ((): FixtureScan => {
    const s = fixture("zapier.com");
    const report = structuredClone(s.report) as Record<string, unknown> & { verdict: { scoreAndBand: { value: { score: number } } } };
    report.verdict.scoreAndBand.value.score = 40;
    return { ...s, score: 40, report };
  })();

  it("asks one apply, guarded in memory, and nothing after it: one run per derivation", async () => {
    const db = storeOf([near]);
    const { runs, tick } = queueOf(db);

    await tick();
    expect(runs.map((r) => [r.mode, r.auto, r.derivation, r.held, r.scansChanged, r.stale])).toEqual([["apply", true, DERIVATION, null, 1, []]]);
    expect(db.written[0]).toMatchObject({ id: near.id, score: 47, by: "abc1234" });
    expect((db.rows.get(near.id)!.report as { rescoredBy?: string }).rescoredBy).toBe("abc1234");

    // Settled: the next tick at the same derivation asks nothing.
    await expect(tick()).resolves.toBeNull();
    expect(runs).toHaveLength(1);
  });

  it("a deploy that does not change the derivation asks nothing again; one that does starts over", async () => {
    const db = storeOf([near]);
    const { runs, tick } = queueOf(db);
    for (let i = 0; i < 4; i += 1) await tick();
    expect(runs).toHaveLength(1);
    await tick("0a1b2c3d4e5f");
    expect(runs.at(-1)).toMatchObject({ mode: "apply", derivation: "0a1b2c3d4e5f", scansChanged: 0 });
    await expect(tick("0a1b2c3d4e5f")).resolves.toBeNull();
    expect(runs).toHaveLength(2);
  });

  it("holds the apply before any write where a score moves further than the guard allows, or loses its number, and says why on every tick", async () => {
    const db = storeOf([fixture("gusto.com"), fixture("zapier.com")]);
    const { runs, tick } = queueOf(db);
    await tick();
    expect(runs[0]).toMatchObject({ mode: "apply", held: "zapier.com moves 20 points (27 → 47), more than 15; gusto.com loses its score (0 → none)" });
    expect(runs[0]!.stale).toEqual([fixture("zapier.com").id, fixture("gusto.com").id]);
    await expect(tick()).resolves.toEqual({ held: runs[0]!.held });
    await expect(tick()).resolves.toEqual({ held: runs[0]!.held });
    expect(runs).toHaveLength(1);
    expect(db.written).toEqual([]);
  });

  it("a person's dry run writes nothing, and a person's apply moves a held run on", async () => {
    const db = storeOf([fixture("gusto.com"), fixture("zapier.com")]);
    const { insert, runs, tick } = queueOf(db);
    await tick();
    insert("dry");
    await tick();
    expect(runs[1]).toMatchObject({ mode: "dry", auto: false, held: runs[0]!.held, scansChanged: 2 });
    expect(db.written).toEqual([]);
    insert("apply");
    await tick();
    expect(runs[2]).toMatchObject({ mode: "apply", auto: false, held: null, stale: [] });
    expect(db.written.map((w) => w.id).sort()).toEqual([fixture("gusto.com").id, fixture("zapier.com").id].sort());
    await expect(tick()).resolves.toBeNull();
  });

  it("holds where the build cannot read a stored scan the run before could", async () => {
    const db = storeOf([near]);
    const { queue, runs, tick } = queueOf(db);
    const unreadable: RescoreQueue & RescoreStore = {
      ...queue,
      scans: async () => [...(await queue.scans()), { ...(await queue.scans())[0]!, id: "00000000-0000-0000-0000-000000000001", report: "not a report" }],
    };
    for (let i = 0; i < 2; i += 1) await tick("0a1b2c3d4e5f");
    expect(runs.at(-1)).toMatchObject({ unreadable: 0, held: null });
    const writes = db.written.length;
    const request = await claimRequest(at, DERIVATION, unreadable, true);
    if (request === null || !("id" in request)) throw new Error("no request");
    await answerRequest(request, { version: "abc1234", derivation: DERIVATION, at }, unreadable);
    expect(runs.at(-1)!.held).toBe("1 stored scans this build cannot read, 0 before");
    await expect(claimRequest(at, DERIVATION, unreadable, true)).resolves.toEqual({ held: runs.at(-1)!.held });
    expect(db.written).toHaveLength(writes);
  });

  it("a scan the apply could not write that still moves is the apply lagging: held, and it stays stale", async () => {
    const db = storeOf([near]);
    const lagging: RescoreStore = { ...db.store, writeScan: async () => false };
    const { queue, runs } = queueOf(db);
    const q = { ...queue, writeScan: lagging.writeScan };
    const request = await claimRequest(at, DERIVATION, q, true);
    if (request !== null && "id" in request) await answerRequest(request, { version: "abc1234", derivation: DERIVATION, at }, q);
    expect(runs.map((r) => r.mode)).toEqual(["apply"]);
    expect(runs[0]).toMatchObject({ stale: [near.id], held: "after the apply, 1 scan still reads differently from the deployed code" });
    await expect(claimRequest(at, DERIVATION, q, true)).resolves.toEqual({ held: runs[0]!.held });
  });

  describe("one guarded run leaves the rows, stale scans and held reason the dry run, apply and check left", () => {
    /** The three runs a derivation was answered with before: a guarded dry
     *  run, the apply where it passed, and a dry run that checked it. */
    async function threeRuns(store: RescoreStore) {
      const first = await rescoreStored(store, { ...dry, guard: { unreadableBefore: null } });
      if (first.held !== null || (first.scansChanged === 0 && first.sitesMoved === 0)) return { held: first.held, stale: first.stale };
      const applied = await rescoreStored(store, apply);
      const check = await rescoreStored(store, dry);
      const held = heldBecause({ moves: check.scoreMoves, unreadable: check.scansUnreadable, unreadableBefore: applied.scansUnreadable, afterApply: true, changed: check.scansChanged });
      return { held, stale: check.stale };
    }

    /** The store with its first scan write met by another writer since the
     *  read: an older build's, which still reads differently, or the deployed
     *  code's own, which does not. */
    function writtenBetween(db: ReturnType<typeof storeOf>, by: "older" | "deployed" | null) {
      let first = true;
      const writeScan: RescoreStore["writeScan"] = async (w) => {
        if (by === null || !first) return db.store.writeScan(w);
        first = false;
        if (by === "deployed") await db.store.writeScan(w);
        else db.rows.set(w.id, { ...db.rows.get(w.id)!, md5: "written since it was read" });
        return false;
      };
      return { ...db, store: { ...db.store, writeScan } };
    }

    const cases: [string, () => FixtureScan[], "older" | "deployed" | null][] = [
      ["a derivation the guard passes", () => [near], null],
      ["a derivation the guard holds (more than 15 points)", () => [fixture("gusto.com"), fixture("zapier.com")], null],
      ["a scan an older build wrote between the read and the write", () => [near], "older"],
      ["a scan the deployed code wrote between the read and the write", () => [near], "deployed"],
    ];
    for (const [name, scans, by] of cases) {
      it(name, async () => {
        const before = writtenBetween(storeOf(scans()), by);
        const old = await threeRuns(before.store);
        const now = writtenBetween(storeOf(scans()), by);
        const { runs, tick } = queueOf(now);
        await tick();
        expect(runs).toHaveLength(1);
        expect({ held: runs[0]!.held, stale: runs[0]!.stale }).toEqual(old);
        expect([...now.rows.values()]).toEqual([...before.rows.values()]);
        await expect(tick()).resolves.toEqual(old.held === null ? null : { held: old.held });
      });
    }
  });

  it("a request the master session inserted is answered first, and outside production nothing is asked", async () => {
    const db = storeOf([near]);
    const { queue, runs } = queueOf(db);
    await expect(claimRequest(at, DERIVATION, queue, false)).resolves.toBeNull();
    await expect(claimRequest(at, null, queue, true)).resolves.toBeNull();
    expect(runs).toEqual([]);
  });
});
