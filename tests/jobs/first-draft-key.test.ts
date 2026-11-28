// A repeated first-draft send and the draft tick's own send for that day share one event id, so the platform runs one draft;
// and a site's run asks the week's titles while the day's own row is still open, before the write's first step.
import { expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { fakeDb } from "../scan/run/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

applyEnvFixture();
const { client, sendSubjectEvents, subjectEvents } = await import("../../src/jobs/client");
const { dayEvent, draftGenerate } = await import("../../src/jobs/draft-generate");

it("a repeated first-draft delivery is one event, the tick's own", async () => {
  const site = { siteId: "site-1", timeZone: "America/New_York", publishTime: "09:00", vetoHours: 24 };
  const first = dayEvent(site, { publishDate: "2026-09-07", hour: new Date("2026-09-06T12:00:00Z") });
  const sent: { id: string; name: string }[] = [];
  vi.spyOn(client, "send").mockImplementation((async (events: typeof sent) => {
    sent.push(...events);
    return { ids: [] };
  }) as never);

  await sendSubjectEvents("draft/generate", [first]);
  await sendSubjectEvents("draft/generate", [first]);
  const tick = subjectEvents("draft/generate", [dayEvent(site, { publishDate: "2026-09-07", hour: new Date("2026-09-07T12:00:00Z") })]);

  expect(sent).toHaveLength(2);
  expect(new Set([...sent, ...tick].map((event) => `${event.name} ${event.id}`)).size).toBe(1);
});

it("asks the week's titles before the day's page is written", async () => {
  const steps: string[] = [];
  const step = (async (name: string) => { steps.push(name); if (name === "hold") throw new Error("stop"); return null; }) as never;
  await expect(draftGenerate.perSubject!({ data: { siteId: "site-1", publishDate: "2026-11-29", hour: "2026-11-28T08:00:00Z" }, now: new Date("2026-11-28T08:03:00Z"), step })).rejects.toThrow("stop");
  expect(steps).toEqual(["notice", "titles", "hold"]);
});
