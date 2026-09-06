// tests/presentation/stopped/keys.test.ts — BUILD §6.5, §11, REQ-092
//
// WO-049's rests-on row, still true: "Until the owner supplies each string,
// this module is complete in mechanism and incomplete in words. The tests
// assert the key each statement reaches, never the sentence." That is what
// this file does — `copy()` is the identity here, so each returned line
// *is* the key it resolved from, and eight of the eleven sentences being
// unwritten costs the assertions nothing.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import {
  dayAccount,
  nextPublishStatement,
  stoppedWorkStatement,
  type WorkStop,
} from "@/lib/presentation/stopped";

const BASE: WorkStop = {
  since: new Date("2026-09-06T09:00:00.000Z"),
  resumes: { promised: false },
  needs: { kind: "nothing" },
  partial: false,
};
const FORMAT = { formatDate: (on: Date): string => on.toISOString().slice(0, 10) };

describe("REQ-092 c1/c2/c4 — which key each of the three lines reaches", () => {
  it("nothing needed, no time promised", () => {
    expect(stoppedWorkStatement(BASE, FORMAT)).toEqual({
      line: "stopped.work.line",
      needsLine: "stopped.work.needs-nothing",
      resumesLine: "stopped.work.no-time-promised",
    });
  });

  it("an action needed, and a date the work resumes", () => {
    const stop: WorkStop = {
      ...BASE,
      resumes: { on: new Date("2026-09-08T09:00:00.000Z") },
      needs: { kind: "action", key: "settings.head" },
    };
    expect(stoppedWorkStatement(stop, FORMAT)).toEqual({
      line: "stopped.work.line",
      needsLine: "settings.head",
      resumesLine: "stopped.work.resumes-on",
    });
  });

  it("the two resumes arms reach two different keys — never the same one", () => {
    const promised = stoppedWorkStatement(BASE, FORMAT).resumesLine;
    const dated = stoppedWorkStatement(
      { ...BASE, resumes: { on: new Date("2026-09-08T09:00:00.000Z") } },
      FORMAT
    ).resumesLine;
    expect(promised).not.toBe(dated);
  });
});

describe("REQ-092 c6 — the two day accounts reach two different keys", () => {
  it("a stopped day with no page, and a partial pass that produced one", () => {
    expect(dayAccount(BASE, false, false).line).toBe("stopped.work.line");
    expect(dayAccount({ ...BASE, partial: true }, true, false).line).toBe(
      "stopped.work.partial-pass"
    );
  });
});

describe("REQ-092 c7 / ADR-011 point 5 — under a stop, one key and no other", () => {
  it.each(["paused", "nothing-approved", "none-planned"] as const)(
    "with %s also true, the line is next-publish.stopped and nothing else",
    (tag) => {
      const statement = nextPublishStatement({ stopped: true, otherwise: { tag } });
      expect(statement.line).toBe("next-publish.stopped");
      expect(statement.line).not.toContain(tag);
    }
  );

  it("with a scheduled time also on the row, the time does not appear", () => {
    const statement = nextPublishStatement({
      stopped: true,
      otherwise: { tag: "scheduled", at: "Tue 8 Sep, 09:00 EDT" },
    });
    expect(statement.line).toBe("next-publish.stopped");
  });

  it("with no stop, each cause reaches its own key", () => {
    expect(nextPublishStatement({ stopped: false, otherwise: { tag: "paused" } }).line).toBe(
      "next-publish.paused"
    );
    expect(
      nextPublishStatement({ stopped: false, otherwise: { tag: "nothing-approved" } }).line
    ).toBe("next-publish.nothing-approved");
    expect(nextPublishStatement({ stopped: false, otherwise: { tag: "none-planned" } }).line).toBe(
      "next-publish.none-planned"
    );
    expect(
      nextPublishStatement({ stopped: false, otherwise: { tag: "scheduled", at: "x" } }).line
    ).toBe("next-publish.scheduled");
  });
});
