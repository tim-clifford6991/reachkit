// tests/opportunities/update-instead.test.ts — SPEC §7 (2026-09-29, D12;
// issue 1143): "the day becomes an update of the closest existing page
// where one exists."
import "./env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { KnownPage } from "../../src/lib/known-content/types";
import { insertFor } from "../../src/lib/opportunities/derive/persist";
import { readOpportunity, setOpportunityStore } from "../../src/lib/opportunities/store";
import { updateInstead } from "../../src/lib/opportunities/update-instead";
import { opportunity } from "../generate/fixtures";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";

const NOW = new Date("2026-10-03T18:00:00.000Z");
const OLD = new Date("2026-06-01T00:00:00.000Z");

function known(over: Partial<KnownPage> = {}): KnownPage {
  return {
    source: "site",
    ref: "https://example.com/blog/project-management-software",
    url: "https://example.com/blog/project-management-software",
    title: "Project management software for small teams",
    headings: ["How to pick project management software"],
    live: true,
    publishedAt: OLD,
    ...over,
  };
}

let state: MemoryState;

async function planned() {
  const store = memoryStore(state);
  const inserted = await store.insert(insertFor(opportunity()));
  if (inserted.outcome !== "created") throw new Error("not inserted");
  return readOpportunity(inserted.row);
}

beforeEach(() => {
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});
afterEach(() => setOpportunityStore(null));

describe("updateInstead", () => {
  it("turns the planned page into an update of the close page, on its own row, keeping its search", async () => {
    const row = await planned();
    const update = await updateInstead(row, [known()], NOW);

    expect(update).toMatchObject({ id: row.id, type: "refresh_page", family: "improve", targetRef: known().url });
    const stored = readOpportunity((await memoryStore(state).byId(row.id))!);
    expect(stored).toMatchObject({
      type: "refresh_page",
      targetRef: known().url,
      targetQuery: row.targetQuery,
      status: row.status,
    });
  });

  it("leaves the page to wait where nothing the site has is close, live, old enough, or the destination's to update", async () => {
    const row = await planned();
    expect(await updateInstead(row, [], NOW)).toBeNull();
    expect(await updateInstead(row, [known({ title: "Our team retreat in Lisbon", headings: [] })], NOW)).toBeNull();
    expect(await updateInstead(row, [known({ live: false })], NOW)).toBeNull();
    expect(await updateInstead(row, [known({ publishedAt: new Date("2026-10-01T00:00:00.000Z") })], NOW)).toBeNull();
    // A hosted destination updates only its own live publications.
    state.hostedOwnPages = { host: "blog.example.com", slugs: [] };
    expect(await updateInstead(row, [known()], NOW)).toBeNull();
    expect((await memoryStore(state).byId(row.id))!.type).toBe(row.type);
  });
});
