// `/opt-out/{token}` against board OptOut: each arm rendered and read with the parity
// check's own reader.
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

describe("what this changes is said once, with Still sent rows", () => {
  it("follow-ups are Stopped; sign-in and account mail are Still sent, each row naming the account condition once", async () => {
    state.leads = [report("harbor", "2026-10-19T09:00:00.000Z", 1)];
    const texts = await rendered(optOutTokenFor(ADDRESS));
    expect(texts).not.toContain("Follow-ups after your free report");
    expect(texts).toEqual(
      expect.arrayContaining([
        "Follow-up emails about your free report Stopped",
        "Sign-in links, if you have an account Still sent",
        "Receipts and account emails, if you have an account Still sent",
      ])
    );
    expect(texts.filter((s) => s.includes("if you have an account"))).toHaveLength(2);
    expect(texts.some((s) => /\d+ hours/.test(s))).toBe(false);
  });

  it("a refusal states the by-hand way once, in its one line", async () => {
    const invalid = await rendered("not-a-token");
    state.failSuppressionWrite = true;
    const unavailable = await rendered(optOutTokenFor(ADDRESS));
    for (const texts of [invalid, unavailable]) {
      expect(texts.filter((s) => /stop/i.test(s))).toHaveLength(1);
      expect(texts).not.toContain("A person stops it by hand");
    }
  });
});
