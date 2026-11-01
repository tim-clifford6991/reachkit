// tests/publish/attempt/live-edit.test.ts — SPEC §7 (owner R19): the
// version a customer's live edit made publishes through the real
// `publish()` and the real hosted adapter, at the same address.
import "../../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../harness";
import { LIVE_DRAFT, SAAS_HOSTED, WENT_LIVE, liveBody, publishLiveEdit, seedWorld } from "../../generate/live-edit-world";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({
  llm: () => {
    throw new Error("a live edit asks no model");
  },
}));
vi.mock("@/lib/measure/text", async () => {
  const { SAAS_HOSTED: site, measuredText } = await import("../../generate/live-edit-world");
  return { readMeasuredText: async () => measuredText(site) };
});
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { setGenerateStore } from "@/lib/generate/store";
import { livePageBySlug, livePagesForSite } from "@/lib/publish/destinations/hosted";

const NEW_WORDS = "Pick the plan that fits the team you have today.";

beforeEach(() => {
  seedWorld(db, SAAS_HOSTED);
  setGenerateStore(null);
});

describe("a customer's new version of a hosted page", () => {
  it("a customer's new version replaces the live text at the same address, no row deleted", async () => {
    await publishLiveEdit(SAAS_HOSTED, {
      bodyMd: `${liveBody(SAAS_HOSTED)}\n\n${NEW_WORDS}`,
      editedAt: new Date("2026-10-23T10:00:00.000Z"),
      outAt: new Date("2026-10-24T09:00:00.000Z"),
    });

    const page = await livePageBySlug(SAAS_HOSTED.siteId, "onboarding-checklist", SAAS_HOSTED.hostname!);
    expect(page?.page.bodyMd).toContain(NEW_WORDS);
    expect(db.rows("publications").filter((row) => row.live_url === SAAS_HOSTED.liveUrl)).toHaveLength(2);
    const [listed] = await livePagesForSite(SAAS_HOSTED.siteId, SAAS_HOSTED.hostname!);
    // The updated date, `dateModified` and `lastmod` move; the published date does not.
    expect(listed?.publishedAt.toISOString()).toBe("2026-10-24T09:00:00.000Z");
    expect(listed?.firstPublishedAt.toISOString()).toBe(WENT_LIVE);
    expect(db.rows("publications").map((row) => row.id)).toContain("p-live");
    expect(db.rows("publications")).toHaveLength(2);
    expect(db.rows("drafts").find((row) => row.id === LIVE_DRAFT)?.body_md).toBe(liveBody(SAAS_HOSTED));
  });
});
