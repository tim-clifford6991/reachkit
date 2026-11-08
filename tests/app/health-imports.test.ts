// tests/app/health-imports.test.ts
//
// `local/health-imports`, linted through the repo's real `eslint.config.mjs`: `/api/health` loads no job definition,
// and `heartbeat.ts` and `schedule.ts` reach the database or the mail only by `import()` inside the store's functions.
import path from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const RULE = "local/health-imports";
const ROUTE = "src/app/api/health/route.ts";
const HEARTBEAT = "src/jobs/heartbeat.ts";
const SCHEDULE = "src/jobs/schedule.ts";
/** The first `ESLint` in a worker resolves the whole flat config; that toolchain start-up is what this bounds. */
const ESLINT_BOOT_MS = 30_000;

async function fenced(source: string, filePath: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE).map((m) => m.message);
}

const LIGHT_ROUTE = [
  'import { jobsHealth, scheduleOf } from "@/jobs/heartbeat";',
  'import { CRON_JOBS } from "@/jobs/schedule";',
  'import { adapter } from "../_adapter";',
  'export const GET = adapter("/api/health", async () => Response.json(await jobsHealth(scheduleOf(CRON_JOBS), new Date())));',
  "",
].join("\n");

beforeAll(async () => {
  await fenced("export const warmUp = true;\n", ROUTE);
}, 60_000);

describe("/api/health loads no job definition", () => {
  it("allows the route that reads the light schedule", async () => {
    expect(await fenced(LIGHT_ROUTE, ROUTE)).toEqual([]);
  }, ESLINT_BOOT_MS);

  it("refuses the registry, the engine, the client and a job file in the route", async () => {
    for (const spec of ["@/jobs", "@/jobs/engine", "@/jobs/client", "@/jobs/scan-run"]) {
      const messages = await fenced(`import { x } from "${spec}";\nexport const y = x;\n`, ROUTE);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(ROUTE);
      expect(messages[0]).toContain(spec);
    }
  }, ESLINT_BOOT_MS);

  it("refuses a top-level database import in heartbeat.ts, and allows it inside the store's client", async () => {
    expect(await fenced('import { dbAdmin } from "@/lib/db";\nexport const d = dbAdmin;\n', HEARTBEAT)).toHaveLength(1);
    const lazy = 'async function readClient() {\n  const { dbAdminRest } = await import("@/lib/db/rest");\n  return dbAdminRest();\n}\nexport const r = readClient;\n';
    expect(await fenced(lazy, HEARTBEAT)).toEqual([]);
    const atTop = 'export async function jobsHealth() {\n  await import("@/lib/db/rest");\n}\n';
    expect(await fenced(atTop, HEARTBEAT)).toHaveLength(1);
  }, ESLINT_BOOT_MS);

  it("allows only type imports in schedule.ts", async () => {
    expect(await fenced('import type { JobDefinition } from "./types";\nexport type D = JobDefinition;\n', SCHEDULE)).toEqual([]);
    expect(await fenced('import { MAINTENANCE_CRON } from "./account-maintenance";\nexport const c = MAINTENANCE_CRON;\n', SCHEDULE)).toHaveLength(1);
  }, ESLINT_BOOT_MS);

  it("holds on this branch's three files", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const results = await eslint.lintFiles([ROUTE, HEARTBEAT, SCHEDULE].map((file) => path.join(ROOT, file)));
    expect(results.flatMap((r) => r.messages).filter((m) => m.ruleId === RULE)).toEqual([]);
  }, ESLINT_BOOT_MS);
});
