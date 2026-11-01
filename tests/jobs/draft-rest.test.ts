// tests/jobs/draft-rest.test.ts — issue #788, through the job that runs it.
//
// A draft the hard rules stop has to end somewhere the customer can act on,
// and the customer's Regenerate has to be carried out. Both are driven here
// through the real `draft/generate` tick, the real engine seam, the real
// generation engine and its Postgres store, the real state machine, and the
// real Regenerate server action — against the storing PostgREST double the
// publishing suites share.
//
// Doubled at the last line of our own code: the model (`llm`), the pack's
// bar and its research read, the measured
// text the grounding reads, the cost ledger's context, the daily site list,
// the breakage and draft-ready mails, and the signed-in account.
import { afterEach, beforeAll, beforeEach, describe, expect, it as vitestIt, vi } from "vitest";
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

const { llmMock, readMeasuredTextMock, sitesForDailyTickMock, draftReadyMock, pickMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  sitesForDailyTickMock: vi.fn(),
  draftReadyMock: vi.fn(),
  pickMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
// What a pack must hold is `tests/generate/pipeline/pack.test.ts`; here the
// pack is short of what a case says it is, and no public page is read.
vi.mock("@/lib/generate/pipeline/pack", async (importOriginal) => {
  const { packStandIn } = await import("../generate/fixtures");
  return packStandIn(await importOriginal<object>());
});
vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => {
  const { researchStandIn } = await import("../generate/fixtures");
  return researchStandIn(await importOriginal<object>());
});
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
vi.mock("@/lib/costs", () => ({
  withCostContext: async (_ctx: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({ capHit: () => false, spentCents: () => 0, degraded: () => false }),
}));
vi.mock("@/lib/publish/daily", () => ({
  sitesForDailyTick: sitesForDailyTickMock,
  // Issue 1455's day record and publish-time check, tested where they live.
  recordDraftDay: async () => {},
  alertSiteDay: async () => 0,
  missedDays: async () => [],
  dayHold: async () => null,
}));
vi.mock("@/lib/publish/destinations/health", () => ({ sendBreakageMail: async () => ({ sent: false }) }));
vi.mock("@/lib/mail/draft-ready", () => ({ sendDraftReadyMail: draftReadyMock }));
// §7's ranking and readiness are tested where they live; the day's pick is
// the one opportunity this site holds. Its status writes are the real ones.
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  pageForDay: (siteId: string, date: string, now?: Date) => pickMock(siteId, date, now),
  assessFixPages: async () => ({ done: 0, ready: 0 }),
  assessReadiness: async () => ({ ready: 1, unready: 0 }),
}));
vi.mock("@/app/(account)/app/_session/account", () => ({
  requireAppAccount: async () => ({ userId: USER_ID, siteId: fixtures.SITE_ID }),
}));
vi.mock("@/app/(account)/app/_session/store", () => ({ siteOwnsDraft: async () => true }));
// Issue #913: the day panel's writes ask the screens that draw a page's
// state to re-read. `revalidatePath` needs Next's own request store, which
// this suite — a job suite calling the Server Function directly — does not
// have. Which paths are asked for is asserted in
// `tests/app/calendar/ownership.test.ts`.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const fixtures = await import("../generate/fixtures");
const opportunityDoubles = await import("../opportunities/memory-store");
const { draftGenerate } = await import("../../src/jobs/draft-generate");
const { regenerateDraft, skipDraft } = await import("../../src/app/(account)/app/calendar/publishing-actions");
const actualOpportunities = await vi.importActual<typeof import("../../src/lib/opportunities")>("@/lib/opportunities");
const { setOpportunityStore, opportunityById } = await import("../../src/lib/opportunities");

const USER_ID = "44444444-4444-4444-8444-444444444444";
/** 18:00 UTC is the site's publish time, and its window is 24 h: the tick
 *  at that hour drafts for 2026-09-08. */
const EVENING = new Date("2026-09-07T18:00:00.000Z");
/** The next morning — no site's evening, so only a restart is work. */
const MORNING = new Date("2026-09-08T09:00:00.000Z");

const STOPPED = "We tested every tool for months, and this one won.";

function measured(value: unknown) {
  return { kind: "measured", value, at: fixtures.AT };
}

/** One model call's answer: the page, with `markdown` as its first section.
 *  A stopped page takes two — its write call and its one fix call. */
function modelWrites(markdown: string, topic = "seats"): void {
  llmMock.mockResolvedValueOnce(
    measured(fixtures.pageParts(markdown, { slug: "a-title" }, topic))
  );
}

let opportunities: ReturnType<typeof opportunityDoubles.newMemoryState>;
let opportunityId: string;

// Vitest does not stop a case that times out: its body runs on and would take the next case's queued model answers.
let running: Promise<unknown> = Promise.resolve();
function it(name: string, body: () => Promise<void>): void {
  vitestIt(name, () => (running = body()));
}
// As long as the warm-up's limit, so the hook cannot time out first and let the body run on into the next case.
afterEach(async () => {
  await running.catch(() => undefined);
}, 180_000);

async function arrange(): Promise<void> {
  db.reset();
  installTransitionRpc(db);
  llmMock.mockReset();
  fixtures.packAnswer.missing = [];
  fixtures.packAnswer.short = false;
  delete fixtures.packAnswer.missingFor;
  draftReadyMock.mockReset();
  draftReadyMock.mockResolvedValue({ sent: true });
  readMeasuredTextMock.mockResolvedValue([
    { url: fixtures.GROUNDED.url, text: fixtures.SOURCE_TEXT, measuredAt: fixtures.GROUNDED.readAt },
  ]);
  sitesForDailyTickMock.mockResolvedValue({ sites: [{ siteId: fixtures.SITE_ID, timeZone: "UTC", publishTime: "18:00", vetoHours: 24 }], held: null });

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
      publish_time: "18:00",
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
    page_type: seed.pageType ?? null,
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
  pickMock.mockImplementation(async () => opportunityById(opportunityId));
}

// The draft job and §8's pipeline import lazily; one throwaway tick pays that cold load here, not inside the first case's 5 s.
// Over 60 s once at load 11 on the 4-core box, and a hook that times out skips every case, so it gets 180 s.
beforeAll(async () => {
  await arrange();
  await stoppedEvening();
}, 180_000);

beforeEach(arrange);

function statusOf(id: string): string | undefined {
  return opportunities.rows.find((row) => row.id === id)?.status;
}

/** D26 (issue 1179): the topic is on file, open, and not offered for a day. */
function restingUntil(id: string): string | null {
  const row = opportunities.rows.find((candidate) => candidate.id === id);
  if (row?.status !== "open" || row.ready || row.unready_reason !== "resting") return null;
  return row.rest_until ?? null;
}

async function stoppedEvening() {
  modelWrites(STOPPED);
  modelWrites(`${STOPPED} Again.`);
  return draftGenerate.run({ data: {}, now: EVENING });
}

describe("#788 — a draft the rules stop twice ends in needs_attention, on one row", () => {
  it("the evening tick leaves one row for the date, resting with its rules, and its topic rests for 28 days", async () => {
    const outcome = await stoppedEvening();
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:rules" });

    const drafts = db.rows("drafts");
    expect(drafts).toHaveLength(1);
    const [draft] = drafts;
    expect(draft).toMatchObject({ scheduled_for: "2026-09-08", state: "needs_attention", hard_rule_attempts: 2 });
    expect(draft?.rule_failures).not.toEqual([]);
    const moves = draft?.transitions as { from: string; to: string; reason?: string }[];
    expect(moves.at(-1)).toMatchObject({ from: "generating", to: "needs_attention", reason: expect.stringMatching(/^rules:.+/) });
    expect(restingUntil(opportunityId)).toBe("2026-10-05T18:00:00.000Z");
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
    // Issue 1337: rewritten at 09:00 on the 8th, its 24 h window ends after
    // that day's publish time has no room for it, so the row takes the 9th —
    // the day it publishes on.
    expect(draft).toMatchObject({
      id: draftId,
      scheduled_for: "2026-09-09",
      state: "in_review",
      body_md: expect.stringContaining("Start by counting the people who will open it"),
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
    modelWrites(`${STOPPED} And again.`);
    const outcome = await draftGenerate.run({ data: {}, now: MORNING });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:rules" });
    expect(db.rows("drafts")).toHaveLength(1);
    expect(draft?.state).toBe("needs_attention");
    expect(restingUntil(opportunityId)).not.toBeNull();
  });
});

describe("a page whose pack is short writes no row, and its topic rests (D41, issue 1536)", () => {
  it("nothing is written or left in Needs you, the run names the step and what is missing, and the next evening does not pick the topic", async () => {
    fixtures.packAnswer.missing = ["buyer_questions"];
    const outcome = await draftGenerate.run({ data: {}, now: EVENING });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:step_failed:pack:buyer_questions" });
    expect(llmMock).not.toHaveBeenCalled();
    expect(db.rows("drafts")).toEqual([]);
    expect(restingUntil(opportunityId)).not.toBeNull();
    expect(draftReadyMock).not.toHaveBeenCalled();
  });
});

describe("D26 (issue 1179) — a stopped draft does not cost its day, and its topic rests", () => {
  /** The evening after the first: the tick drafts for 2026-09-09. */
  const NEXT_EVENING = new Date("2026-09-08T18:00:00.000Z");
  const FIRST_TOPIC = "project management software for agencies";

  beforeEach(() => {
    // The day is picked by the real ranking here, over the rows the store holds.
    const market = fixtures.report().market;
    if (market.kind !== "measured") throw new Error("the fixture report has no measured market");
    opportunities.profile = market.value.profile;
    pickMock.mockImplementation((siteId: string, date: string, now?: Date) => actualOpportunities.pageForDay(siteId, date, now));
    for (const row of opportunities.rows) {
      row.ready = true;
      // D46: a "best …" search is a listicle, which the mix leaves out for
      // now, so the topic the real ranking is to pick first is a plain one.
      row.target_query = FIRST_TOPIC;
      row.evidence = { ...(row.evidence as object), query: FIRST_TOPIC } as never;
      row.acceptance = { form: "top20", query: FIRST_TOPIC };
    }
  });

  async function secondTopic(): Promise<string> {
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
    return other.row.id;
  }

  const WHY = { points: 3, parts: [{ part: "fit" as const, n: 3 }], rule: "best" as const };

  /** Issue 1559: the week the Monday committed — the first topic is the
   *  evening's date, the others its spares. */
  async function week(spares: readonly string[]): Promise<void> {
    await opportunityDoubles.memoryStore(opportunities).commitPlan!(fixtures.SITE_ID, [
      { opportunityId, place: 0, plannedFor: "2026-09-08", writeAs: null, reason: WHY },
      ...spares.map((id, n) => ({ opportunityId: id, place: 7 + n, plannedFor: null, writeAs: null, reason: WHY })),
    ]);
  }

  it("the next evening does not pick the rested topic and states its empty day; the stopped page is set aside, the rest as the stop left it", async () => {
    await stoppedEvening();
    const [stopped] = db.rows("drafts");
    expect(stopped).toMatchObject({ state: "needs_attention", scheduled_for: "2026-09-08" });
    const rested = restingUntil(opportunityId);
    expect(rested).toBe("2026-10-05T18:00:00.000Z");

    llmMock.mockClear();
    const empty = await draftGenerate.run({ data: {}, now: NEXT_EVENING });
    expect(empty).toEqual({ outcome: "degraded", subjectId: null, step: "generate:no_opportunity" });
    expect(llmMock).not.toHaveBeenCalled();
    expect(db.rows("drafts")).toHaveLength(1);
    expect([stopped?.state, (stopped?.transitions as { actor: unknown }[]).at(-1)?.actor, restingUntil(opportunityId)]).toEqual(["skipped", { kind: "system", job: "draft/recheck" }, rested]);
  });

  it("Skip on a stopped page rests its topic from the skip", async () => {
    await stoppedEvening();
    const [stopped] = db.rows("drafts");
    const rested = restingUntil(opportunityId);
    expect(await skipDraft(String(stopped?.id))).toBeNull();
    expect(stopped?.state).toBe("skipped");
    expect(Date.parse(String(restingUntil(opportunityId)))).toBeGreaterThan(Date.parse(String(rested)));
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

  it("a site whose first-ranked topic is stopped still gets a page that day when the second topic passes", async () => {
    await week([await secondTopic()]);
    modelWrites(STOPPED);
    modelWrites(`${STOPPED} Again.`);
    // The second topic's page is its own: the stopped one is still on file.
    modelWrites(fixtures.CLEAN_MARKDOWN, "plans");
    expect(await draftGenerate.run({ data: {}, now: EVENING })).toEqual({ outcome: "ran", subjectId: null });

    const drafts = db.rows("drafts");
    expect(drafts).toHaveLength(2);
    const stopped = drafts.find((row) => row.state === "needs_attention");
    const written = drafts.find((row) => row.state === "in_review");
    // The stopped draft keeps its row and no longer holds the date.
    expect(stopped).toMatchObject({ scheduled_for: null, hard_rule_attempts: 2 });
    expect(written).toMatchObject({
      scheduled_for: "2026-09-08",
      body_md: expect.stringContaining("Start by counting the people who will open it"),
    });
    expect(written?.opportunity_id).not.toBe(stopped?.opportunity_id);
    expect(statusOf(String(written?.opportunity_id))).toBe("queued");
    expect(statusOf(String(stopped?.opportunity_id))).not.toBe("queued");
    expect(draftReadyMock).toHaveBeenCalledWith(expect.objectContaining({ draftId: written?.id }));
  });

  it("the next topic is tried once: a second stop holds the date and no third topic is written", async () => {
    await secondTopic();
    const third = await opportunityDoubles.memoryStore(opportunities).insert({
      site_id: fixtures.SITE_ID,
      scan_id: fixtures.SCAN_ID,
      type: fixtures.opportunity().type,
      family: fixtures.opportunity().family,
      target_query: "kanban board for agencies",
      target_ref: "kanban-board-for-agencies",
      proposed_slug: "kanban-board-for-agencies",
      title: "Which kanban board suits an agency?",
      volume: 210,
      evidence: { ...fixtures.opportunity().evidence, query: "kanban board for agencies" } as never,
      acceptance: { form: "top20", query: "kanban board for agencies" },
      fit_band: fixtures.opportunity().fitBand,
      effort: fixtures.opportunity().effort,
    });
    if (third.outcome !== "created") throw new Error("the third opportunity was refused");
    for (const row of opportunities.rows) row.ready = true;
    await week(opportunities.rows.filter((row) => row.id !== opportunityId).map((row) => row.id));

    for (let attempt = 0; attempt < 4; attempt++) modelWrites(`${STOPPED} ${"Again. ".repeat(attempt)}`);
    const outcome = await draftGenerate.run({ data: {}, now: EVENING });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "generate:rules" });
    // Two topics, each its write call and its one fix call.
    expect(llmMock).toHaveBeenCalledTimes(4);

    const drafts = db.rows("drafts");
    expect(drafts.map((row) => row.state)).toEqual(["needs_attention", "needs_attention"]);
    expect(drafts.map((row) => row.scheduled_for)).toEqual([null, "2026-09-08"]);
    expect(statusOf(third.row.id)).toBe("open");
    expect(restingUntil(third.row.id)).toBeNull();

    // A second delivery of the tick finds the date held and spends nothing.
    llmMock.mockClear();
    await draftGenerate.run({ data: {}, now: EVENING });
    expect(llmMock).not.toHaveBeenCalled();
    expect(db.rows("drafts")).toHaveLength(2);
  });

  it("issue 1477: two topics whose packs are short do not end the day while a ready topic is left", async () => {
    await secondTopic();
    const third = await opportunityDoubles.memoryStore(opportunities).insert({
      site_id: fixtures.SITE_ID,
      scan_id: fixtures.SCAN_ID,
      type: fixtures.opportunity().type,
      family: fixtures.opportunity().family,
      target_query: "project management software for startups",
      target_ref: "project-management-software-for-startups",
      proposed_slug: "project-management-software-for-startups",
      title: "Which project management software suits a startup?",
      volume: 90,
      evidence: { ...fixtures.opportunity().evidence, query: "project management software for startups" } as never,
      acceptance: { form: "top20", query: "project management software for startups" },
      fit_band: fixtures.opportunity().fitBand,
      effort: fixtures.opportunity().effort,
    });
    if (third.outcome !== "created") throw new Error("the third opportunity was refused");
    for (const row of opportunities.rows) row.ready = true;
    await week(opportunities.rows.filter((row) => row.id !== opportunityId).map((row) => row.id));
    // reachkit.app, 17 October, and issue 1486's short how-to: nothing was
    // written for either.
    const first = fixtures.opportunity().targetQuery;
    fixtures.packAnswer.missingFor = (query) => (query === "project management software for startups" ? [] : query === first ? ["buyer_questions"] : ["outside_sources"]);
    modelWrites(fixtures.CLEAN_MARKDOWN, "plans");

    expect(await draftGenerate.run({ data: {}, now: EVENING })).toEqual({ outcome: "ran", subjectId: null });
    // The two short packs cost no write call; the third topic's page is the day's.
    expect(llmMock).toHaveBeenCalledTimes(1);
    const drafts = db.rows("drafts");
    const written = drafts.find((row) => row.state === "in_review");
    expect(written).toMatchObject({ scheduled_for: "2026-09-08", opportunity_id: third.row.id });
    // Issue 1536: neither short topic left a row in Needs you; both rest.
    expect(drafts.filter((row) => row.state === "needs_attention")).toEqual([]);
    expect(restingUntil(opportunityId)).not.toBeNull();
  });

  it("Write it again on a stopped draft that gave up its date puts it in review on a date of its own", async () => {
    await secondTopic();
    modelWrites(STOPPED);
    modelWrites(`${STOPPED} Again.`);
    // The second topic's page is its own: the stopped one is still on file.
    modelWrites(fixtures.CLEAN_MARKDOWN, "plans");
    await draftGenerate.run({ data: {}, now: EVENING });
    const stopped = db.rows("drafts").find((row) => row.state === "needs_attention");
    // The model double writes one clean text; the page already in review is
    // set aside so the rewrite is not stopped as its near-duplicate.
    const written = db.rows("drafts").find((row) => row.state === "in_review");
    if (written !== undefined) written.state = "skipped";

    expect(await regenerateDraft(String(stopped?.id))).toBeNull();
    modelWrites(fixtures.CLEAN_MARKDOWN);
    expect(await draftGenerate.run({ data: {}, now: MORNING })).toEqual({ outcome: "ran", subjectId: null });
    // Its window ends on 2026-09-09, a day no page holds.
    expect(stopped).toMatchObject({ state: "in_review", scheduled_for: "2026-09-09" });
    expect(statusOf(String(stopped?.opportunity_id))).toBe("queued");
  });
});
