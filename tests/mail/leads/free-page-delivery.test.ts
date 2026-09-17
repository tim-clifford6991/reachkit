// SPEC §2 · §8 (#787, #826) — the free first page, end to end through the real
// route and the real `lead/nurture` tick.
//
// Real: `POST /api/lead`, capture, the job, the engine seam, the due-work
// query, `deliverFirstPage`, the offer read off the stored report blob, the
// picker, the lead page writer and the whole hard-rule battery, and the
// sequence it schedules. Doubled at the last line of our own code: the model
// (`llm`), the domain's measured text (`fetches`), the cost context (the
// day ledger's database read) and the send seam. Nothing here reaches a
// vendor.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "../../jobs/env-fixture";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { sendCalls, sendMock, sendOutcome } from "./send-mock";

stubEnv(false);

const { llmMock, readDomainTextMock, opened } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readDomainTextMock: vi.fn(),
  opened: [] as Array<{ scanId: string; cap: string; rollUp?: string }>,
}));

vi.mock("@/lib/mail/send", () => sendMock());
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readDomainText: readDomainTextMock, readMeasuredText: async () => [] }));
vi.mock("@/lib/costs", () => ({
  withCostContext: async (ctx: { scanId: string; cap: string; rollUp?: string }, run: (c: unknown) => Promise<unknown>) => {
    opened.push(ctx);
    return run({
      cap: ctx.cap,
      recordFetch: () => {
        throw new Error("the page is written through llm() only");
      },
      capHit: () => false,
      spentCents: () => 6.5,
      degraded: () => false,
    });
  },
}));

const { jobs } = await import("@/jobs");
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { unwireSuppressionReader } = await import("@/lib/mail/leads/wire");
const { POST } = await import("@/app/api/lead/route");
const { freePageOf } = await import("@/lib/opportunities/free-page");
const { defaultReport } = await import("../../opportunities/fixtures");
const { CLEAN_MARKDOWN, GROUNDED, SOURCE_TEXT } = await import("../../generate/fixtures");

const SCAN_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-16T10:00:00.000Z");

const BRIEF = { readerQuestion: "Which tool?", angle: "count seats", mustCover: ["seats"], factIndexes: [0] };
const OUTLINE = { headings: ["Which tool should a small team pick?", "What decides it", "What the plan includes"] };
const NO_OPS = { title: "", description: "", order: [0], firstBlock: "", insertFacts: [] };
const at = (value: unknown) => ({ kind: "measured", value, at: NOW });

function queuePage(markdown: string): void {
  llmMock.mockResolvedValueOnce(at(BRIEF));
  llmMock.mockResolvedValueOnce(at(OUTLINE));
  llmMock.mockResolvedValueOnce(at({ title: "Picking a tool", slug: "picking-a-tool", description: "How.", bodyMarkdown: markdown }));
  llmMock.mockResolvedValueOnce(at(NO_OPS));
}

let state: MemoryState;

function tick() {
  const job = jobs.find((one) => one.id === "lead/nurture");
  if (job === undefined) throw new Error("no lead/nurture job");
  return job.run({ data: {}, now: NOW });
}

async function submit(email: string): Promise<Response> {
  return POST(
    new Request("https://app.example.com/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scanId: SCAN_ID, email }),
    })
  );
}

beforeEach(() => {
  state = newMemoryState();
  const report = defaultReport();
  // The blob as the scan stores it: the pass derives the card, then jsonb.
  state.reports.set(SCAN_ID, JSON.parse(JSON.stringify({ ...report, freePage: freePageOf(report) })));
  state.scans.set(SCAN_ID, report.domain);
  setLeadStore(memoryStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  llmMock.mockReset();
  readDomainTextMock.mockReset();
  readDomainTextMock.mockResolvedValue([{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt }]);
  opened.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setLeadStore(null);
  unwireSuppressionReader();
  vi.restoreAllMocks();
});

describe("an address on the report's card becomes a written, mailed first page and a nurture sequence", () => {
  it("the tick writes the report's offered page under the FREE cap, mails it, and schedules the sequence", async () => {
    expect((await submit("anna@example.com")).status).toBe(202);
    expect(llmMock).not.toHaveBeenCalled();

    queuePage(CLEAN_MARKDOWN);
    expect(await tick()).toEqual({ outcome: "ran", subjectId: null });

    expect(opened).toEqual([{ scanId: SCAN_ID, cap: "FREE", policyVersion: 1, rollUp: "none" }]);
    expect(llmMock).toHaveBeenCalledTimes(4);
    expect(readDomainTextMock).toHaveBeenCalledWith("example.com");

    expect(sendCalls.map((mail) => mail.kind)).toEqual(["first-page"]);
    expect(JSON.stringify(sendCalls[0]!.blocks)).toContain("Teams on the starter plan get 25 seats");

    const lead = state.leads[0]!;
    expect(lead.first_page_state).toBe("sent");
    expect(lead.first_page_title).toBe("Picking a tool");
    expect(lead.page_delivered_at).toBe(NOW.toISOString());
    expect(lead.sequence_state).not.toBeNull();

    // One page, once: the next tick writes nothing and mails no second page.
    await tick();
    expect(llmMock).toHaveBeenCalledTimes(4);
    expect(sendCalls.filter((mail) => mail.kind === "first-page")).toHaveLength(1);
  });

  it("a page the hard rules refuse is never mailed; the founder is told why instead", async () => {
    await submit("anna@example.com");
    // Hidden text is §8's no_hidden_text rule, which no retry can clear.
    queuePage(`${CLEAN_MARKDOWN}\n\n<!-- keywords for the crawler -->`);
    await tick();

    expect(sendCalls.map((mail) => mail.kind)).toEqual(["first-page-unavailable"]);
    expect(state.leads[0]!.first_page_failure).toBe("writing-refused");
    expect(state.leads[0]!.first_page_state).toBe("notice_sent");
  });

  it("a report with no page to offer writes nothing and says so", async () => {
    const report = defaultReport();
    state.reports.set(SCAN_ID, JSON.parse(JSON.stringify({ ...report, freePage: null })));
    await submit("anna@example.com");
    await tick();

    expect(llmMock).not.toHaveBeenCalled();
    expect(sendCalls.map((mail) => mail.kind)).toEqual(["first-page-unavailable"]);
    expect(state.leads[0]!.first_page_failure).toBe("no-page-to-write");
  });

  it("two leads on one report: the page is written once, both are mailed the same page, one ledgered spend (issue 826)", async () => {
    expect((await submit("anna@example.com")).status).toBe(202);
    expect((await submit("ben@example.com")).status).toBe(202);

    queuePage(CLEAN_MARKDOWN);
    await tick();

    expect(llmMock).toHaveBeenCalledTimes(4);
    expect(opened).toEqual([{ scanId: SCAN_ID, cap: "FREE", policyVersion: 1, rollUp: "none" }]);
    const pages = sendCalls.filter((mail) => mail.kind === "first-page");
    expect(pages.map((mail) => mail.to)).toEqual(["anna@example.com", "ben@example.com"]);
    expect(JSON.stringify(pages[1]!.blocks)).toBe(JSON.stringify(pages[0]!.blocks));
    expect(state.leads.map((lead) => lead.first_page_state)).toEqual(["sent", "sent"]);
    expect(state.firstPages.get(SCAN_ID)).toMatchObject({ state: "written", title: "Picking a tool" });

    // A lead arriving a day later costs nothing either.
    await submit("cleo@example.com");
    await tick();
    expect(llmMock).toHaveBeenCalledTimes(4);
    expect(opened).toHaveLength(1);
    expect(sendCalls.filter((mail) => mail.kind === "first-page")).toHaveLength(3);
  });

  it("a refused page is recorded once: a later lead on the report is told there is no page, with no second attempt", async () => {
    await submit("anna@example.com");
    queuePage(`${CLEAN_MARKDOWN}\n\n<!-- keywords for the crawler -->`);
    await tick();
    expect(state.leads[0]!.first_page_failure).toBe("writing-refused");
    expect(state.firstPages.get(SCAN_ID)).toEqual({ state: "refused" });

    await submit("ben@example.com");
    await tick();

    expect(llmMock).toHaveBeenCalledTimes(4);
    expect(opened).toHaveLength(1);
    expect(sendCalls.map((mail) => mail.kind)).toEqual(["first-page-unavailable", "first-page-unavailable"]);
    expect(state.leads[1]!.first_page_failure).toBe("no-page-to-write");
    expect(state.leads[1]!.first_page_state).toBe("notice_sent");
  });

  it("a report another writer holds is not written twice: the lead waits for its next attempt", async () => {
    state.firstPages.set(SCAN_ID, { state: "writing", claimedAt: NOW });
    await submit("anna@example.com");
    await tick();

    expect(llmMock).not.toHaveBeenCalled();
    expect(sendCalls).toHaveLength(0);
    expect(state.leads[0]!.first_page_state).toBe("pending");
    expect(state.leads[0]!.first_page_attempts).toBe(1);
  });

  it("the kill switch holds the page, spends nothing, and starts no retry window", async () => {
    stubEnv(true);
    const { jobs: held } = await import("@/jobs");
    const { setLeadStore: setHeldStore } = await import("@/lib/mail/leads/store");
    setHeldStore(memoryStore(state));
    await submit("anna@example.com");
    const job = held.find((one) => one.id === "lead/nurture")!;
    await job.run({ data: {}, now: NOW });

    expect(llmMock).not.toHaveBeenCalled();
    expect(sendCalls).toHaveLength(0);
    expect(state.leads[0]!.first_page_attempts).toBe(0);
    setHeldStore(null);
    stubEnv(false);
  });
});
