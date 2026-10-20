// tests/jobs/client-mapping-1573.test.ts — `client.ts` maps a definition's
// neutral bounds onto the platform, and derives one run per subject for a
// tick that sends its subjects on. The platform's own `createFunction` is
// spied for the options it is handed and the bodies it is given.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import type { JobDefinition } from "@/jobs/types";

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

type Created = { options: Record<string, unknown>; body: (ctx: unknown) => Promise<unknown> };

async function mapped(definition: (jobs: readonly JobDefinition[]) => JobDefinition, killSwitch = false) {
  stubEnv(killSwitch);
  const { client, defineJobs } = await import("@/jobs/client");
  const { jobs } = await import("@/jobs");
  const created: Created[] = [];
  vi.spyOn(client, "createFunction").mockImplementation(((options: Record<string, unknown>, body: Created["body"]) => {
    created.push({ options, body });
    return {} as never;
  }) as never);
  defineJobs(definition(jobs));
  return created;
}

const byId = (id: string) => (jobs: readonly JobDefinition[]) => jobs.find((job) => job.id === id)!;

describe("JobDefinition's concurrency and throttle, mapped only in client.ts", () => {
  it("draft/generate is a tick and a per-site run, keyed, one per site across jobs and five in all, throttled", async () => {
    const [tick, site] = await mapped(byId("draft/generate"));
    expect(tick!.options).toMatchObject({ id: "draft-generate", triggers: [{ cron: "0 * * * *" }] });
    expect(tick!.options).not.toHaveProperty("concurrency");
    expect(site!.options).toMatchObject({
      id: "draft-generate-subject",
      triggers: [{ event: "draft/generate/subject" }],
      idempotency: "event.data.key",
      concurrency: [{ key: "event.data.siteId", scope: "env", limit: 1 }, { limit: 5 }],
      throttle: { limit: 10, period: "60s" },
    });
  });

  it("weekly/refresh is mapped the same way; a job with no subjects stays one function", async () => {
    expect((await mapped(byId("weekly/refresh"))).map((fn) => fn.options.id)).toEqual(["weekly-refresh", "weekly-refresh-subject"]);
    expect((await mapped(byId("scan/run"))).map((fn) => fn.options.id)).toEqual(["scan-run"]);
  });

  it("a subject's event carries its key as the event id", async () => {
    stubEnv(false);
    const { subjectEvents } = await import("@/jobs/client");
    expect(subjectEvents("draft/generate", [{ key: "draft:s1:2026-09-08", data: { siteId: "s1" } }])).toEqual([
      { id: "draft:s1:2026-09-08", name: "draft/generate/subject", data: { siteId: "s1", key: "draft:s1:2026-09-08" } },
    ]);
  });

  it("each per-site run reads the kill switch again before its body", async () => {
    const perSubject = vi.fn(async () => ({ outcome: "ran" as const, subjectId: "s1" }));
    const [, site] = await mapped((jobs) => ({ ...byId("draft/generate")(jobs), perSubject }), true);
    const ctx = { event: { data: { key: "k", siteId: "s1" } }, attempt: 0, step: { run: vi.fn() } };
    await expect(site!.body(ctx)).resolves.toEqual({ outcome: "stopped", subjectId: null, by: "kill-switch" });
    expect(perSubject).not.toHaveBeenCalled();
  });
});
