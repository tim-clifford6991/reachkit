// The box's outside clock, driven on a network double and a clock double:
// what counts as down, when the owner is mailed, and what happens when the mail itself fails.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUE_TITLE, TARGETS, probe, run } from "../../scripts/deadman.mjs";

type Answer = { status: number; body?: unknown } | Error;
type Mail = { from: string; to: string[]; subject: string; text: string };

const MIN = 60_000;
const [HOME, HEALTH] = TARGETS as [string, string, string];
const ENV = { RESEND_API_KEY: "re_test", MAIL_FROM: "alerts@reachkit.app", OWNER_EMAILS: "a@example.com, b@example.com" };

let answers: Record<string, Answer>;
let resendStatus: number;
let mails: Mail[];
let requests: { url: string; init?: RequestInit }[];
let dir: string;

beforeEach(() => {
  answers = {};
  resendStatus = 200;
  mails = [];
  requests = [];
  dir = mkdtempSync(path.join(tmpdir(), "deadman-"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://api.resend.com/")) {
        mails.push(JSON.parse(String(init?.body)) as Mail);
        return resendStatus === 200
          ? Response.json({ id: "m1" })
          : Response.json({ name: "application_error", message: "down" }, { status: resendStatus });
      }
      requests.push({ url, init });
      const answer = answers[url] ?? { status: 200, body: { ok: true } };
      if (answer instanceof Error) throw answer;
      return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), { status: answer.status });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

/** A `gh` double that keeps the issues it was asked to open. */
const mail = (i: number) => mails[i] as Mail;

function ghDouble() {
  const issues: { number: number; title: string }[] = [];
  const calls: string[][] = [];
  const gh = (args: string[]) => {
    calls.push(args);
    if (args[1] === "list") return { ok: true, stdout: JSON.stringify(issues) };
    if (args[1] === "create") issues.push({ number: 7, title: args[args.indexOf("--title") + 1] ?? "" });
    return { ok: true, stdout: "" };
  };
  return { gh, calls };
}

function box(gh = ghDouble().gh) {
  const lines: Record<string, unknown>[] = [];
  const statePath = path.join(dir, "state", "deadman.json");
  const once = (now: number, argv: string[] = []) =>
    run({ argv, env: ENV, now, statePath, gh, log: (line: string) => lines.push(JSON.parse(line)) });
  return { once, lines, statePath };
}

describe("probe", () => {
  it("is up only on a 2xx, a GET that does not follow redirects", async () => {
    answers[HOME] = { status: 200 };
    expect(await probe(HOME)).toMatchObject({ up: true, status: 200 });
    expect(requests[0]?.init).toMatchObject({ redirect: "manual" });
    expect(requests[0]?.init?.method ?? "GET").toBe("GET");
  });

  it.each([402, 503, 307])("is down on %i, with the status", async (status) => {
    answers[HEALTH] = { status };
    expect(await probe(HEALTH)).toMatchObject({ up: false, status });
  });

  it("is down on a timeout and on a thrown TypeError, with the error class", async () => {
    answers[HOME] = new DOMException("timed out", "TimeoutError");
    expect(await probe(HOME)).toEqual({ url: HOME, up: false, error: "timeout" });
    answers[HOME] = new TypeError("fetch failed");
    expect(await probe(HOME)).toEqual({ url: HOME, up: false, error: "TypeError" });
    answers[HOME] = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    expect(await probe(HOME)).toEqual({ url: HOME, up: false, error: "ENOTFOUND" });
  });

  it("records the stale jobs /api/health names, and the mail says them", async () => {
    answers[HEALTH] = { status: 503, body: { ok: false, stale: ["scan/rescore"] } };
    expect(await probe(HEALTH)).toMatchObject({ up: false, status: 503, stale: ["scan/rescore"] });
    const { once } = box();
    await once(0);
    await once(2 * MIN);
    expect(mails).toHaveLength(1);
    expect(mail(0).text).toContain(HEALTH);
    expect(mail(0).text).toContain("stale jobs scan/rescore");
  });
});

describe("one mail per outage", () => {
  it("sends nothing for one failed probe followed by a 2xx", async () => {
    const { once } = box();
    answers[HOME] = { status: 402 };
    await once(0);
    delete answers[HOME];
    await once(2 * MIN);
    expect(mails).toHaveLength(0);
  });

  it("mails after two failures, reminds after six hours, and says when it is back and for how long", async () => {
    const { once, lines } = box();
    answers[HOME] = { status: 402 };
    await once(0);
    await once(2 * MIN);
    expect(mails).toHaveLength(1);
    expect(mail(0)).toMatchObject({ from: ENV.MAIL_FROM, to: ["a@example.com", "b@example.com"] });
    expect(mail(0).subject).toMatch(/down/);
    expect(lines.at(-1)).toMatchObject({ event: "deadman", outcome: "mailed" });

    for (let t = 4 * MIN; t <= 2 * MIN + 6 * 60 * MIN; t += 2 * MIN) await once(t);
    expect(mails).toHaveLength(2);
    expect(mail(1).subject).toMatch(/still down/);

    delete answers[HOME];
    await once(2 * MIN + 6 * 60 * MIN + 2 * MIN);
    expect(mails).toHaveLength(3);
    expect(mail(2).subject).toBe("ReachKit is back up");
    expect(mail(2).text).toContain(`${HOME}: down for 6h 4m`);

    await once(2 * MIN + 6 * 60 * MIN + 4 * MIN);
    expect(mails).toHaveLength(3);
  });

  it("names every target down in the same probe in one mail", async () => {
    const { once } = box();
    for (const url of TARGETS) answers[url] = { status: 402 };
    await once(0);
    await once(2 * MIN);
    expect(mails).toHaveLength(1);
    for (const url of TARGETS) expect(mail(0).text).toContain(url);
  });

  it("logs no credential", async () => {
    const { once, lines } = box();
    answers[HOME] = { status: 402 };
    await once(0);
    await once(2 * MIN);
    const logged = JSON.stringify(lines);
    for (const value of Object.values(ENV)) expect(logged).not.toContain(value);
  });
});

describe("when the mail fails", () => {
  it("opens one issue, then comments on it", async () => {
    resendStatus = 500;
    const { gh, calls } = ghDouble();
    const { once, lines } = box(gh);
    answers[HOME] = { status: 402 };
    await once(0);
    await once(2 * MIN);
    expect(lines.at(-1)).toMatchObject({ event: "deadman", outcome: "mail-failed" });
    const created = calls.filter((c) => c[1] === "create");
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual(expect.arrayContaining(["--title", ISSUE_TITLE]));

    await once(2 * MIN + 6 * 60 * MIN);
    expect(calls.filter((c) => c[1] === "create")).toHaveLength(1);
    expect(calls.filter((c) => c[1] === "comment").map((c) => c[2])).toEqual(["7"]);
  });
});

describe("--test-mail", () => {
  it("sends one test mail, probes nothing and writes no state", async () => {
    const { once, statePath } = box();
    expect(await once(0, ["--test-mail"])).toBe(0);
    expect(mails).toHaveLength(1);
    expect(mail(0).subject).toMatch(/test/);
    expect(requests).toHaveLength(0);
    expect(existsSync(statePath)).toBe(false);
  });
});
