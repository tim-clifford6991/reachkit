// A page whose draft fails to save goes back to the plan: saving a draft
// claims its page (`open → queued`) before the insert, and an insert that
// writes no row gives back only the claim this call took.
import "./env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";
import { SITE_ID, memoryStore, opportunity } from "./fixtures";

const db = fakeDb();
db.uniqueIndexes.push({ table: "drafts", columns: ["site_id", "scheduled_for"] });
const client = db.client as { from(table: string): Record<string, unknown> };
/** Answers the `drafts` insert in place of the database, where a case forces one. */
let forced: (() => { data: Row[] | null; error: { message: string; code?: string } | null }) | null = null;
const seen = {
  from(table: string) {
    const real = client.from(table);
    if (table !== "drafts" || forced === null) return real;
    const answer = forced;
    return { ...real, insert: () => ({ select: async () => answer() }) };
  },
};
vi.mock("@/lib/db", () => ({ dbAdmin: () => seen, db: () => seen }));

const { pickMock } = vi.hoisted(() => ({ pickMock: vi.fn() }));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  pageForDay: (siteId: string, date: string, now?: Date) => pickMock(siteId, date, now),
}));
vi.mock("@/lib/llm", () => ({
  llm: () => {
    throw new Error("a mend asks no model");
  },
}));
vi.mock("@/lib/costs", () => ({
  withCostContext: async (_: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({ recordFetch: () => { throw new Error("a mend fetches nothing"); }, capHit: () => false, spentCents: () => 0, degraded: () => false }),
}));

const { supabaseGenerateStore, setGenerateStore, DraftDateTaken } = await import("@/lib/generate/store");
const { generateDayPage } = await import("@/lib/generate");
const { committedWeek } = await import("@/lib/opportunities");
const { supabaseOpportunityStore } = await import("@/lib/opportunities/store");

const DAY = "2026-11-10";
const LIVE = "https://harbor-plumbing.example/drain-repair";

function status(id = "o1"): unknown {
  return db.rows("opportunities").find((row) => row.id === id)!.status;
}

function draft(over: Partial<Row> = {}) {
  return {
    site_id: SITE_ID,
    opportunity_id: "o1",
    state: "generating" as const,
    title: "t",
    body_md: "b",
    grounded_fact: null,
    attribution: null,
    scheduled_for: DAY,
    cost_cents: 0,
    ...over,
  };
}

/** A planned refresh of a live page whose one defect code repairs, as the opportunities table holds it. */
function refresh(id: string, plannedFor: string | null, place: number): Row {
  const page = opportunity({
    id,
    type: "refresh_page",
    family: "improve",
    targetQuery: "drain repair harbor",
    targetRef: LIVE,
    evidence: { family: "improve", query: "drain repair harbor", pageUrl: LIVE, shortfall: { kind: "due", cause: "structure", defects: ["h1"] } },
  } as never);
  return {
    id,
    site_id: SITE_ID,
    scan_id: page.scanId,
    type: page.type,
    family: page.family,
    target_query: page.targetQuery,
    target_ref: page.targetRef,
    title: "Drain repair in Harbor",
    evidence: page.evidence,
    acceptance: page.acceptance,
    fit_band: null,
    effort: 1,
    status: "open",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    rest_until: null,
    created_at: "2026-11-01T00:00:00.000Z",
    plan_place: place,
    planned_for: plannedFor,
  };
}

beforeEach(() => {
  forced = null;
  pickMock.mockReset();
  setGenerateStore(null);
  db.reset();
  db.seed("sites", [{ id: SITE_ID, domain: "harbor-plumbing.example" }]);
  db.seed("opportunities", [{ id: "o1", site_id: SITE_ID, target_query: "drain repair", volume: 90, status: "open", planned_for: DAY }]);
  db.seed("drafts", []);
});

describe("queueing a page", () => {
  it("says it moved an open page", async () => {
    expect(await supabaseOpportunityStore().markQueued("o1")).toBe(true);
    expect(status()).toBe("queued");
  });

  it.each(["queued", "dismissed", "done"])("says it did not move a %s page, and leaves it", async (held) => {
    db.rows("opportunities")[0]!.status = held;
    expect(await supabaseOpportunityStore().markQueued("o1")).toBe(false);
    expect(status()).toBe(held);
  });
});

describe("a draft that fails to save", () => {
  it("(a) gives the page back to the plan when the date's row is taken", async () => {
    forced = () => ({ data: null, error: { message: "duplicate key", code: "23505" } });
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toBeInstanceOf(DraftDateTaken);
    expect(status()).toBe("open");
    expect(db.rows("drafts")).toEqual([]);
  });

  it("(b) gives the page back on any other store error, and the error reaches the caller", async () => {
    forced = () => ({ data: null, error: { message: "connection reset" } });
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toThrow("insert into drafts failed: connection reset");
    expect(status()).toBe("open");
  });

  it("gives the page back when the insert returns no row", async () => {
    forced = () => ({ data: [], error: null });
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toThrow("returned no row");
    expect(status()).toBe("open");
  });

  it("(c) leaves a page it did not claim queued, with a sibling delivery's draft saved", async () => {
    await supabaseGenerateStore().insertDraft(draft());
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toBeInstanceOf(DraftDateTaken);
    expect(status()).toBe("queued");
    expect(db.rows("drafts")).toHaveLength(1);
  });

  it("leaves a page it claimed queued where a sibling delivery saved that page's draft meanwhile", async () => {
    forced = () => {
      db.rows("drafts").push({ id: "sibling", site_id: SITE_ID, opportunity_id: "o1", scheduled_for: DAY });
      return { data: null, error: { message: "duplicate key", code: "23505" } };
    };
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toBeInstanceOf(DraftDateTaken);
    expect(status()).toBe("queued");
  });

  it("(d) leaves a page stopped between the claim and the give-back dismissed", async () => {
    forced = () => {
      db.rows("opportunities")[0]!.status = "dismissed";
      return { data: null, error: { message: "duplicate key", code: "23505" } };
    };
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toBeInstanceOf(DraftDateTaken);
    expect(status()).toBe("dismissed");
  });

  it("(e) a saved draft leaves its page queued", async () => {
    await supabaseGenerateStore().insertDraft(draft());
    expect(db.rows("drafts")).toHaveLength(1);
    expect(status()).toBe("queued");
  });
});

describe("two deliveries of one evening (issue 886)", () => {
  it("the losing delivery's spare is open again and the next evening can take it", async () => {
    db.seed("opportunities", [refresh("o-first", DAY, 1), refresh("o-spare", null, 2)]);
    // The planned page was stopped while it was written, so this delivery went on to the week's spare.
    db.rows("opportunities")[0]!.status = "dismissed";
    // The other delivery saved the date's page meanwhile.
    db.seed("drafts", [{ id: "sibling", site_id: SITE_ID, opportunity_id: "o-other", scheduled_for: DAY }]);
    const store = memoryStore();
    store.seed({ id: "live", state: "published", title: "Drain repair in Harbor", body_md: "# Drain repair in Harbor\n\nShut the stop valve, then call Harbor Plumbing.", meta: {}, attribution: null });
    setGenerateStore(
      Object.assign(store, {
        liveVersionAt: async () => ({ draft: store.rows.get("live")!, publishedAt: new Date("2026-10-05T07:00:00.000Z") }),
        insertDraft: supabaseGenerateStore().insertDraft,
      })
    );
    const [spare] = (await committedWeek(SITE_ID)).spares;
    expect(spare?.id).toBe("o-spare");
    pickMock.mockResolvedValue(spare);

    expect(await generateDayPage({ siteId: SITE_ID, publishDate: DAY, opportunityId: "o-first" })).toEqual({ ok: false, because: "already_drafted" });
    expect(status("o-spare")).toBe("open");
    expect(status("o-first")).toBe("dismissed");
    expect((await committedWeek(SITE_ID)).spares.map((page) => [page.id, page.ready])).toEqual([["o-spare", true]]);
  });
});
