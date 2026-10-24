// `/opt-out/{token}` against board OptOut: each arm rendered, read with the parity
// check's own reader, and its follow-up timeline read from the address's stored rows.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boardFile, segments, words } from "../../../scripts/design/parity.mjs";
import { applyEnvFixture } from "../../mail/env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "../../mail/leads/memory-store";
import { expectStateParity } from "../../ui/layout/state-parity";

applyEnvFixture();

const OptOutPage = (await import("../../../src/app/(public)/opt-out/[token]/page")).default;
const { optOutTokenFor } = await import("../../../src/lib/mail/leads/optout");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");
const { NURTURE_H } = await import("../../../src/lib/config/constants");

const ADDRESS = "dana@harborplumbing.example";
let state: MemoryState;

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
});
afterEach(() => setLeadStore(null));

/** A report whose follow-up sequence began at `started` and has sent `sent` touches. */
function report(id: string, started: string, sent: number) {
  return blankLead({
    id,
    email: ADDRESS,
    domain: `${id}.example`,
    sequence_state: "running",
    sequence_started_at: started,
    touch_count: sent,
  });
}

async function markup(token: string): Promise<string> {
  return renderToStaticMarkup(await OptOutPage({ params: { token } }));
}

async function rendered(token: string): Promise<string[]> {
  return segments(await markup(token));
}

/** One board card's strings, normalised as the parity check compares them. */
function boardCard(selector: string, index = 0): string[] {
  const card = parse(readFileSync(boardFile("OptOut"), "utf8")).querySelectorAll(selector)[index];
  if (card === undefined) throw new Error(`board OptOut has no ${selector}`);
  return segments(card.toString(), { board: true }).map((s: string) => words(s).join(" "));
}

const normalised = (texts: string[]) => texts.map((s) => words(s).join(" "));

/** The timeline's cells, as "{hours} hours {state}". */
function timeline(texts: string[]): string[] {
  return texts.filter((s) => /^\d+ hours /.test(s));
}

describe("each arm is the board's card: its sections, order and words", () => {
  it("the confirmed arm, with the 24-hour follow-up already sent", async () => {
    state.leads = [report("harbor", "2026-10-19T09:00:00.000Z", 1)];
    const texts = await rendered(optOutTokenFor(ADDRESS));
    expect(normalised(texts)).toEqual(boardCard('section[aria-labelledby="oo-h"]'));
  });

  it("the link-no-longer-valid arm", async () => {
    const texts = await rendered("not-a-token");
    expect(normalised(texts)).toEqual(boardCard("div.card", 0));
  });

  it("the could-not-apply arm", async () => {
    state.failSuppressionWrite = true;
    const texts = await rendered(optOutTokenFor(ADDRESS));
    expect(normalised(texts)).toEqual(boardCard("div.card", 1));
  });
});

it("parity: OptOut reads its rendered arms", async () => {
  state.leads = [report("harbor", "2026-10-19T09:00:00.000Z", 1)];
  const confirmed = await markup(optOutTokenFor(ADDRESS));
  const invalid = await markup("not-a-token");
  state.failSuppressionWrite = true;
  expectStateParity("OptOut", [confirmed, invalid, await markup(optOutTokenFor(ADDRESS))]);
});

describe("the timeline is true for the address", () => {
  const cells = (sent: number) =>
    NURTURE_H.map((hours, i) => `${hours} hours ${i < sent ? "Sent" : "Won’t be sent"}`);

  for (const sent of [0, 1, 2, 3]) {
    it(`${sent} follow-up${sent === 1 ? "" : "s"} already sent`, async () => {
      state.leads = [report("harbor", "2026-10-19T09:00:00.000Z", sent)];
      const texts = await rendered(optOutTokenFor(ADDRESS));
      expect(timeline(texts)).toEqual(cells(sent));
      expect(texts.includes("All follow-ups were already sent. No more will come.")).toBe(sent === 3);
    });
  }

  it("an address with no report rows: none was sent, so none will be", async () => {
    const texts = await rendered(optOutTokenFor(ADDRESS));
    expect(timeline(texts)).toEqual(cells(0));
  });

  it("the latest report's sequence is the one shown, not an older one's", async () => {
    state.leads = [
      report("older", "2026-09-01T09:00:00.000Z", 3),
      report("latest", "2026-10-19T09:00:00.000Z", 1),
    ];
    const texts = await rendered(optOutTokenFor(ADDRESS));
    expect(timeline(texts)).toEqual(cells(1));
  });

  it("a schedule that cannot be read draws no timeline rather than a false one", async () => {
    state.failLeadRead = true;
    const texts = await rendered(optOutTokenFor(ADDRESS));
    expect(texts[0]).toBe("Unsubscribed");
    expect(timeline(texts)).toEqual([]);
    expect(texts).not.toContain("Follow-ups after your free report");
  });
});
