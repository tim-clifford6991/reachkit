// tests/generate/mend-battery.test.ts — SPEC §7 (issue 1507): a mended live page enters review only where today's whole
// battery passes, at 0¢. Each live page is written by the real pipeline in the database double for one synthetic
// customer, published, then given a defect code repairs; the day's mend reads it under today's rules. The week's next
// spare is the one stand-in beside the model and the network, for the day a page is stopped while it is written.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";
import { AT, fakeCost, opportunity, pack, pageParts, prose } from "./fixtures";
import { LIVE_DRAFT, LOCAL_WORDPRESS, SAAS_HOSTED, WENT_LIVE, measuredText, seedWorld, type LiveSite } from "./live-edit-world";

const db = fakeDb();
const { site, llm, pick } = vi.hoisted(() => ({ site: { current: null as LiveSite | null }, llm: vi.fn(), pick: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({ llm }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => (site.current === null ? [] : measuredText(site.current)) }));
vi.mock("@/lib/opportunities", async (original) => ({ ...(await original<object>()), pageForDay: (...args: unknown[]) => pick(...args) }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { PageStopped, generateDayPage } from "@/lib/generate";
import { generateDraft } from "@/lib/generate/pipeline";
import { siteRulesOf } from "@/lib/generate/pipeline/battery";
import { readAllFacts } from "@/lib/generate/pipeline/grounding";
import { generateStore, setGenerateStore } from "@/lib/generate/store";
import { insertFor } from "@/lib/opportunities/derive/persist";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const D = "2026-10-02";
const MEND_ID = "66666666-6666-4666-8666-666666666666";
const SPARE_ID = "55555555-5555-4555-8555-555555555555";
const BARE_ID = "77777777-7777-4777-8777-777777777777";
const row = (id: string): Row => db.rows("drafts").find((each) => each.id === id)!;
const others = (ids: readonly string[]): Row[] => db.rows("drafts").filter((each) => !ids.includes(each.id as string));
const statusOf = (id: string): unknown => db.rows("opportunities").find((each) => each.id === id)?.status;
let network: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  llm.mockReset();
  pick.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Every vendor, DataForSEO's research among them, is reached through fetch: a mend reaches none.
  network = vi.spyOn(globalThis, "fetch");
});
afterEach(() => vi.restoreAllMocks());

/** The day's refresh, planned for a defect code repairs alone, at `url`. */
function refreshAt(live: LiveSite, url: string, id = MEND_ID) {
  const refresh = opportunity({ id, siteId: live.siteId, type: "refresh_page", family: "improve", targetRef: url, evidence: { family: "improve", query: "which plan fits a small team", pageUrl: url, shortfall: { kind: "due", cause: "structure", defects: ["h1"] } } } as never);
  // Only the day's refresh and its spare are open, so a day that moves on finds no other topic to write.
  if (id === MEND_ID) for (const each of db.rows("opportunities")) each.status = "done";
  db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(refresh) as unknown as Row), id: refresh.id, status: "open", created_at: AT.toISOString() }]);
  return refresh;
}

/** A page the pipeline wrote and the rules passed, live at its own address with a body H1 code removes. `cut` takes a
 *  part of the text out after it passed, as a template that asks more of it today would read it. */
async function livePage(live: LiveSite, cut?: (body: string) => string) {
  site.current = live;
  seedWorld(db, live);
  setGenerateStore(null);
  llm.mockResolvedValue({ kind: "measured", value: pageParts(`${prose("seats", 300, 4)}\n\nTeams on the starter plan get 25 seats and unlimited projects for a flat monthly fee, per [the pricing page](${live.sourceUrl}).`), at: AT });
  const store = generateStore();
  const world = { site: siteRulesOf((await store.siteFacts(live.siteId))!, (await store.latestReport(live.siteId))!), facts: await readAllFacts({ siteId: live.siteId, scanId: "scan-1" }), opportunity: opportunity({ siteId: live.siteId }) };
  const written = await generateDraft(fakeCost(), { ...world, siteId: live.siteId, scheduledFor: "2026-09-20", pack: pack(), links: [] });
  expect(written.ok).toBe(true);
  llm.mockReset().mockRejectedValue(new Error("a mend asks no model"));
  const id = written.draftId!;
  const url = live.liveUrl.replace("onboarding-checklist", "which-tool-small-team");
  const body = (cut ?? ((text: string) => text))(row(id).body_md as string);
  Object.assign(row(id), { state: "published", body_md: `# ${row(id).title as string}\n\n${body}` });
  db.seed("publications", [...db.rows("publications"), { id: "p-written", draft_id: id, site_id: live.siteId, destination: live.destination, delivery_state: "delivered", attempt_no: 1, live_url: url, published_at: WENT_LIVE, unpublished_at: null, mode: "autopilot", made_live_by_us: true }]);
  return { id, url, refresh: refreshAt(live, url) };
}

const day = (live: LiveSite) => generateDayPage({ siteId: live.siteId, publishDate: D, now: NOW, opportunityId: MEND_ID });

describe("a mended live page enters review only after today's whole battery, at 0¢", () => {
  it.each([SAAS_HOSTED, LOCAL_WORDPRESS])("for $kind, a mend that passes is the repaired version, dated as the live one and recorded as passed", async (live) => {
    const { id } = await livePage(live);
    const liveRow = JSON.stringify(row(id));
    const outcome = await day(live);
    expect(outcome.ok).toBe(true);
    const mended = outcome.ok ? row(outcome.draftId) : null;
    expect(mended).toMatchObject({ hard_rules_passed: true, rule_failures: [], cost_cents: 0, scheduled_for: D, meta: { description: (row(id).meta as Row).description, datedAs: WENT_LIVE, mendOf: id } });
    expect(mended?.body_md).not.toMatch(/^# /);
    expect(JSON.stringify(row(id))).toBe(liveRow);
    expect(statusOf(MEND_ID)).toBe("queued");
    expect([llm.mock.calls.length, network.mock.calls.length]).toEqual([0, 0]);
  });

  /** The store, but a page saved for `stopped` is one the customer stopped while it was written. */
  const stopping = (stopped: (opportunityId: string) => boolean) => {
    const real = generateStore();
    setGenerateStore({ ...real, insertDraft: async (draft) => (stopped(draft.opportunity_id) ? Promise.reject(new PageStopped(draft.opportunity_id)) : real.insertDraft(draft)) });
  };

  it("a page stopped while it was written saves no draft, and the day takes the week's next spare", async () => {
    const { id, url } = await livePage(SAAS_HOSTED);
    pick.mockResolvedValueOnce(refreshAt(SAAS_HOSTED, url, SPARE_ID));
    stopping((opportunityId) => opportunityId === MEND_ID);
    expect((await day(SAAS_HOSTED)).ok).toBe(true);
    expect(others([id, LIVE_DRAFT]).map((each) => [each.opportunity_id, each.scheduled_for])).toEqual([[SPARE_ID, D]]);
    expect([statusOf(SPARE_ID), statusOf(MEND_ID)]).toEqual(["queued", "open"]);
  });

  it("a page stopped while it was written, with no spare left, leaves the day without a page", async () => {
    const { id } = await livePage(SAAS_HOSTED);
    stopping(() => true);
    expect(await day(SAAS_HOSTED)).toEqual({ ok: false, because: "no_opportunity" });
    expect(others([id, LIVE_DRAFT])).toEqual([]);
    expect(statusOf(MEND_ID)).toBe("open");
  });

  it.each([SAAS_HOSTED, LOCAL_WORDPRESS])("for $kind, live text that fails today's battery is stopped, the rule named, never in review", async (live) => {
    // The text that went live has lost its short answer, which a page must open on today.
    const { id } = await livePage(live, (body) => body.replace(/^[^\n]*The right tool for a small team[^\n]*\n/m, ""));
    const outcome = await day(live);
    const [mended] = others([id, LIVE_DRAFT]);
    expect(outcome).toEqual({ ok: false, because: "rules", draftId: mended?.id, attempts: 1 });
    expect(mended).toMatchObject({ hard_rules_passed: false, cost_cents: 0, state: "needs_attention", meta: { mendOf: id } });
    expect((mended?.rule_failures as Row[]).map((failure) => failure.rule)).toContain("first_block_answers");
    expect((mended?.transitions as Row[]).some((move) => move.to === "in_review")).toBe(false);
    expect([llm.mock.calls.length, network.mock.calls.length]).toEqual([0, 0]);
  });

  it("a live version with no stored pack or grounded fact is not mended: nothing is saved", async () => {
    site.current = SAAS_HOSTED;
    seedWorld(db, SAAS_HOSTED);
    setGenerateStore(null);
    row(LIVE_DRAFT).body_md = `# A title\n\n${row(LIVE_DRAFT).body_md as string}`;
    refreshAt(SAAS_HOSTED, SAAS_HOSTED.liveUrl);
    const before = db.rows("drafts").length;
    expect(await day(SAAS_HOSTED)).toEqual({ ok: false, because: "step_failed", draftId: null, step: "mend" });
    expect(db.rows("drafts").length).toBe(before);
    expect([llm.mock.calls.length, network.mock.calls.length]).toEqual([0, 0]);
  });

  it("a mend with nothing to check costs no day: its topic rests and the day writes the week's next spare", async () => {
    const { id, refresh } = await livePage(SAAS_HOSTED);
    // The page written before packs were stored is the day's refresh; the written page's refresh is the spare.
    row(LIVE_DRAFT).body_md = `# A title\n\n${row(LIVE_DRAFT).body_md as string}`;
    refreshAt(SAAS_HOSTED, SAAS_HOSTED.liveUrl, BARE_ID);
    pick.mockResolvedValueOnce(refresh);
    expect((await generateDayPage({ siteId: SAAS_HOSTED.siteId, publishDate: D, now: NOW, opportunityId: BARE_ID })).ok).toBe(true);
    expect(others([id, LIVE_DRAFT]).map((each) => [each.opportunity_id, each.scheduled_for, each.hard_rules_passed])).toEqual([[MEND_ID, D, true]]);
    expect(db.rows("opportunities").find((each) => each.id === BARE_ID)?.rest_until).not.toBeNull();
    expect([llm.mock.calls.length, network.mock.calls.length]).toEqual([0, 0]);
  });
});
