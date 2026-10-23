// tests/generate/edit-live.test.ts — SPEC §7 (owner R19): a customer's edit
// of a live page is a new version at the same address, through the refresh
// path and the state machine, at 0¢.
//
// Driven through `startLiveEdit` against the database double, for a SaaS on
// the hosted destination and a local business on WordPress. The stand-ins
// are what a `node` test must not reach: the model, DataForSEO, the network,
// and the measured text the grounding rule reads.
import "./env";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_ACCOUNT, RESERVED_ACCOUNT, resetAccount, signedInAs } from "../app/account-door";
import { fakeDb, type Row } from "../publish/harness";
import {
  LIVE_DESCRIPTION,
  LIVE_DRAFT,
  LIVE_TITLE,
  LOCAL_WORDPRESS,
  SAAS_HOSTED,
  USER_ID,
  liveBody,
  measuredText,
  seedWorld,
  snapshot,
  type LiveSite,
} from "./live-edit-world";

const db = fakeDb();
const { site } = vi.hoisted(() => ({ site: { current: null as LiveSite | null } }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({
  llm: () => {
    throw new Error("a live edit asks no model");
  },
}));
vi.mock("@/lib/vendors/dataforseo/transport", async (original) => ({
  ...(await original<object>()),
  sendRequest: () => {
    throw new Error("a live edit buys nothing");
  },
  sendGet: () => {
    throw new Error("a live edit buys nothing");
  },
}));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => (site.current === null ? [] : measuredText(site.current)) }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { startLiveEdit, waitingVersion } from "@/lib/generate/edit-live";
import { readDraftRow } from "@/app/(account)/app/draft/[draftId]/store";
import { setGenerateStore } from "@/lib/generate/store";
import { opportunityStore } from "@/lib/opportunities/store";
import { transition } from "@/lib/publish/machine";
import { TRANSITIONS } from "@/lib/publish/machine/table";

const AT = new Date("2026-10-23T10:00:00.000Z");
const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (() => {
    throw new Error("a live edit reaches no network");
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  resetAccount();
});

function arrange(live: LiveSite): void {
  site.current = live;
  seedWorld(db, live);
  setGenerateStore(null);
}

function edit(live: LiveSite, over: Partial<Parameters<typeof startLiveEdit>[0]> = {}) {
  return startLiveEdit({
    siteId: live.siteId,
    userId: USER_ID,
    liveDraftId: LIVE_DRAFT,
    title: LIVE_TITLE,
    bodyMd: `${liveBody(live)}\n\nPick the plan that fits the team you have today.`,
    description: LIVE_DESCRIPTION,
    at: AT,
    ...over,
  });
}

const drafts = () => db.rows("drafts");
const draft = (id: string) => drafts().find((row) => row.id === id)!;
const opportunity = (id: unknown) => db.rows("opportunities").find((row) => row.id === id)!;
const moves = (id: string) => (draft(id).transitions as { from: string; to: string; actor: Row }[]).map((move) => `${move.from}→${move.to}`);

describe.each([SAAS_HOSTED, LOCAL_WORDPRESS])("a live page's edit, $kind", (live) => {
  beforeEach(() => arrange(live));

  it("a changed save makes one new version; the live rows are untouched", async () => {
    const liveDraft = snapshot(db, "drafts", LIVE_DRAFT);
    const livePublication = snapshot(db, "publications", "p-live");

    const outcome = await edit(live);

    expect(outcome).toMatchObject({ ok: true, changed: true });
    const made = drafts().filter((row) => row.id !== LIVE_DRAFT);
    expect(made).toHaveLength(1);
    const version = made[0]!;
    expect(outcome).toMatchObject({ draftId: version.id });
    expect(version.body_md).toBe(`${liveBody(live)}\n\nPick the plan that fits the team you have today.`);
    expect(version.meta).toMatchObject({ description: LIVE_DESCRIPTION, body_md_generated: liveBody(live), first_edited_at: AT.toISOString() });
    expect(version.meta).not.toHaveProperty("datedAs");
    const refresh = opportunity(version.opportunity_id);
    expect(refresh).toMatchObject({ type: "refresh_page", family: "improve", target_ref: live.liveUrl, target_query: "onboarding checklist", status: "queued" });
    expect(refresh.evidence).toMatchObject({ shortfall: { kind: "due", cause: "edited" } });
    expect(snapshot(db, "drafts", LIVE_DRAFT)).toBe(liveDraft);
    expect(snapshot(db, "publications", "p-live")).toBe(livePublication);
    expect(db.rows("publications")).toHaveLength(1);
  });

  it("passing save → in_review, failing save → needs_attention", async () => {
    const passing = await edit(live);
    expect(passing).toMatchObject({ ok: true, state: "in_review", passed: true });
    const id = (passing as { draftId: string }).draftId;
    expect(draft(id).state).toBe("in_review");
    expect(moves(id)).toEqual(["generating→needs_attention", "needs_attention→in_review"]);
    expect(typeof draft(id).veto_deadline).toBe("string");

    arrange(live);
    const failing = await edit(live, { bodyMd: `${liveBody(live)}\n\nIn our tests the starter plan held up for every team we tried.` });
    expect(failing).toMatchObject({ ok: true, state: "needs_attention", passed: false });
    const held = (failing as { draftId: string }).draftId;
    expect(draft(held).state).toBe("needs_attention");
    expect(draft(held).hard_rules_passed).toBe(false);
    expect(moves(held)).toEqual(["generating→needs_attention"]);
    expect(draft(LIVE_DRAFT).state).toBe("published");
    // Every move was one of the seventeen.
    expect(TRANSITIONS).toHaveLength(17);
  });

  it("skipping a failed live edit dismisses its refresh, and no page is planned for it", async () => {
    const failing = await edit(live, { bodyMd: `${liveBody(live)}\n\nIn our tests the starter plan held up for every team we tried.` });
    const held = (failing as { draftId: string }).draftId;
    const refresh = draft(held).opportunity_id;

    const skipped = await transition(held, "skipped", { kind: "customer", userId: USER_ID }, { at: AT });

    expect(skipped).toMatchObject({ ok: true });
    expect(opportunity(refresh).status).toBe("dismissed");
    expect((await opportunityStore().openRankable(live.siteId)).map((row) => row.id)).not.toContain(refresh);
  });

  it("an unchanged save is a no-op", async () => {
    const before = JSON.stringify([drafts(), db.rows("opportunities"), db.rows("publications")]);
    expect(await edit(live, { bodyMd: liveBody(live) })).toEqual({ ok: true, changed: false });
    expect(JSON.stringify([drafts(), db.rows("opportunities"), db.rows("publications")])).toBe(before);
  });

  it("asks no model, buys nothing and costs nothing", async () => {
    const outcome = await edit(live);
    expect(outcome).toMatchObject({ ok: true, changed: true });
    expect(draft((outcome as { draftId: string }).draftId).cost_cents).toBe(0);
    expect(db.rows("fetches")).toEqual([]);
  });
});

describe("one version of an address waits at a time", () => {
  beforeEach(() => arrange(SAAS_HOSTED));

  function pendingRefresh(state: string): void {
    db.rows("opportunities").push({ id: "o-pending", site_id: SAAS_HOSTED.siteId, type: "refresh_page", family: "improve", target_query: "onboarding checklist", target_ref: SAAS_HOSTED.liveUrl, status: "queued" });
    db.rows("drafts").push({ id: "d-pending", site_id: SAAS_HOSTED.siteId, opportunity_id: "o-pending", state, transitions: [] });
  }

  for (const state of ["in_review", "needs_attention", "generating", "approved", "publishing"]) {
    it(`a version in ${state} refuses the save with its id, and nothing is written`, async () => {
      pendingRefresh(state);
      const before = JSON.stringify([drafts(), db.rows("opportunities")]);
      expect(await edit(SAAS_HOSTED)).toEqual({ ok: false, refused: "pending_version", draftId: "d-pending" });
      expect(JSON.stringify([drafts(), db.rows("opportunities")])).toBe(before);
      expect(await waitingVersion(SAAS_HOSTED.siteId, LIVE_DRAFT)).toMatchObject({ id: "d-pending", state });
    });
  }

  it("a planned refresh is not a waiting version, and neither is nothing", async () => {
    expect(await waitingVersion(SAAS_HOSTED.siteId, LIVE_DRAFT)).toBeNull();
    pendingRefresh("planned");
    expect(await waitingVersion(SAAS_HOSTED.siteId, LIVE_DRAFT)).toBeNull();
  });

  it("a planned refresh of the address gives way: its draft is skipped, its row dismissed, and the edit takes its place", async () => {
    pendingRefresh("planned");
    const outcome = await edit(SAAS_HOSTED);
    expect(outcome).toMatchObject({ ok: true, changed: true });
    expect(draft("d-pending").state).toBe("skipped");
    expect(opportunity("o-pending").status).toBe("dismissed");
  });

  it("a refresh planned and not yet written is dismissed", async () => {
    db.rows("opportunities").push({ id: "o-open", site_id: SAAS_HOSTED.siteId, type: "refresh_page", family: "improve", target_query: "onboarding checklist", target_ref: SAAS_HOSTED.liveUrl, status: "open" });
    expect(await edit(SAAS_HOSTED)).toMatchObject({ ok: true, changed: true });
    expect(opportunity("o-open").status).toBe("dismissed");
  });
});

describe("what is refused", () => {
  beforeEach(() => arrange(SAAS_HOSTED));

  it("a page the customer took down is not live", async () => {
    Object.assign(draft(LIVE_DRAFT), { state: "unpublished" });
    Object.assign(db.rows("publications")[0]!, { unpublished_at: "2026-10-20T09:00:00.000Z" });
    expect(await edit(SAAS_HOSTED)).toEqual({ ok: false, refused: "not_live" });
    expect(drafts()).toHaveLength(1);
    expect(await waitingVersion(SAAS_HOSTED.siteId, LIVE_DRAFT)).toBe("not_live");
  });

  it("another site's page is not editable", async () => {
    expect(await edit(SAAS_HOSTED, { siteId: LOCAL_WORDPRESS.siteId })).toEqual({ ok: false, refused: "not_editable" });
    expect(drafts()).toHaveLength(1);
  });

  it("the reserved fixture account is refused at the server function, and a signed-in owner's save goes through it", async () => {
    const { saveLiveEdit } = await import("@/app/(account)/app/draft/[draftId]/save-actions");
    const body = { draftId: LIVE_DRAFT, title: LIVE_TITLE, bodyMd: `${liveBody(SAAS_HOSTED)}\n\nMore.`, description: LIVE_DESCRIPTION };
    signedInAs(RESERVED_ACCOUNT);
    expect(await saveLiveEdit(body)).toEqual({ ok: false, refused: "not_editable" });
    expect(drafts()).toHaveLength(1);
    signedInAs({ ...LIVE_ACCOUNT, siteId: SAAS_HOSTED.siteId, userId: USER_ID });
    expect(await saveLiveEdit(body)).toMatchObject({ ok: true, changed: true, state: "in_review" });
    expect(drafts()).toHaveLength(2);
  });
});

describe("the live page's screen, read from the rows", () => {
  beforeEach(() => arrange(SAAS_HOSTED));
  const read = () => readDraftRow({ draftId: LIVE_DRAFT, site: { siteId: SAAS_HOSTED.siteId, timeZone: "UTC", mode: "autopilot", domain: SAAS_HOSTED.domain } });

  it("nothing waiting at the address: Edit this page opens the editor", async () => {
    expect((await read())?.live?.edit).toEqual({ kind: "editor" });
  });

  it("a read that fails draws no Edit this page, and the live page still draws", async () => {
    // Only the read of the address's refreshes fails; the page's own record reads as ever.
    const client = db.client as { from: (table: string) => { select: (columns: string) => unknown } };
    const from = client.from;
    db.unreadable.add("refreshes-unreachable");
    const spy = vi.spyOn(client, "from").mockImplementation((table) => {
      const built = from(table);
      if (table !== "opportunities") return built;
      const select = built.select;
      built.select = (columns) => (columns === "id, target_ref" ? from("refreshes-unreachable").select(columns) : select(columns));
      return built;
    });
    try {
      const facts = await read();
      expect(facts?.live).not.toBeNull();
      expect(facts?.live?.edit).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
