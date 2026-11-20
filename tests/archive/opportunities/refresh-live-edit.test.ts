// tests/opportunities/refresh-live-edit.test.ts — SPEC §7 (owner R19): a page
// whose live version a customer's edit made is "customer edited". The
// `structure` and `link` refreshes and the live re-check leave it alone, as
// they do any page the customer edited. Each case runs a control: the same
// version without the edit's stamp is planned or read.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";
import { SAAS_HOSTED, liveBody, publishLiveEdit, seedWorld } from "../generate/live-edit-world";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({
  llm: () => {
    throw new Error("a live edit asks no model");
  },
}));
vi.mock("@/lib/measure/text", async () => {
  const { SAAS_HOSTED: site, measuredText } = await import("../generate/live-edit-world");
  return { readMeasuredText: async () => measuredText(site) };
});
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { setGenerateStore } from "@/lib/generate/store";
import { withdrawFailingPages } from "@/lib/generate/live-recheck";
import { planLinkBacks, planStructureRefreshes } from "@/lib/opportunities/refresh";

const OUT_AT = new Date("2026-10-24T09:00:00.000Z");
// Past §6's floor, so age does not decide either way.
const PLANNED_AT = new Date("2027-01-10T09:00:00.000Z");
const FRESH_URL = "https://blog.acme-crm.example/onboarding-checklist-remote-teams";

let version: Row;

beforeEach(async () => {
  seedWorld(db, SAAS_HOSTED);
  setGenerateStore(null);
  const id = await publishLiveEdit(SAAS_HOSTED, {
    bodyMd: `${liveBody(SAAS_HOSTED)}\n\nPick the plan that fits the team you have today.`,
    editedAt: new Date("2026-10-23T10:00:00.000Z"),
    outAt: OUT_AT,
  });
  version = db.rows("drafts").find((row) => row.id === id)!;
});

/** The control: the same version as if no customer had edited it. */
function unstamped(): void {
  const meta = { ...(version.meta as Row) };
  delete meta.first_edited_at;
  version.meta = meta;
}

const refreshesPlanned = (cause: string) =>
  db.rows("opportunities").filter((row) => (row.evidence as { shortfall?: { cause?: unknown } } | null)?.shortfall?.cause === cause);

describe("a page a live edit made is customer edited", () => {
  it("plans no structure refresh for it", async () => {
    // A rule of issue 1507 the live text breaks: an H1 in the body.
    version.body_md = `${String(version.body_md)}\n\n# A second title`;
    expect(await planStructureRefreshes({ siteId: SAAS_HOSTED.siteId, at: PLANNED_AT })).toBe(0);
    expect(refreshesPlanned("structure")).toEqual([]);

    unstamped();
    expect(await planStructureRefreshes({ siteId: SAAS_HOSTED.siteId, at: PLANNED_AT })).toBe(1);
  });

  it("plans no link refresh for it when a newer page near it goes live", async () => {
    db.rows("opportunities").push({ id: "o-fresh", site_id: SAAS_HOSTED.siteId, scan_id: "scan-1", type: "answer_page", family: "write", target_query: "onboarding checklist for remote teams", target_ref: "onboarding-checklist-remote-teams", status: "done", evidence: { family: "write", query: "onboarding checklist for remote teams" }, acceptance: null, cluster_key: null, absorbed_queries: [] });
    db.rows("drafts").push({ id: "d-fresh", site_id: SAAS_HOSTED.siteId, opportunity_id: "o-fresh", state: "published", title: "Onboarding checklist for remote teams", body_md: "Remote teams start here.", meta: {}, transitions: [] });
    db.rows("publications").push({ id: "p-fresh", draft_id: "d-fresh", site_id: SAAS_HOSTED.siteId, destination: "hosted", delivery_state: "delivered", live_url: FRESH_URL, published_at: "2027-01-09T09:00:00.000Z", unpublished_at: null });

    expect(await planLinkBacks({ siteId: SAAS_HOSTED.siteId, url: FRESH_URL, at: PLANNED_AT })).toBe(0);

    unstamped();
    expect(await planLinkBacks({ siteId: SAAS_HOSTED.siteId, url: FRESH_URL, at: PLANNED_AT })).toBe(1);
  });

  it("the live re-check does not read it", async () => {
    // A site with a rival, whose pages the re-check reads.
    Object.assign(db.rows("sites")[0]!, { competitors: ["rival-crm.example"] });
    const recheck = () => withdrawFailingPages({ now: PLANNED_AT });
    expect((await recheck()).checked).toBe(0);

    unstamped();
    expect((await recheck()).checked).toBe(1);
  });
});
