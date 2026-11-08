// Every invocation of a served job is counted into `job_days` once, and a failing store changes no answer. The real
// client's functions are delivered as the platform does (SDK dev mode for the signature); the store is a double.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import { fakeDb } from "../publish/harness";
import type { JobDefinition } from "@/jobs/types";
import type { JobDayAdd } from "@/jobs/job-days";

const db = fakeDb();
const SITE = "3f2b6c1e-8a4d-4e7b-9c1a-2d5e6f7a8b9c";
const SUBJECT = { name: "weekly/refresh/subject", data: { siteId: SITE, key: `weekly-${SITE}` } };
const TICK = { name: "inngest/scheduled.timer", data: {} };

/** A tick with no steps whose per-site run takes three steps. */
const definition = {
  id: "weekly/refresh",
  trigger: { kind: "cron", cron: "0 * * * *" },
  idempotencyKey: [],
  run: async () => ({ outcome: "skipped", subjectId: null, reason: "no-subject" }),
  perSubject: async (input) => {
    for (const name of ["one", "two", "three"]) await input.step!(name, async () => name);
    return { outcome: "ran", subjectId: String(input.data.siteId) };
  },
} as JobDefinition;

async function served(store: (add: JobDayAdd) => Promise<void>) {
  stubEnv(false);
  vi.stubEnv("INNGEST_DEV", "1");
  vi.doMock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
  const { serveJobs } = await import("@/jobs/client");
  (await import("@/jobs/job-days")).setJobDaysStore(store);
  return serveJobs([definition]);
}

/** Delivers a run until it finishes, handing back each step's answer as the platform does; every answer kept. */
async function run(handler: Awaited<ReturnType<typeof served>>, fnSlug: string, event: { name: string; data: unknown }) {
  const steps: Record<string, unknown> = {};
  const answers: { status: number; body: string }[] = [];
  for (let invocation = 0; invocation < 10; invocation += 1) {
    const stack = Object.keys(steps);
    const ctx = { run_id: `run-${fnSlug}`, attempt: 0, disable_immediate_execution: false, use_api: false, stack: { stack, current: Math.max(0, stack.length - 1) } };
    const request = new NextRequest(`https://app.example.com/api/jobs?fnId=reachkit-${fnSlug}&stepId=step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, event: { ...event, ts: Date.now() }, events: [], steps, ctx }),
    });
    const response = await handler.POST(request, { params: Promise.resolve({}) });
    const body = await response.text();
    // The SDK stamps each step with when it ran, which no two runs share.
    answers.push({ status: response.status, body: body.replace(/"timing":\{[^}]*\}/g, "") });
    if (response.status !== 206) break;
    for (const op of JSON.parse(body) as { id: string; data?: unknown }[]) steps[op.id] = { type: "data", data: op.data ?? null };
  }
  await new Promise((resolve) => setTimeout(resolve, 0)); // the writes started after each answer settle
  return answers;
}

let warned: string[] = [];

beforeEach(() => {
  db.reset();
  warned = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => void warned.push(String(line)));
});

afterEach(() => {
  vi.doUnmock("@/lib/db");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("job_days — every invocation counted once, under its job, day and site", () => {
  it("a per-site run of three steps is four invocations of its job for that site; the tick's own row has no site", async () => {
    const adds: JobDayAdd[] = [];
    const handler = await served(async (add) => void adds.push(add));

    const answers = await run(handler, "weekly-refresh-subject", SUBJECT);
    await run(handler, "weekly-refresh", TICK);

    expect(answers.map((answer) => answer.status)).toEqual([206, 206, 206, 200]);
    const day = new Date().toISOString().slice(0, 10);
    const counted = (siteId: string | null) => adds.filter((add) => add.jobId === "weekly/refresh" && add.day === day && add.siteId === siteId);
    expect(counted(SITE)).toHaveLength(4);
    expect(counted(null)).toHaveLength(1);
    expect(adds).toHaveLength(5);
    expect(adds.every((add) => add.cpuMs >= 0 && add.wallMs >= 0)).toBe(true);
  });

  it("a store that throws leaves every answer and status as an unmeasured run gives them, and logs the failure", async () => {
    const unmeasured = await run(await served(async () => {}), "weekly-refresh-subject", SUBJECT);
    vi.resetModules();
    db.reset();

    const failing = await run(await served(async () => Promise.reject(new Error("database unreachable"))), "weekly-refresh-subject", SUBJECT);

    expect(failing).toEqual(unmeasured);
    const failures = warned.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => line.event === "job_days");
    expect(failures).toHaveLength(4);
    expect(failures[0]).toMatchObject({ event: "job_days", outcome: "record-failed" });
  });
});
