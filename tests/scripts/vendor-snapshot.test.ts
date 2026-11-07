// The hourly snapshot's Vercel Active CPU, driven on a network double, a clock double and a scratch state file:
// no vendor is called, no mail is sent and the box's own files are not touched.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkBudget, readCharges, takeSnapshot, vercelReading } from "../../scripts/vendor-snapshot.mjs";

type Mail = { from: string; to: string[]; subject: string; text: string };
type Reading = ReturnType<typeof vercelReading>;

const FIXTURE = readFileSync(path.join(import.meta.dirname, "fixtures/vercel-charges.jsonl"), "utf8");
const NOW = new Date("2026-11-10T12:00:00.000Z");
const TOKEN = "vercel-token-test";
const DB = { SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_ROLE_KEY: "service-role-test" };
const MAIL = { RESEND_API_KEY: "re_test", MAIL_FROM: "alerts@reachkit.app", OWNER_EMAILS: "a@example.com, b@example.com" };

let vercelAnswer: Response;
let siteCount: number;
let requests: { url: string; init?: RequestInit }[];
let mails: Mail[];
let dir: string;

beforeEach(() => {
  vercelAnswer = new Response(FIXTURE, { status: 200, headers: { "content-type": "application/jsonl" } });
  siteCount = 4;
  requests = [];
  mails = [];
  dir = mkdtempSync(path.join(tmpdir(), "cpu-budget-"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      requests.push({ url, init });
      if (url.startsWith("https://api.resend.com/")) {
        mails.push(JSON.parse(String(init?.body)) as Mail);
        return Response.json({ id: "m1" });
      }
      if (url.startsWith("https://api.vercel.com/")) return vercelAnswer;
      if (url.startsWith(`${DB.SUPABASE_URL}/rest/v1/sites`)) return new Response(null, { status: 206, headers: { "content-range": `0-0/${siteCount}` } });
      throw new Error(`unexpected request ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

const vercelProblems = (problems: string[]) => problems.filter((p) => /vercel/i.test(p));

describe("Vercel's FOCUS charges as Active CPU-seconds a UTC day", () => {
  it("sums team and reachkit CPU and the invocations by day, ignores other rows, and leaves a day with no row absent", () => {
    const days = readCharges(FIXTURE);
    expect(days["2026-11-01"]).toEqual({ cpuSeconds: 2160, projectCpuSeconds: 1800, invocations: 1000 });
    expect(days["2026-11-03"]).toEqual({ cpuSeconds: 720, projectCpuSeconds: 720, invocations: 700 });
    // Memory, bandwidth and the plan purchase feed nothing.
    expect(days["2026-11-09"]).toEqual({ cpuSeconds: 720, projectCpuSeconds: 540, invocations: 500 });
    expect(days).not.toHaveProperty("2026-11-06");

    const reading = vercelReading(days, NOW);
    expect(Object.keys(reading.days)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-07", "2026-11-08", "2026-11-09"]);
    expect(reading.month).toBe("2026-11");
    expect(reading.monthToDate).toEqual({ cpuSeconds: 8892, projectCpuSeconds: 7560, invocations: 6100 });
  });

  it("fails the read on a CPU row in a unit it does not know, rather than miscount it", () => {
    const row = JSON.parse(FIXTURE.split("\n")[0]!);
    expect(() => readCharges(JSON.stringify({ ...row, ConsumedUnit: "credits" }))).toThrow(/unknown unit/);
  });

  it("asks for the team's charges from the month's first day to tomorrow, with the CLI token, and keeps them on the line", async () => {
    const { row, problems } = await takeSnapshot({ VERCEL_TOKEN: TOKEN }, NOW);
    const asked = requests.find((r) => r.url.startsWith("https://api.vercel.com/"))!;
    const url = new URL(asked.url);
    expect(url.pathname).toBe("/v1/billing/charges");
    expect(url.searchParams.get("teamId")).toBe("team_lFEcKlyuKD5risdEnak7iRIm");
    expect(url.searchParams.get("from")).toBe("2026-11-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-11-11T00:00:00.000Z");
    expect(new Headers(asked.init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(row.vercel?.monthToDate.cpuSeconds).toBe(8892);
    expect(vercelProblems(problems)).toEqual([]);
  });
});

describe("a Vercel read that fails is left out, never zeroed", () => {
  it("on 404 costs_not_found the line carries no vercel and one line says why, without the token", async () => {
    vercelAnswer = Response.json({ error: { code: "costs_not_found", message: "No costs found" } }, { status: 404 });
    const { row, problems } = await takeSnapshot({ VERCEL_TOKEN: TOKEN, ...DB }, NOW);
    expect(row).not.toHaveProperty("vercel");
    expect(vercelProblems(problems)).toEqual(["Vercel's billing charges could not be read: HTTP 404 costs_not_found"]);
    expect(problems.join("\n")).not.toContain(TOKEN);
    // Nothing to divide, so the sites are not counted either.
    expect(requests.some((r) => r.url.startsWith(DB.SUPABASE_URL))).toBe(false);
  });
});

describe("a per-site figure where the database key exists", () => {
  it("divides yesterday's reachkit CPU by the sites the daily tick runs for", async () => {
    const { row } = await takeSnapshot({ VERCEL_TOKEN: TOKEN, ...DB }, NOW);
    expect(row.vercel).toMatchObject({ sitesOnAutopilot: 4, cpuSecondsPerSite: 135 });
    const counted = new URL(requests.find((r) => r.url.startsWith(DB.SUPABASE_URL))!.url);
    expect(counted.searchParams.get("publishing_enabled")).toBe("eq.true");
  });

  it("without the key, both are absent", async () => {
    const { row } = await takeSnapshot({ VERCEL_TOKEN: TOKEN }, NOW);
    expect(Object.keys(row.vercel!)).toEqual(["days", "month", "monthToDate"]);
  });
});

describe("the owner is mailed before the 4 CPU-hour month runs out, at most four times a month", () => {
  const BUDGET = 4 * 3600;
  const reading = (month: string, cpuSeconds: number, days: Reading["days"] = {}): Reading => ({ days, month, monthToDate: { cpuSeconds } });

  it("mails once per level per month, and a new month starts again", async () => {
    const statePath = path.join(dir, "state", "cpu-budget.json");
    const hour = (now: string, r: Reading) => checkBudget({ reading: r, keys: MAIL, now: new Date(now), statePath });

    await hour("2026-11-10T12:00:00Z", reading("2026-11", 0.49 * BUDGET));
    expect(mails).toHaveLength(0);
    await hour("2026-11-10T13:00:00Z", reading("2026-11", 0.51 * BUDGET));
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe("Vercel Active CPU has passed 50% of this month's budget");
    expect(mails[0]!.to).toEqual(["a@example.com", "b@example.com"]);
    await hour("2026-11-10T14:00:00Z", reading("2026-11", 0.51 * BUDGET));
    expect(mails).toHaveLength(1);
    await hour("2026-11-11T09:00:00Z", reading("2026-11", 0.81 * BUDGET));
    expect(mails.map((m) => m.subject.match(/\d+%/)![0])).toEqual(["50%", "80%"]);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ month: "2026-11", levels: [50, 80], projected: false });

    await hour("2026-12-02T09:00:00Z", reading("2026-12", 0.51 * BUDGET));
    expect(mails.map((m) => m.subject.match(/\d+%/)![0])).toEqual(["50%", "80%", "50%"]);
  });

  it("mails once when the last three days' mean projects past the budget, with the figure, the budget, the projection and the share", async () => {
    const statePath = path.join(dir, "cpu-budget.json");
    // 10 November: 3,000 CPU-seconds so far, 600 a day, 20 days left: 15,000 > 14,400.
    const days = { "2026-11-07": { cpuSeconds: 600 }, "2026-11-08": { cpuSeconds: 600 }, "2026-11-09": { cpuSeconds: 600 } };
    const r: Reading = { days, month: "2026-11", monthToDate: { cpuSeconds: 3000, projectCpuSeconds: 2700 } };
    await checkBudget({ reading: r, keys: MAIL, now: NOW, statePath });
    await checkBudget({ reading: r, keys: MAIL, now: new Date("2026-11-10T13:00:00Z"), statePath });
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe("Vercel Active CPU is on course to pass this month's budget");
    expect(mails[0]!.text).toContain("0.83 CPU-hours, 21% of the 4 CPU-hour monthly budget");
    expect(mails[0]!.text).toContain("The reachkit project's share: 0.75 CPU-hours (90%)");
    expect(mails[0]!.text).toContain("the month ends at 4.17 CPU-hours (104%)");
  });

  it("says not measured, never 0, for a share or a projection it could not read", async () => {
    await checkBudget({ reading: reading("2026-11", 0.51 * BUDGET), keys: MAIL, now: NOW, statePath: path.join(dir, "s.json") });
    expect(mails[0]!.text).toContain("The reachkit project's share: not measured.");
    expect(mails[0]!.text).toContain("a figure not measured");
    expect(mails[0]!.text).not.toMatch(/\b0\.00 CPU-hours/);
  });

  it("does not mark a level Resend did not accept, so the next hour tries again", async () => {
    const statePath = path.join(dir, "s.json");
    const said = await checkBudget({ reading: reading("2026-11", 0.51 * BUDGET), keys: {}, now: NOW, statePath });
    expect(said[0]).toMatch(/^not mailed/);
    expect(JSON.parse(readFileSync(statePath, "utf8")).levels).toEqual([]);
  });
});
