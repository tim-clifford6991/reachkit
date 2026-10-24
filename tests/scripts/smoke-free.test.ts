// The free smoke check run against local stub deployments: it passes a
// healthy one, names the step a broken one fails, and never sends a POST.
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy/copy";
import fixture from "../app/library/old-paths.json";

type Expected = { status: number; location?: string };
const PATHS = fixture.paths as Record<string, Expected>;
const ROOT = path.resolve(import.meta.dirname, "../..");
const run = promisify(execFile);

const LANDING = '<form action="/api/scan"><input name="value"><button type="submit">Go</button></form>';
const NEWEST = "newest.example";
const LISTING = `<a href="/scan/${NEWEST}">Newest</a><a href="/scan/older.example">Older</a>`;
const INCOMPLETE = copy("notice.incomplete", { what: "the market" });

type Faults = { health?: number; report?: string; listing?: string };

const methods: string[] = [];
const servers: Server[] = [];

/** A deployment that answers like a healthy one, except where `faults` says. */
async function stub(faults: Faults = {}): Promise<string> {
  const server = createServer((req, res) => {
    methods.push(req.method ?? "");
    const pathname = new URL(req.url ?? "/", "http://stub").pathname;
    if (req.method !== "GET") return void res.writeHead(405).end();
    if (pathname === "/api/health") return void res.writeHead(faults.health ?? 200).end("{}");
    if (pathname === "/scans") return void res.writeHead(200).end(faults.listing ?? LISTING);
    if (pathname === `/scan/${NEWEST}`) return void res.writeHead(200).end(faults.report ?? "<h1>Report</h1>");
    const expected = PATHS[pathname];
    if (expected === undefined) return void res.writeHead(404).end();
    res.writeHead(expected.status, expected.location ? { location: expected.location } : {});
    res.end(pathname === "/" ? LANDING : "");
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** `smoke.sh --free` against `origin`, with its exit code and output. */
async function free(origin: string) {
  const env = { ...process.env, SMOKE_BASE_URL: origin, SMOKE_HOSTED_URL: "" };
  try {
    const { stdout, stderr } = await run("bash", ["scripts/smoke.sh", "--free"], { cwd: ROOT, env });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("smoke.sh --free walks the visitor's chain without spending", () => {
  it("passes a healthy deployment, reading the newest listed report", async () => {
    const r = await free(await stub());
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain(`/scan/${NEWEST}, the newest listed`);
    expect(r.code).toBe(0);
  });

  it("fails at health when /api/health answers 503", async () => {
    const r = await free(await stub({ health: 503 }));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^FAIL health .*answered 503/m);
  });

  it("fails at report when the newest report is incomplete", async () => {
    const r = await free(await stub({ report: `<p>${INCOMPLETE}</p>` }));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^FAIL report .*incomplete notice/m);
  });

  it("fails at report when the gallery lists no report", async () => {
    const r = await free(await stub({ listing: "<p>Nothing yet</p>" }));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^FAIL report .*lists no report/m);
  });

  it("refuses a domain beside --free", async () => {
    const env = { ...process.env, SMOKE_BASE_URL: await stub() };
    await expect(run("bash", ["scripts/smoke.sh", "--free", "example.com"], { cwd: ROOT, env })).rejects.toMatchObject({ code: 2 });
  });

  it("sends only GETs, so it starts no scan", () => {
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.filter((m) => m !== "GET")).toEqual([]);
  });
});
