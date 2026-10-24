// The old-address check run against local stub deployments, alone and as a
// step of the production smoke check, so a deploy that turns a listed address
// into a 404 is refused by name.
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fixture from "../app/library/old-paths.json";

type Expected = { status: number; location?: string };
const PATHS = fixture.paths as Record<string, Expected>;
const COUNT = Object.keys(PATHS).length;
const ROOT = path.resolve(import.meta.dirname, "../..");
const run = promisify(execFile);

// The listed page the broken deployment serves as a 404.
const BROKEN = Object.keys(PATHS).find((p) => p !== "/" && PATHS[p]!.status === 200)!;
const LANDING = '<form action="/api/scan"><input name="value"><button type="submit">Go</button></form>';

/** A deployment answering every listed address as listed, except `broken`. */
async function stub(broken?: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://stub").pathname;
    const expected = PATHS[pathname];
    // The scan start is refused, so a smoke run stops right after the free steps.
    if (req.method !== "GET" || expected === undefined || pathname === broken) {
      res.writeHead(req.method === "POST" ? 503 : 404).end();
      return;
    }
    res.writeHead(expected.status, expected.location ? { location: expected.location } : {});
    res.end(pathname === "/" ? LANDING : "");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/** Runs a command, resolving with its exit code and output instead of throwing. */
async function exec(file: string, args: string[], env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await run(file, args, { cwd: ROOT, env: { ...process.env, ...env } });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

const smoke = (origin: string) =>
  exec("bash", ["scripts/smoke.sh"], { SMOKE_BASE_URL: origin, SMOKE_HOSTED_URL: "" });

let good: Awaited<ReturnType<typeof stub>>;
let bad: Awaited<ReturnType<typeof stub>>;

beforeAll(async () => {
  [good, bad] = await Promise.all([stub(), stub(BROKEN)]);
});

afterAll(async () => {
  await Promise.all([good, bad].map(({ server }) => new Promise((resolve) => server.close(resolve))));
});

describe("every deploy checks the old addresses", () => {
  it("passes a deployment that answers every listed address as listed", async () => {
    const r = await exec(process.execPath, ["scripts/old-paths.mjs", good.origin]);
    expect(r.stdout).toContain(`${COUNT} of ${COUNT} as listed`);
    expect(r.code).toBe(0);
  });

  it("the smoke passes the step with its path count and walks on to the scan", async () => {
    const r = await smoke(good.origin);
    expect(r.stdout).toContain(`old-paths              ${COUNT} of ${COUNT} as listed`);
    expect(r.stderr).toMatch(/^FAIL scan-start/m);
  });

  it("the smoke stops at the step and names the address that does not hold", async () => {
    const r = await smoke(bad.origin);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(`FAIL old-paths`);
    expect(r.stderr).toContain(`${BROKEN}  want 200  got 404`);
    expect(r.stderr).not.toContain("scan-start");
  });
});
