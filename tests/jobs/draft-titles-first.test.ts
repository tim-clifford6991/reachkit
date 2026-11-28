// The day's own row is re-titled while it is still open: `titles` runs before the write's first step.
import "../opportunities/env";
import { expect, it, vi } from "vitest";
import { fakeDb } from "../scan/run/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
const { draftGenerate } = await import("../../src/jobs/draft-generate");

it("asks the week's titles before the day's page is written", async () => {
  const steps: string[] = [];
  const step = (async (name: string) => { steps.push(name); if (name === "hold") throw new Error("stop"); return null; }) as never;
  await expect(draftGenerate.perSubject!({ data: { siteId: "site-1", publishDate: "2026-11-29", hour: "2026-11-28T08:00:00Z" }, now: new Date("2026-11-28T08:03:00Z"), step })).rejects.toThrow("stop");
  expect(steps).toEqual(["notice", "titles", "hold"]);
});
