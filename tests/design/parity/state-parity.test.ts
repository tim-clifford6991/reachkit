// A state board read from its rendered arms: one string gone from one arm fails, naming it.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boardFile, sha256 } from "../../../scripts/design/parity.mjs";
import { expectStateParity, STATE_SUMMARY_HEAD, stateParity } from "../../ui/layout/state-parity";

const BOARD = `<header><a>ReachKit</a> <a>Pricing</a></header>
<main>
  <h1>Unsubscribed</h1>
  <p>You won’t get any more follow-ups about your free report.</p>
  <div class="statetag">Link no longer valid</div>
  <h2>This link no longer works</h2>
  <p>Ask for a new one from the last email we sent you.</p>
</main>
<footer><a>Privacy</a></footer>`;

const CONFIRMED = "<main><h1>Unsubscribed</h1><p>You won’t get any more follow-ups about your free report.</p></main>";
const INVALID = "<main><h2>This link no longer works</h2><p>Ask for a new one from the last email we sent you.</p></main>";

let dir: string;
const summary = (): string => readFileSync(path.join(dir, "summary.md"), "utf8");

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "state-parity-"));
  writeFileSync(boardFile("OptOutFixture", dir), BOARD);
  writeFileSync(path.join(dir, "baseline.json"), JSON.stringify({ OptOutFixture: { sha256: sha256(boardFile("OptOutFixture", dir)), missing: 0 } }));
  writeFileSync(path.join(dir, "summary.md"), "");
  process.env.GITHUB_STEP_SUMMARY = path.join(dir, "summary.md");
});
afterEach(() => {
  delete process.env.GITHUB_STEP_SUMMARY;
});

describe("expectStateParity", () => {
  it("passes when every arm together draws the board's screen; its header, footer and state labels are not read", () => {
    expect(stateParity("OptOutFixture", [CONFIRMED, INVALID], { boards: dir, parity: dir }).ok).toBe(true);
  });

  it("fails on one sentence gone from one arm, and names it", () => {
    const read = stateParity("OptOutFixture", [CONFIRMED, INVALID.replace(/<p>.*<\/p>/, "")], { boards: dir, parity: dir });
    expect(read.ok).toBe(false);
    expect(read.missing).toEqual(["Ask for a new one from the last email we sent you."]);
    expect(() => expectStateParity("OptOutFixture", [CONFIRMED], { boards: dir, parity: dir })).toThrow(/This link no longer works/);
  });

  it("adds each board's table to the job summary under one heading", () => {
    expectStateParity("OptOutFixture", [CONFIRMED, INVALID], { boards: dir, parity: dir });
    expectStateParity("OptOutFixture", [CONFIRMED, INVALID], { boards: dir, parity: dir });
    expect(summary().split(STATE_SUMMARY_HEAD)).toHaveLength(2);
    expect(summary().split("#### OptOutFixture")).toHaveLength(3);
  });
});
