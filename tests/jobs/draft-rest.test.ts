// tests/jobs/draft-rest.test.ts — issue #788, through the job that runs it.
//
// A draft the hard rules stop has to end somewhere the customer can act on,
// and the customer's Regenerate has to be carried out. Both are driven here
// through the real `draft/generate` tick, the real engine seam, the real
// generation engine and its Postgres store, the real state machine, and the
// real Regenerate server action — against the storing PostgREST double the
// publishing suites share.
//
// Doubled at the last line of our own code: the model (`llm`), the measured
// text the grounding reads, the cost ledger's context, the daily site list,
// the breakage and draft-ready mails, and the signed-in account.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";

const db: FakeDb = fakeDb();

/** The column defaults `drafts` declares, which a storing double cannot
 *  know: a real insert reads them back, so the double's must too. */
const client = {
  from(table: string) {
    const builder = (db.client as { from(t: string): { insert(values: Row): unknown } }).from(table);
    if (table !== "drafts") return builder;
    const insert = builder.insert.bind(builder);
    builder.insert = (values: Row) =>
      insert({ hard_rule_attempts: 0, transitions: [], hard_rules_passed: false, veto_deadline: null, ...values });
    return builder;
  },
  rpc: (fn: string, args: Row) => (db.client as { rpc(f: string, a: Row): unknown }).rpc(fn, args),
};
vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));

const { llmMock, readMeasuredTextMock, sitesForDailyTickMock, draftReadyMock, nextForDayMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  sitesForDailyTickMock: vi.fn(),
  draftReadyMock: vi.fn(),
  nextForDayMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/costs", () => ({
  withCostContext: async (_ctx: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({ capHit: () => false, spentCents: () => 0, degraded: () => false }),
}));
vi.mock("@/lib/publish/daily", () => ({ sitesForDailyTick: sitesForDailyTickMock }));
vi.mock("@/lib/publish/destinations/health", () => ({ sendBreakageMail: async () => ({ sent: false }) }));
vi.mock("@/lib/mail/draft-ready", () => ({ sendDraftReadyMail: draftReadyMock }));
// §7's ranking and readiness are tested where they live; the day's pick is
// the one opportunity this site holds. Its status writes are the real ones.
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  nextForDay: nextForDayMock,
  assessFixPages: async () => ({ done: 0, ready: 0 }),
  assessReadiness: async () => ({ ready: 1, unready: 0 }),
}));
vi.mock("@/app/(account)/app/_session/account", () => ({
  requireAppAccount: async () => ({ userId: USER_ID, siteId: fixtures.SITE_ID }),
}));
vi.mock("@/app/(account)/app/_session/store", () => ({ siteOwnsDraft: async () => true }));

const fixtures = await import("../generate/fixtures");
const opportunityDoubles = await import("../opportunities/memory-store");
const { draftGenerate } = await import("../../src/jobs/draft-generate");
const { regenerateDraft, skipDraft } = await import("../../src/app/(account)/app/calendar/publishing-actions");
const actualOpportunities = await vi.importActual<typeof import("../../src/lib/opportunities")>("@/lib/opportunities");
const { setOpportunityStore, opportunityById } = await import("../../src/lib/opportunities");

const USER_ID = "44444444-4444-4444-8444-444444444444";
/** 18:00 UTC is the site's evening: the tick drafts for 2026-09-08. */
const EVENING = new Date("2026-09-07T18:00:00.000Z");
/** The next morning — no site's evening, so only a restart is work. */
const MORNING = new Date("2026-09-08T09:00:00.000Z");

const STOPPED = "Example wins everything, and always has.";

function measured(value: unknown) {
  return { kind: "measured", value, at: fixtures.AT };
}

/** One pass of the four model steps, writing `markdown`. */
function modelWrites(markdown: string): void {
  llmMock.mockResolvedValueOnce(
    measured({ readerQuestion: "Which tool?", angle: "count seats", mustCover: ["seats"], factIndexes: [0] })
  );
  llmMock.mockResolvedValueOnce(
    measured({ headings: ["Which tool should a small team pick?", "What decides it", "What the plan includes"] })
  );
  llmMock.mockResolvedValueOnce(
    measured({ title: "A title", slug: "a-title", description: "A description.", bodyMarkdown: markdown })
  );
  llmMock.mockResolvedValueOnce(measured({ title: "", description: "", order: [0], firstBlock: "", insertFacts: [] }));
}

let opportunities: ReturnType<typeof opportunityDoubles.newMemoryState>;
let opportunityId: string;

beforeEach(async () => {
  db.reset();
  installTransitionRpc(db);
  llmMock.mockReset();
  draftReadyMock.mockReset();
  draftReadyMock.mockResolvedValue({ sent: true });
  readMeasuredTextMock.mockResolvedValue([
    { url: fixtures.GROUNDED.url, text: fixtures.SOURCE_TEXT, measuredAt: fixtures.GROUNDED.readAt },
  ]);
  sitesForDailyTickMock.mockResolvedValue({ sites: [{ siteId: fixtures.SITE_ID, timeZone: "UTC" }], held: null });

  db.seed("sites", [
    {
      id: fixtures.SITE_ID,
      domain: "example.com",
      category: "project management software",
      voice_text: null,
      do_not_claim: [],
      competitors: [],
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00",
      timezone: "UTC",
    },
  ]);
  db.seed("scans", [
    { id: fixtures.SCAN_ID, site_id: fixtures.SITE_ID, report: fixtures.report(), created_at: fixtures.AT.toISOString() },
  ]);
  db.seed("destinations", [{ id: "dest-1", site_id: fixtures.SITE_ID, kind: "hosted", deleted_at: null }]);

  opportunities = opportunityDoubles.newMemoryState();
  const store = opportunityDoubles.memoryStore(opportunities);
  setOpportunityStore(store);
  const seed = fixtures.opportunity();
  const inserted = await store.insert({
    site_id: fixtures.SITE_ID,
    scan_id: fixtures.SCAN_ID,
    type: seed.type,
    family: seed.family,
    target_query: seed.targetQuery,
    target_ref: seed.targetRef,
    proposed_slug: seed.targetRef,
    title: seed.title,
    volume: 1900,
    evidence: seed.evidence as never,
    acceptance: seed.acceptance,
    fit_band: seed.fitBand,
    effort: seed.effort,
  });
  if (inserted.outcome !== "created") throw new Error("the fixture opportunity was refused");
  opportunityId = inserted.row.id;
  nextForDayMock.mockImplementation(async () => opportunityById(opportunityId));
});

function statusOf(id: string): string | undefined {
  return opportunities.rows.find((row) => row.id === id)?.status;
}

async function stoppedEvening() {
  modelWrites(STOPPED);
  modelWrites(`${STOPPED} Again.`);
  return draftGenerate.run({ data: {}, now: EVENING });
}

describe("#788 — a draft the rules stop twice ends in needs_attention, on one row", () => {
  it("the evening tick leaves one row for the date, resting with its rules, and the opportunity held queued", async () => {
    const outcome = await stoppedEvening();
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:rules" });

    const drafts = db.rows("drafts");
    expect(drafts).toHaveLength(1);
    const [draft] = drafts;
    expect(draft).toMatchObject({ scheduled_for: "2026-09-08", state: "needs_attention", hard_rule_attempts: 2 });
    expect(draft?.rule_failures).not.toEqual([]);
    const moves = draft?.transitions as { from: string; to: string; reason?: string }[];
    expect(moves.at(-1)).toMatchObject({ from: "generating", to: "needs_attention", reason: expect.stringMatching(/^rules:.+/) });
    expect(statusOf(opportunityId)).toBe("queued");
    expect(draftReadyMock).not.toHaveBeenCalled();
  });
});

describe("#788 — Regenerate is carried out by the draft tick", () => {
  it("the restart is picked up on the next tick, rewrites the date's row, and enters review", async () => {
    await stoppedEvening();
    const [draft] = db.rows("drafts");
    const draftId = String(draft?.id);

    expect(await regenerateDraft(draftId)).toBeNull();
    expect(draft?.state).toBe("generating");

    modelWrites(fixtures.CLEAN_MARKDOWN);
    const outcome = await draftGenerate.run({ data: {}, now: MORNING });
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });

    expect(db.rows("drafts")).toHaveLength(1);
    expect(draft).toMatchObject({
      id: draftId,
      scheduled_for: "2026-09-08",
      state: "in_review",
      body_md: fixtures.CLEAN_MARKDOWN,
      hard_rules_passed: true,
    });
    expect(statusOf(opportunityId)).toBe("queued");
    expect(draftReadyMock).toHaveBeenCalledWith(expect.objectContaining({ draftId }));

    // Taken once: the next tick finds nothing restarted and spends nothing.
    llmMock.mockClear();
    expect(await draftGenerate.run({ data: {}, now: new Date(MORNING.getTime() + 3_600_000) })).toEqual({
      outcome: "skipped",
      subjectId: null,
      reason: "not-due",
    });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("a regeneration the rules stop again goes back to needs_attention on the same row", async () => {
    await stoppedEvening();
    const [draft] = db.rows("drafts");
    await regenerateDraft(String(draft?.id));

    modelWrites(`${STOPPED} Once more.`);
    const outcome = await draftGenerate.run({ data: {}, now: MORNING });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:rules" });
    expect(db.rows("drafts")).toHaveLength(1);
    expect(draft?.state).toBe("needs_attention");
    expect(statusOf(opportunityId)).toBe("queued");
  });
});

describe("#813 — a draft whose claim check cannot run rests in needs_attention, not generating", () => {
  /** An entry the page does not state literally, so the check asks the model. */
  const LIST = ["ReachKit is the cheapest tool on the market"];

  function claimCheckUnavailable(): void {
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: fixtures.AT });
  }

  beforeEach(() => {
    const [site] = db.rows("sites");
    if (site !== undefined) site.do_not_claim = LIST;
  });

  async function uncheckedEvening() {
    modelWrites(fixtures.CLEAN_MARKDOWN);
    claimCheckUnavailable();
    modelWrites(fixtures.CLEAN_MARKDOWN);
    claimCheckUnavailable();
    return draftGenerate.run({ data: {}, now: EVENING });
  }

  it("the automatic second attempt runs first, then the date's one row rests and the opportunity stays queued", async () => {
    const outcome = await uncheckedEvening();
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:step_failed" });
    expect(llmMock).toHaveBeenCalledTimes(10);

    const drafts = db.rows("drafts");
    expect(drafts).toHaveLength(1);
    const [draft] = drafts;
    expect(draft).toMatchObject({ scheduled_for: "2026-09-08", state: "needs_attention", hard_rules_passed: false });
    const moves = draft?.transitions as { from: string; to: string; reason?: string }[];
    expect(moves.at(-1)).toMatchObject({ from: "generating", to: "needs_attention", reason: "step_failed:claim_check" });
    expect(statusOf(opportunityId)).toBe("queued");
    expect(draftReadyMock).not.toHaveBeenCalled();
  });

  it("Regenerate, then a tick with the model answering again, puts the same row in review", async () => {
    await uncheckedEvening();
    const [draft] = db.rows("drafts");
    const draftId = String(draft?.id);

    expect(await regenerateDraft(draftId)).toBeNull();
    modelWrites(fixtures.CLEAN_MARKDOWN);
    llmMock.mockResolvedValueOnce(measured({ matches: false, matchedIndex: null }));
    const outcome = await draftGenerate.run({ data: {}, now: MORNING });
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });

    expect(db.rows("drafts")).toHaveLength(1);
    expect(draft).toMatchObject({ id: draftId, scheduled_for: "2026-09-08", state: "in_review", hard_rules_passed: true });
    expect(statusOf(opportunityId)).toBe("queued");
    expect(draftReadyMock).toHaveBeenCalledWith(expect.objectContaining({ draftId }));
  });

  it("a Regenerate whose check still cannot run rests again, and the next tick spends nothing on it", async () => {
    await uncheckedEvening();
    const [draft] = db.rows("drafts");
    await regenerateDraft(String(draft?.id));

    modelWrites(fixtures.CLEAN_MARKDOWN);
    claimCheckUnavailable();
    await draftGenerate.run({ data: {}, now: MORNING });
    expect(db.rows("drafts")).toHaveLength(1);
    expect(draft?.state).toBe("needs_attention");
    expect(statusOf(opportunityId)).toBe("queued");

    llmMock.mockClear();
    await draftGenerate.run({ data: {}, now: new Date(MORNING.getTime() + 3_600_000) });
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("issue 833 — a stopped draft counts as queued: no second page for its target", () => {
  /** The evening after the first: the tick drafts for 2026-09-09. */
  const NEXT_EVENING = new Date("2026-09-08T18:00:00.000Z");
  /** And the one after that, for 2026-09-10. */
  const THIRD_EVENING = new Date("2026-09-09T18:00:00.000Z");

  beforeEach(() => {
    // The day is picked by the real ranking here, over the rows the store holds.
    const market = fixtures.report().market;
    if (market.kind !== "measured") throw new Error("the fixture report has no measured market");
    opportunities.profile = market.value.profile;
    nextForDayMock.mockImplementation(actualOpportunities.nextForDay);
    for (const row of opportunities.rows) row.ready = true;
  });

  it("the next evening does not pick the held target and states its empty day; after Skip it is picked again", async () => {
    await stoppedEvening();
    const [stopped] = db.rows("drafts");
    expect(stopped?.state).toBe("needs_attention");
    expect(statusOf(opportunityId)).toBe("queued");

    llmMock.mockClear();
    const empty = await draftGenerate.run({ data: {}, now: NEXT_EVENING });
    expect(empty).toEqual({ outcome: "degraded", subjectId: null, step: "generate:no_opportunity" });
    expect(llmMock).not.toHaveBeenCalled();
    expect(db.rows("drafts")).toHaveLength(1);

    expect(await skipDraft(String(stopped?.id))).toBeNull();
    expect(stopped?.state).toBe("skipped");
    expect(statusOf(opportunityId)).toBe("open");

    modelWrites(fixtures.CLEAN_MARKDOWN);
    expect(await draftGenerate.run({ data: {}, now: THIRD_EVENING })).toEqual({ outcome: "ran", subjectId: null });
    const written = db.rows("drafts").find((row) => row.id !== stopped?.id);
    expect(written).toMatchObject({ opportunity_id: opportunityId, scheduled_for: "2026-09-10", state: "in_review" });
    expect(statusOf(opportunityId)).toBe("queued");
  });

  it("Skip on a page resting after a failed publish still dismisses its target", async () => {
    await opportunityDoubles.memoryStore(opportunities).markQueued(opportunityId);
    db.seed("drafts", [
      {
        id: "draft-publish-failed",
        site_id: fixtures.SITE_ID,
        opportunity_id: opportunityId,
        state: "needs_attention",
        scheduled_for: "2026-09-08",
        transitions: [
          { from: "publishing", to: "failed", actor: { kind: "system", job: "publish/execute" }, at: fixtures.AT.toISOString() },
          { from: "failed", to: "needs_attention", actor: { kind: "system", job: "publish/execute" }, at: fixtures.AT.toISOString() },
        ],
      },
    ]);

    expect(await skipDraft("draft-publish-failed")).toBeNull();
    expect(statusOf(opportunityId)).toBe("dismissed");
  });

  it("the next evening fills from another target, and the near-duplicate check counts the stopped draft as queued", async () => {
    const seed = fixtures.opportunity();
    const other = await opportunityDoubles.memoryStore(opportunities).insert({
      site_id: fixtures.SITE_ID,
      scan_id: fixtures.SCAN_ID,
      type: seed.type,
      family: seed.family,
      target_query: "project management software for small teams",
      target_ref: "project-management-software-for-small-teams",
      proposed_slug: "project-management-software-for-small-teams",
      title: "Which project management software suits a small team?",
      volume: 320,
      evidence: { ...seed.evidence, query: "project management software for small teams" } as never,
      acceptance: { form: "top20", query: "project management software for small teams" },
      fit_band: seed.fitBand,
      effort: seed.effort,
    });
    if (other.outcome !== "created") throw new Error("the second opportunity was refused");
    for (const row of opportunities.rows) row.ready = true;

    // The evening's page is stopped when its claim check cannot run, so it
    // rests holding a whole, clean body.
    const [site] = db.rows("sites");
    if (site !== undefined) site.do_not_claim = ["ReachKit is the cheapest tool on the market"];
    for (let attempt = 0; attempt < 2; attempt++) {
      modelWrites(fixtures.CLEAN_MARKDOWN);
      llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: fixtures.AT });
    }
    await draftGenerate.run({ data: {}, now: EVENING });
    const [stopped] = db.rows("drafts");
    expect(stopped?.state).toBe("needs_attention");
    const held = String(stopped?.opportunity_id);
    expect(statusOf(held)).toBe("queued");

    // The next evening writes the same text for the other target: the page
    // is stopped as a near-duplicate of the draft that waits for the founder.
    if (site !== undefined) site.do_not_claim = [];
    modelWrites(fixtures.CLEAN_MARKDOWN);
    modelWrites(fixtures.CLEAN_MARKDOWN);
    await draftGenerate.run({ data: {}, now: NEXT_EVENING });
    const next = db.rows("drafts").find((row) => row.id !== stopped?.id);
    expect(next).toMatchObject({ scheduled_for: "2026-09-09", state: "needs_attention" });
    expect(next?.opportunity_id).not.toBe(held);
    expect(next?.rule_failures).toContainEqual(
      expect.objectContaining({
        rule: "near_duplicate",
        detail: expect.objectContaining({ duplicateOf: expect.objectContaining({ kind: "queued", ref: stopped?.id }) }),
      })
    );
  });
});
