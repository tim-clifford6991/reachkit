// Issue #318 — §16 milestone 4's live check, and the three facts it is
// stated in.
//
// `scripts/live/m4-check.sh` cannot be run here: it reads a real
// deployment's database and writes a real lead against a real report,
// which is what makes it a live check rather than a test. What *can* be
// held honest before the owner runs it is everything that would make the
// run report a wrong answer, and every one of those is in this file:
//
//  1. **The bounds are the product's own.** `BATTERY.QUESTIONS`,
//     `NURTURE_H`, `NURTURE_MAX_TOUCHES`, `SEQUENCE_START_DEADLINE_DAYS`
//     and `FIRST_PAGE_RETRY_WINDOW_H` are read out of
//     `src/lib/config/constants.ts` at run time rather than copied
//     (ARCHITECTURE rule 5). A rename or a second definition must stop the
//     script, not silently measure against a number nobody pinned.
//  2. **The owed copy is the registry's own answer.** The script reads the
//     mail partition as text; that reading is asserted equal to
//     `OWNER_OWED`, and — the assertion that matters — the keys it names
//     for a kind are the keys `sendEmail` actually refuses on. A script
//     that named the wrong key would send the owner to write a sentence
//     that unblocks nothing, which is the whole failure mode of reporting
//     `not-composable` without naming its cause.
//  3. **A run that measured nothing says so.** Every way each of the three
//     checks can produce no answer — no scan, no report, no card, no lead,
//     no attempt, nothing due — is reported as no measurement, never as a
//     pass and never as a defect.
//  4. **A run that found the criterion broken exits differently from one
//     that met it**, and names whether the cause is the owner's unwritten
//     copy or a defect.
//
// The deployment and its database are stubbed at `fetch`, the only thing
// the script reaches the world through.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BATTERY,
  FIRST_PAGE_RETRY_WINDOW_H,
  NURTURE_H,
  NURTURE_MAX_TOUCHES,
  SEQUENCE_START_DEADLINE_DAYS,
} from "@/lib/config/constants";
import { OWNER_OWED } from "@/lib/presentation/copy/registry";
import {
  EXIT,
  checkMail,
  checkNurture,
  checkSerps,
  keysSpokenBy,
  owedBy,
  owedMailKeys,
  pin,
  pinList,
} from "../../../scripts/live/m4-check.mjs";

const APP = "https://dev.example";
const DB = "https://db.example";
const SCAN = "3f1c9a6e-0000-4000-8000-00000000ab01";
const ADDRESS = "founder@example.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// ── Fixtures for the stored blob ────────────────────────────────────────

interface StoredSerp {
  kind: "measured" | "zero" | "unmeasured";
  reason?: string;
  value?: { organic: unknown[]; aiOverview: { present: boolean; asynchronousAiOverview: boolean; referenceDomains: string[] } };
}

function serpWith(references: string[]): StoredSerp {
  return {
    kind: "measured",
    value: { organic: [], aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: references } },
  };
}

function serpWithout(): StoredSerp {
  return {
    kind: "measured",
    value: { organic: [], aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } },
  };
}

function answered(citedDomains: string[], namesCustomer = false): unknown {
  return { kind: "answered", citedDomains, namesCustomer };
}

function cardRow(n: number, cell: unknown): unknown {
  return {
    question: { n, wording: { text: `question ${n}` }, search: `search ${n}` },
    cell,
    engines: [{ engine: "ai_overview", cell }],
  };
}

/** Twelve stored SERPs, six of them carrying an AI Overview with its
 *  references, and the card the assembler would have built over them. */
function goodReport(): Record<string, unknown> {
  const serps: StoredSerp[] = [];
  const rows: unknown[] = [];
  for (let n = 1; n <= BATTERY.QUESTIONS; n += 1) {
    if (n % 2 === 1) {
      const references = [`rival${n}.com`, "reddit.com"];
      serps.push(serpWith(references));
      rows.push(cardRow(n, answered(references, n === 1)));
    } else {
      serps.push(serpWithout());
      rows.push(cardRow(n, { kind: "no_answer" }));
    }
  }
  return {
    version: 6,
    complete: true,
    serps,
    aiAnswers: {
      measuredSearches: BATTERY.QUESTIONS,
      answeredSearches: 6,
      customerCitations: 1,
      ownDomain: "example.com",
      coverage: "async_included",
      rows,
      rivals: [],
    },
    freePage: { totalPages: 9 },
  };
}

function scanRow(report: unknown): Record<string, unknown> {
  return {
    id: SCAN,
    domain: "example.com",
    tier: "free",
    status: "done",
    stopped_reason: "complete",
    created_at: "2026-09-10T09:00:00.000Z",
    finished_at: "2026-09-10T09:00:42.000Z",
    is_current: true,
    report,
  };
}

interface LeadFixture {
  id: string;
  scan_id: string;
  email: string;
  domain: string;
  first_page_state: string;
  first_page_attempts: number;
  first_page_first_attempt_at: string | null;
  first_page_failure: string | null;
  page_delivered_at: string | null;
  sequence_state: string | null;
  sequence_started_at: string | null;
  next_touch_at: string | null;
  touch_count: number;
  dropped_at: string | null;
  converted_at: string | null;
}

function leadFixture(over: Partial<LeadFixture> = {}): LeadFixture {
  return {
    id: "9ab1c0de-0000-4000-8000-00000000cd01",
    scan_id: SCAN,
    email: ADDRESS,
    domain: "example.com",
    first_page_state: "pending",
    first_page_attempts: 0,
    first_page_first_attempt_at: null,
    first_page_failure: null,
    page_delivered_at: null,
    sequence_state: null,
    sequence_started_at: null,
    next_touch_at: null,
    touch_count: 0,
    dropped_at: null,
    converted_at: null,
    ...over,
  };
}

/** A deployment and its PostgREST, answering the four addresses the script
 *  reaches and nothing else. */
function deployment(a: {
  scans?: unknown[];
  fetches?: unknown[];
  leads?: unknown[] | (() => unknown[]);
  capture?: { status: number; body: unknown };
}) {
  const calls: string[] = [];
  const stub = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname === "/api/lead") {
      const answer = a.capture ?? { status: 202, body: { ok: true, message: "lead.accepted" } };
      return json(answer.body, answer.status);
    }
    if (url.pathname === "/rest/v1/scans") return json(a.scans ?? []);
    if (url.pathname === "/rest/v1/fetches") return json(a.fetches ?? []);
    if (url.pathname === "/rest/v1/leads") {
      return json(typeof a.leads === "function" ? a.leads() : (a.leads ?? []));
    }
    throw new Error(`the script reached an address the stub does not serve: ${url.href}`);
  });
  return { stub, calls };
}

let lines: string[] = [];
const log = (line: string) => lines.push(line);
const printed = () => lines.join("\n");

beforeEach(() => {
  lines = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── 1. The bounds are the product's own ─────────────────────────────────

describe("the pins are read out of constants.ts, never copied", () => {
  it.each([
    ["QUESTIONS", BATTERY.QUESTIONS],
    ["NURTURE_MAX_TOUCHES", NURTURE_MAX_TOUCHES],
    ["SEQUENCE_START_DEADLINE_DAYS", SEQUENCE_START_DEADLINE_DAYS],
    ["FIRST_PAGE_RETRY_WINDOW_H", FIRST_PAGE_RETRY_WINDOW_H],
  ])("`%s` reads the value the product is pinned to", (name, value) => {
    expect(pin(name)).toBe(value);
  });

  it("`NURTURE_H` reads the three offsets as a list", () => {
    expect(pinList("NURTURE_H")).toEqual([...NURTURE_H]);
  });

  it("a pin that no longer resolves exactly once stops the run", () => {
    expect(() => pin("QUESTIONS", "export const A = { QUESTIONS: 12 };\nconst B = { QUESTIONS: 9 };")).toThrow(
      /found 2/
    );
    expect(() => pin("QUESTIONS", "export const RENAMED = 12;")).toThrow(/found 0/);
  });

  it("a pinned list that no longer resolves exactly once stops the run", () => {
    // `[24, 72, 168]` is written twice in `constants.ts`; the reader is by
    // name for exactly that reason, and a duplicated name must stop it.
    expect(() =>
      pinList("NURTURE_H", "const NURTURE_H = Object.freeze([24]);\nconst NURTURE_H = Object.freeze([72]);")
    ).toThrow(/found 2/);
    expect(() => pinList("NURTURE_H", "const OTHER_H = Object.freeze([24, 72, 168]);")).toThrow(/found 0/);
  });
});

// ── 2. The owed copy is the registry's own answer ───────────────────────

describe("the owner-owed mail keys are the registry's, and they are the ones the seam refuses on", () => {
  it("the script's text reading of the mail partition equals OWNER_OWED", () => {
    const fromRegistry = OWNER_OWED.filter((key) => key.startsWith("mail.")).slice().sort();
    expect(owedMailKeys().slice().sort()).toEqual(fromRegistry);
  });

  it("a partition whose shape has changed stops the run rather than reporting nothing owed", () => {
    expect(() => owedMailKeys('export const MAIL_COPY = { "mail.a": ["written", {}] };')).toThrow(
      /no owner-owed key/
    );
  });

  it("the keys named for `first-page` are the ones its template and the shell speak", () => {
    const spoken = keysSpokenBy("first-page");
    expect(spoken).toContain("mail.firstPage.subject");
    expect(spoken).toContain("mail.reason.firstPage");
    // The shell's, which every lead mail speaks whatever its blocks are.
    expect(spoken).toContain("mail.shell.wordmark");
    expect(spoken).toContain("mail.optout.label");
    // Not the imprint: the composer reads it off the registry rather than
    // through `copy()`, precisely so an unwritten one blocks no mail.
    expect(spoken).not.toContain("mail.shell.imprint");
  });

  it("a nurture touch is named with its own pair and not with the other two", () => {
    expect(owedBy("nurture", 2, ["mail.nurture.body.1", "mail.nurture.body.2", "mail.nurture.body.3"])).toEqual([
      "mail.nurture.body.2",
    ]);
  });

  it("a mail kind with no template directory stops the run", () => {
    expect(() => keysSpokenBy("weekly")).toThrow(/no template directory/);
  });
});

describe("the script's answer for a kind is the send seam's own answer", () => {
  // The assertion this file exists for. `owedBy` is a text reading of two
  // source files; `sendEmail` is the thing that actually composes. If the
  // two ever disagree, a live run would report `not-composable` and name
  // the wrong sentence — or report composable copy as the cause of a
  // failure it did not cause.
  it("`first-page` composes exactly when the script names no owed key", async () => {
    const { applyEnvFixture } = await import("../../mail/env-fixture");
    applyEnvFixture();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { sendEmail } = await import("@/lib/mail/send");
    const { buildFirstPage } = await import("@/lib/mail/templates/first-page");
    const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
    __setVendorTransportForTesting(async () => ({ status: 200, headers: {}, body: JSON.stringify({ id: "v1" }) }));

    const mail = buildFirstPage({
      email: ADDRESS,
      pageTitle: "The page",
      markdown: "# The page",
      targetQuery: "best crm",
      volume: { kind: "measured", value: 2400, at: new Date("2026-09-10T09:00:00.000Z") },
      pagesFound: 9,
    });
    const result = await sendEmail({
      kind: "first-page",
      to: ADDRESS,
      subject: mail.subject,
      subjectVars: mail.subjectVars,
      blocks: mail.blocks,
      reason: mail.reason,
      optOut: mail.optOut,
    });
    __setVendorTransportForTesting(null);

    if (owedBy("first-page").length > 0) {
      expect(result).toEqual({ sent: false, reason: "not-composable" });
    } else {
      expect(result).toEqual({ sent: true, id: "v1" });
    }
  });

  it("a `nurture` touch composes exactly when the script names no owed key for that touch", async () => {
    const { applyEnvFixture } = await import("../../mail/env-fixture");
    applyEnvFixture();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { sendEmail, registerSuppressionReader } = await import("@/lib/mail/send");
    const { buildNurture } = await import("@/lib/mail/templates/nurture");
    const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
    __setVendorTransportForTesting(async () => ({ status: 200, headers: {}, body: JSON.stringify({ id: "v2" }) }));
    // `nurture` is the one lead kind that consults the address-wide
    // suppression store, which fails closed when nothing has wired it. The
    // question here is composability, so the store is made to say send.
    registerSuppressionReader(async () => "send");

    const mail = buildNurture({ email: ADDRESS, domain: "example.com", touch: 1 });
    const result = await sendEmail({
      kind: "nurture",
      to: ADDRESS,
      subject: mail.subject,
      blocks: mail.blocks,
      reason: mail.reason,
      optOut: mail.optOut,
    });
    __setVendorTransportForTesting(null);
    registerSuppressionReader(null);

    if (owedBy("nurture", 1).length > 0) {
      expect(result).toEqual({ sent: false, reason: "not-composable" });
    } else {
      expect(result).toEqual({ sent: true, id: "v2" });
    }
  });
});

// ── 3. The twelve, their references and the card over them ──────────────

async function runSerps(a: Parameters<typeof deployment>[0]) {
  const { stub, calls } = deployment(a);
  vi.stubGlobal("fetch", stub);
  const code = await checkSerps({ db: DB, key: "service", domain: "example.com", questions: BATTERY.QUESTIONS, log });
  return { code, calls };
}

describe("check 1 — the 12 stored SERPs, their references, and the matrix over them", () => {
  it("twelve SERPs, every AI Overview carrying its references, and a card that agrees: within", async () => {
    const { code } = await runSerps({ scans: [scanRow(goodReport())] });
    expect(code).toBe(EXIT.WITHIN);
    expect(printed()).toContain(`stored SERPs     ${BATTERY.QUESTIONS}    `);
    expect(printed()).toContain("AI Overviews     6     ");
    expect(printed()).toContain("with references  6     ");
    expect(printed()).toContain("ok               every AI Overview Google served carries its references");
  });

  it("an AI Overview served with no reference domain is the finding the milestone exists to find", async () => {
    const report = goodReport();
    (report.serps as StoredSerp[])[0] = serpWith([]);
    (report.aiAnswers as { rows: unknown[] }).rows[0] = cardRow(1, answered([], false));
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain("question 1: Google served an AI Overview and the stored SERP carries no reference domain");
  });

  it("a matrix cell that does not say what its SERP says is a finding", async () => {
    const report = goodReport();
    (report.aiAnswers as { rows: unknown[] }).rows[1] = cardRow(2, answered(["invented.com"]));
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain("the SERP says no_answer and the matrix cell says answered");
  });

  it("a cell citing domains its own SERP did not return is a finding", async () => {
    const report = goodReport();
    (report.aiAnswers as { rows: unknown[] }).rows[0] = cardRow(1, answered(["someone-else.com"], true));
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain("its SERP's references are");
  });

  it("a stored SERP with no row on the card is a finding", async () => {
    const report = goodReport();
    (report.aiAnswers as { rows: unknown[] }).rows.pop();
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain("a SERP was stored and the card has no row for it");
  });

  it("a card with more rows than the pass stored SERPs is a finding", async () => {
    const report = goodReport();
    const rows = (report.aiAnswers as { rows: unknown[] }).rows;
    rows.push(cardRow(13, { kind: "no_answer" }));
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain("rows over");
  });

  it("a cold-start market that yielded fewer than twelve is a measurement, not a finding", async () => {
    const report = goodReport();
    (report.serps as StoredSerp[]).length = 9;
    (report.aiAnswers as { rows: unknown[] }).rows.length = 9;
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.WITHIN);
    expect(printed()).toContain(`the market yielded 9 searches`);
  });

  it("an unmeasured SERP wants an unmeasured cell, and gets one", async () => {
    const report = goodReport();
    (report.serps as StoredSerp[])[3] = { kind: "unmeasured", reason: "not_attempted" };
    (report.aiAnswers as { rows: unknown[] }).rows[3] = cardRow(4, { kind: "unmeasured", reason: "not_attempted" });
    const { code } = await runSerps({ scans: [scanRow(report)] });
    expect(code).toBe(EXIT.WITHIN);
  });

  it("the ledger is printed beside the answer, and a SERP served from the cache is not a missing SERP", async () => {
    const fetches = [
      { cache_key: "a|United States|en|aio:async|domain:example.com", cost_cents: 0, created_at: "2026-09-10T09:00:01.000Z" },
      { cache_key: "b|United States|en|aio:async|domain:example.com", cost_cents: 0, created_at: "2026-09-10T09:00:02.000Z" },
      // A target SERP bought without the flag — not one of the battery's.
      { cache_key: "c|United States|en|aio:cached|domain:example.com", cost_cents: 0, created_at: "2026-09-10T09:00:03.000Z" },
    ];
    const { code } = await runSerps({ scans: [scanRow(goodReport())], fetches });
    expect(code).toBe(EXIT.WITHIN);
    expect(printed()).toContain(`ledger           2 of the ${BATTERY.QUESTIONS} were bought on this pass`);
    expect(printed()).toContain("served from §6.4's cache, which writes no row and is not a missing SERP");
  });

  it.each([
    ["no current scan", { scans: [] }, "no current scan"],
    ["a scan that stored no report", { scans: [scanRow(null)] }, "stored no report"],
    ["a report with no SERPs", { scans: [scanRow({ version: 6, serps: [], aiAnswers: null })] }, "carries no SERPs"],
    [
      "a report with no AI-answers card",
      { scans: [scanRow({ version: 6, serps: [serpWith(["a.com"])], aiAnswers: null })] },
      "carries no AI-answers card",
    ],
  ])("%s is no measurement, not a pass and not a finding", async (_name, fixture, expected) => {
    const { code } = await runSerps(fixture as Parameters<typeof deployment>[0]);
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain(expected as string);
  });
});

// ── 4. One real capture, and the page it buys ───────────────────────────

/** `watchS` is 0 here: the window exists so a live run does not sit
 *  waiting on a job's tick, and a suite that honoured it would sit for
 *  three minutes proving that it does. */
async function runMail(a: Parameters<typeof deployment>[0]) {
  const { stub, calls } = deployment(a);
  vi.stubGlobal("fetch", stub);
  const code = await checkMail({
    db: DB,
    key: "service",
    app: APP,
    domain: "example.com",
    address: ADDRESS,
    windowH: FIRST_PAGE_RETRY_WINDOW_H,
    watchS: 0,
    log,
  });
  return { code, calls };
}

describe("check 2 — one real capture, and what the deployment did with the page it owes", () => {
  it("a delivered page is within", async () => {
    const { code, calls } = await runMail({
      scans: [scanRow(goodReport())],
      leads: [
        leadFixture({
          first_page_state: "sent",
          first_page_attempts: 1,
          first_page_first_attempt_at: "2026-09-10T09:05:00.000Z",
          page_delivered_at: "2026-09-10T09:05:01.000Z",
          sequence_state: "running",
          sequence_started_at: "2026-09-10T09:05:01.000Z",
          next_touch_at: "2026-09-11T09:05:01.000Z",
        }),
      ],
    });
    expect(code).toBe(EXIT.WITHIN);
    expect(printed()).toContain("the first page left, to the address that asked for it");
    // A lead already on the row is read, never captured a second time.
    expect(calls).not.toContain("POST /api/lead");
  });

  it("an address with no lead yet is captured once, and then read", async () => {
    let captured = false;
    const { stub, calls } = deployment({
      scans: [scanRow(goodReport())],
      leads: () => (captured ? [leadFixture({ first_page_state: "sent", first_page_attempts: 1 })] : []),
    });
    const wrapped = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.pathname === "/api/lead") captured = true;
      return stub(input, init);
    });
    vi.stubGlobal("fetch", wrapped);
    const code = await checkMail({
      db: DB,
      key: "service",
      app: APP,
      domain: "example.com",
      address: ADDRESS,
      windowH: FIRST_PAGE_RETRY_WINDOW_H,
      watchS: 0,
      log,
    });
    expect(code).toBe(EXIT.WITHIN);
    expect(calls).toContain("POST /api/lead");
    expect(printed()).toContain("202 — the address was accepted");
  });

  it("a send attempted and never composed is reported against the owed copy that caused it", async () => {
    const { code } = await runMail({
      scans: [scanRow(goodReport())],
      leads: [
        leadFixture({
          first_page_state: "written",
          first_page_attempts: 3,
          first_page_first_attempt_at: "2026-09-10T09:05:00.000Z",
        }),
      ],
    });
    // The keys are the live registry's, so this arm asserts whichever of
    // the two the deployment is actually in — and says which.
    if (owedBy("first-page").length > 0) {
      expect(code).toBe(EXIT.OVER);
      expect(printed()).toContain("the owner's debt and not a defect");
      for (const key of owedBy("first-page")) expect(printed()).toContain(key);
    } else {
      expect(code).toBe(EXIT.OVER);
      expect(printed()).toContain("a defect, not owed copy");
    }
  });

  it("a lead that no attempt was ever stamped on is no measurement — the delivery path did not run", async () => {
    const { code } = await runMail({ scans: [scanRow(goodReport())], leads: [leadFixture()] });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain("nothing attempted");
    expect(printed()).toContain("the delivery");
  });

  it("a refused capture is no measurement", async () => {
    const { code } = await runMail({
      scans: [scanRow(goodReport())],
      leads: [],
      capture: { status: 422, body: { ok: false, message: "lead.invalid_address" } },
    });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain("POST /api/lead answered 422");
  });

  it("no current scan is no measurement, and says where to get one", async () => {
    const { code } = await runMail({ scans: [] });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain("run scripts/live/free-scan.sh example.com first");
  });

  it("the owed copy is printed before the capture, so a run names its cause even when nothing moves", async () => {
    await runMail({ scans: [scanRow(goodReport())], leads: [leadFixture({ first_page_state: "sent" })] });
    expect(printed()).toMatch(/copy {13}the first-page mail (composes|cannot compose)/);
  });
});

// ── 5. The sequence, one tick later ─────────────────────────────────────

async function runNurture(leads: unknown[]) {
  const { stub } = deployment({ leads });
  vi.stubGlobal("fetch", stub);
  return checkNurture({
    db: DB,
    key: "service",
    address: ADDRESS,
    offsets: [...NURTURE_H],
    maxTouches: NURTURE_MAX_TOUCHES,
    deadlineD: SEQUENCE_START_DEADLINE_DAYS,
    log,
  });
}

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const ahead = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

describe("check 3 — nurture touches advance on the hourly tick", () => {
  it("a sequence that has advanced is within", async () => {
    const code = await runNurture([
      leadFixture({
        first_page_state: "sent",
        page_delivered_at: ago(30),
        sequence_state: "running",
        sequence_started_at: ago(30),
        next_touch_at: ahead(42),
        touch_count: 1,
      }),
    ]);
    expect(code).toBe(EXIT.WITHIN);
    expect(printed()).toContain("the tick is moving them");
  });

  it("a touch left standing past the tick that owed it is the finding, named against the owed copy", async () => {
    const code = await runNurture([
      leadFixture({
        first_page_state: "sent",
        page_delivered_at: ago(30),
        sequence_state: "running",
        sequence_started_at: ago(30),
        next_touch_at: ago(6),
        touch_count: 0,
      }),
    ]);
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain("came due");
    expect(printed()).toContain(
      owedBy("nurture", 1).length > 0
        ? "a touch the seam cannot compose records nothing and stays owed"
        : "this is a defect and not owed copy"
    );
  });

  it("more touches than the bound allows is a finding", async () => {
    const code = await runNurture([
      leadFixture({
        first_page_state: "sent",
        page_delivered_at: ago(200),
        sequence_state: "finished",
        sequence_started_at: ago(200),
        next_touch_at: null,
        touch_count: NURTURE_MAX_TOUCHES + 1,
      }),
    ]);
    expect(code).toBe(EXIT.OVER);
    expect(printed()).toContain(`against a bound of ${NURTURE_MAX_TOUCHES}`);
  });

  it("a touch inside the tick's own hour is not yet late", async () => {
    const code = await runNurture([
      leadFixture({
        first_page_state: "sent",
        page_delivered_at: ago(25),
        sequence_state: "running",
        sequence_started_at: ago(25),
        next_touch_at: ago(0.5),
        touch_count: 0,
      }),
    ]);
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain("none due yet (1 waiting on the clock)");
  });

  it("an address with no lead at all is no measurement", async () => {
    expect(await runNurture([])).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain("has no lead on this deployment");
  });

  it("a lead whose page was never delivered has no sequence to measure", async () => {
    expect(await runNurture([leadFixture()])).toBe(EXIT.NO_MEASUREMENT);
    expect(printed()).toContain("none with a sequence");
  });
});
