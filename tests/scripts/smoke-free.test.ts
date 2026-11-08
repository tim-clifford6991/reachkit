// The free smoke check run against local stub deployments: it passes a
// healthy one, names the step a broken one fails, and never sends a POST.
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createServer as createTlsServer } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { FIRST_BYTE_BUDGET_MS as BUDGET } from "@/lib/config/constants";
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

type Faults = {
  health?: number;
  report?: string;
  listing?: string;
  /** Hold `path`'s first answer `cold` ms and each later one `warm` ms. */
  slow?: { path: string; cold?: number; warm?: number };
  /** The landing answers 500 from this request of `/` on. */
  landingFailsFrom?: number;
};

const methods: string[] = [];
const servers: Server[] = [];
/** Each stub's request paths, in the order it saw them. */
const seen = new Map<string, string[]>();

function handler(faults: Faults, paths: string[]) {
  return (req: IncomingMessage, res: ServerResponse) => {
    methods.push(req.method ?? "");
    const pathname = new URL(req.url ?? "/", "http://stub").pathname;
    paths.push(pathname);
    const nth = paths.filter((p) => p === pathname).length;
    const hold = faults.slow?.path === pathname ? ((nth === 1 ? faults.slow.cold : faults.slow.warm) ?? 0) : 0;
    setTimeout(() => answer(req, res, pathname, nth, faults), hold);
  };
}

function answer(req: IncomingMessage, res: ServerResponse, pathname: string, nth: number, faults: Faults): void {
  if (req.method !== "GET") return void res.writeHead(405).end();
  if (pathname === "/api/health") return void res.writeHead(faults.health ?? 200).end("{}");
  if (pathname === "/signin") return void res.writeHead(200).end("<h1>Sign in</h1>");
  if (pathname === "/app") return void res.writeHead(307, { location: "/signin" }).end();
  if (pathname === "/" && nth >= (faults.landingFailsFrom ?? Infinity)) return void res.writeHead(500).end();
  if (pathname === "/scans") return void res.writeHead(200).end(faults.listing ?? LISTING);
  if (pathname === `/scan/${NEWEST}`) return void res.writeHead(200).end(faults.report ?? "<h1>Report</h1>");
  const expected = PATHS[pathname];
  if (expected === undefined) return void res.writeHead(404).end();
  res.writeHead(expected.status, expected.location ? { location: expected.location } : {});
  res.end(pathname === "/" ? LANDING : "");
}

async function listen(server: Server, origin: (port: number) => string, paths: string[]): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const at = origin((server.address() as AddressInfo).port);
  seen.set(at, paths);
  return at;
}

/** A deployment that answers like a healthy one, except where `faults` says. */
async function stub(faults: Faults = {}): Promise<string> {
  const paths: string[] = [];
  return listen(createServer(handler(faults, paths)), (port) => `http://127.0.0.1:${port}`, paths);
}

const PRODUCTION = "https://reachkit.app";

/** The same stub answering as `https://reachkit.app`: curl is pointed at it by
 *  a `.curlrc` (`connect-to`) and old-paths' fetch by a preload, and the content
 *  host is a local one, so the script's own production test is what is exercised
 *  and nothing reaches the real hosts. Returns the env that routes it and the paths the stub saw. */
async function production(faults: Faults = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "smoke-prod-"));
  const key = path.join(dir, "key.pem");
  const cert = path.join(dir, "cert.pem");
  await run("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=reachkit.app"]);
  const paths: string[] = [];
  const server = createTlsServer({ key: readFileSync(key), cert: readFileSync(cert) }, handler(faults, paths));
  const at = await listen(server as unknown as Server, (port) => `127.0.0.1:${port}`, paths);
  writeFileSync(path.join(dir, ".curlrc"), `connect-to = "reachkit.app:443:${at}"\ninsecure\n`);
  const preload = path.join(dir, "fetch-to-stub.mjs");
  writeFileSync(preload, `const real = globalThis.fetch;\nglobalThis.fetch = (url, init) => real(String(url).replace("${PRODUCTION}", "https://${at}"), init);\n`);
  const env = { CURL_HOME: dir, NODE_OPTIONS: `--import ${pathToFileURL(preload).href}`, NODE_TLS_REJECT_UNAUTHORIZED: "0", SMOKE_HOSTED_URL: await hosted() };
  return { env, paths };
}

const ARTICLE = '<!doctype html><html lang="en-US"><head><link rel="stylesheet" href="/style.css"></head><body><script type="application/ld+json">{}</script></body></html>';

/** A content host whose index features one article, answered as `article`. */
async function hosted(article = ARTICLE): Promise<string> {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://stub").pathname;
    if (pathname === "/") return void res.writeHead(200).end('<section aria-labelledby="featured"><a href="/a-page">A page</a></section>');
    if (pathname === "/a-page") return void res.writeHead(200).end(article);
    res.writeHead(404).end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** `smoke.sh --free` against `origin`, with its exit code and output. */
async function free(origin: string, hostedUrl = "", extra: Record<string, string> = {}) {
  const env = { ...process.env, SMOKE_BASE_URL: origin, SMOKE_HOSTED_URL: hostedUrl, ...extra };
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

  it("times the five routes cold before it fetches anything else, then warm", async () => {
    const origin = await stub();
    const r = await free(origin);
    expect(seen.get(origin)?.slice(0, 5)).toEqual(["/", "/pricing", "/signin", "/app", "/api/health"]);
    expect(seen.get(origin)?.slice(5, 20)).toEqual(["/", "/pricing", "/signin", "/app", "/api/health"].flatMap((p) => [p, p, p]));
    expect(r.stdout).toMatch(/^ok {3}cold +\/ \d+ms · \/pricing \d+ms · \/signin \d+ms · \/app \d+ms · \/api\/health \d+ms$/m);
    expect(r.stdout).not.toMatch(/^WARN/m);
    expect(r.code).toBe(0);
  });

  it("is red at cold on production when the first answer on / is past its budget", async () => {
    const prod = await production({ slow: { path: "/", cold: BUDGET.coldLandingMs + 200 } });
    const r = await free(PRODUCTION, "", prod.env);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(new RegExp(`^FAIL cold +/ \\d+ms > ${BUDGET.coldLandingMs}ms cold$`, "m"));
    expect(prod.paths.slice(0, 5)).toEqual(["/", "/pricing", "/signin", "/app", "/api/health"]);
  });

  it("is red at cold on production when a route's warm answers are past its budget", async () => {
    const prod = await production({ slow: { path: "/signin", warm: BUDGET.warmPageMs + 100 } });
    const r = await free(PRODUCTION, "", prod.env);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(new RegExp(`^FAIL cold +/signin \\d+ms > ${BUDGET.warmPageMs}ms warm`, "m"));
  });

  it("names a cold miss on production first, walks every later step, then exits 1", async () => {
    const prod = await production({ slow: { path: "/api/health", cold: BUDGET.coldHealthMs + 200 } });
    const r = await free(PRODUCTION, "", prod.env);
    for (const step of ["landing", "old-paths", "hosted", "health", "report"]) expect(r.stdout).toMatch(new RegExp(`^ok {3}${step} `, "m"));
    expect(prod.paths).toContain(`/scan/${NEWEST}`);
    // The deployer's own reading: the exit status and the first FAIL line.
    expect(r.stderr.match(/^FAIL.*$/gm)).toEqual([expect.stringMatching(new RegExp(`^FAIL cold +/api/health \\d+ms > ${BUDGET.coldHealthMs}ms cold$`))]);
    expect(r.code).toBe(1);
  });

  it("still fails and prints a later step's own failure after a cold miss on production", async () => {
    const prod = await production({ slow: { path: "/", cold: BUDGET.coldLandingMs + 200 }, landingFailsFrom: 5 });
    const r = await free(PRODUCTION, "", prod.env);
    const fails = r.stderr.match(/^FAIL.*$/gm) ?? [];
    expect(fails[0]).toMatch(/^FAIL cold /);
    expect(fails[1]).toMatch(/^FAIL landing .*answered 500/);
    expect(r.code).toBe(1);
  });

  it("passes cold on production under budget and walks on", async () => {
    const prod = await production({ landingFailsFrom: 5 });
    const r = await free(PRODUCTION, "", prod.env);
    expect(r.stdout).toMatch(/^ok {3}cold /m);
    expect(r.stderr).toMatch(/^FAIL landing .*answered 500/m);
  });

  it("only warns, and passes, over budget on any other base", async () => {
    const r = await free(await stub({ slow: { path: "/", cold: BUDGET.coldLandingMs + 200 } }));
    expect(r.stdout).toMatch(new RegExp(`^WARN cold +/ \\d+ms > ${BUDGET.coldLandingMs}ms cold$`, "m"));
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
  });

  it("reads every budget of the cold step from the pins", () => {
    const script = readFileSync(path.join(ROOT, "scripts/smoke.sh"), "utf8");
    const step = script.slice(script.indexOf("# ── 0. cold"), script.indexOf("# ── 1. landing"));
    expect(step).toContain("pin coldLandingMs");
    // The only numbers left are status codes, curl's timeout in seconds and seconds → ms.
    expect(new Set(step.match(/\b\d{2,}\b/g))).toEqual(new Set(["200", "307", "30", "1000"]));
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

  it("passes a cached article that is its HTML and its sheet", async () => {
    const r = await free(await stub(), await hosted());
    expect(r.stdout).toMatch(/^ok {3}hosted .*\/a-page/m);
    expect(r.code).toBe(0);
  });

  it.each([
    ["a script with a src", '<script src="/_next/static/chunks/a.js"></script>', /ships a <script src>/],
    ["React flight data", "<script>(self.__next_f=self.__next_f||[]).push([0])</script>", /ships React flight data/],
  ])("fails at hosted when the cached article carries %s", async (_, extra, message) => {
    const r = await free(await stub(), await hosted(ARTICLE.replace("</body>", `${extra}</body>`)));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(new RegExp(`^FAIL hosted .*${message.source}`, "m"));
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
