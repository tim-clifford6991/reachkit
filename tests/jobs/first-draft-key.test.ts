// A repeated first-draft send and the draft tick's own send for that day share one event id, so the platform runs one draft.
import { expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();
const { client, sendSubjectEvents, subjectEvents } = await import("../../src/jobs/client");
const { dayEvent } = await import("../../src/jobs/draft-generate");

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
