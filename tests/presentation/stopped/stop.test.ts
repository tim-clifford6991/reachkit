// tests/presentation/stopped/stop.test.ts — BUILD §6.5, §11, REQ-092
// criteria 1, 2, 4, 6, 8
//
// The shape. REQ-092 criterion 8 — "it names no internal cause: no cap or
// spend amount, no error text and no system status detail appears anywhere
// in it" — is decided here by there being nothing in `WorkStop` to leak,
// and criteria 2 and 4 by neither of its two unions having an absent arm.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stopCause, type StopShape, type WorkStop } from "@/lib/presentation/stopped";

const SOURCE = path.resolve(import.meta.dirname, "../../../src/lib/presentation/stopped/stop.ts");
const SINCE = new Date("2026-09-06T09:00:00.000Z");

const STOP: WorkStop = {
  since: SINCE,
  resumes: { promised: false },
  needs: { kind: "nothing" },
  partial: false,
};

describe("REQ-092 c8 — WorkStop carries no cause field", () => {
  it("its keys are exactly since, resumes, needs and partial", () => {
    expect(Object.keys(STOP).sort()).toEqual(["needs", "partial", "resumes", "since"]);
  });

  it("no member named for an internal cause is declared", () => {
    const source = readFileSync(SOURCE, "utf8");
    const iface = source.slice(
      source.indexOf("export interface WorkStop"),
      source.indexOf("export type StopShape")
    );
    for (const member of ["cause", "reason", "shape", "amount", "spend", "error", "status", "detail"]) {
      expect(iface, `WorkStop must declare no ${member} member`).not.toMatch(
        new RegExp(`^\\s*${member}[?]?:`, "m")
      );
    }
  });

  it("a stop shape never reaches a copy key", () => {
    const source = readFileSync(SOURCE, "utf8");
    expect(source).not.toContain("copy(");
    expect(source).not.toContain("explain(");
    // `stopCause` is the only export whose return type mentions StopShape.
    const returns = [...source.matchAll(/^export function (\w+)[^{]*?:\s*([^{]+)\{/gms)];
    for (const [, name, returnType] of returns) {
      if (name === "stopCause") continue;
      expect(returnType).not.toContain("StopShape");
    }
  });
});

describe("REQ-092 c2/c4/c6 — no absent arm, and no third outcome", () => {
  it("needs has no absent arm", () => {
    // @ts-expect-error — `needs` is required.
    const a: WorkStop = { since: SINCE, resumes: { promised: false }, partial: false };
    // @ts-expect-error — `needs` is not optional, so undefined does not fit.
    const b: WorkStop = { ...STOP, needs: undefined };
    // @ts-expect-error — the action arm carries the key it speaks from.
    const c: WorkStop = { ...STOP, needs: { kind: "action" } };
    expect([a, b, c]).toHaveLength(3);
  });

  it("resumes has no absent arm and no third outcome", () => {
    // @ts-expect-error — `resumes` is required: "never neither" is the criterion.
    const a: WorkStop = { since: SINCE, needs: { kind: "nothing" }, partial: false };
    // @ts-expect-error — not optional.
    const b: WorkStop = { ...STOP, resumes: undefined };
    // @ts-expect-error — a date that is not a date is not the `on` arm.
    const c: WorkStop = { ...STOP, resumes: { on: undefined } };
    // @ts-expect-error — neither arm.
    const d: WorkStop = { ...STOP, resumes: {} };
    expect([a, b, c, d]).toHaveLength(4);
  });

  it("partial is required and boolean", () => {
    // @ts-expect-error — `partial` is required.
    const a: WorkStop = { since: SINCE, resumes: { promised: false }, needs: { kind: "nothing" } };
    expect(a).toBeTruthy();
    expect({ ...STOP, partial: true }.partial).toBe(true);
  });
});

describe("REQ-092 c1 — stopCause classifies the three shapes and only those", () => {
  const RUNS = ["ok", "degraded", "failed"] as const;
  const rows: { capHit: boolean; killSwitch: boolean; lastRun: (typeof RUNS)[number]; expected: StopShape | null }[] =
    [];
  for (const capHit of [false, true]) {
    for (const killSwitch of [false, true]) {
      for (const lastRun of RUNS) {
        const expected: StopShape | null = killSwitch
          ? "halted"
          : capHit
            ? "spend-ceiling"
            : lastRun === "ok"
              ? null
              : "step-failed";
        rows.push({ capHit, killSwitch, lastRun, expected });
      }
    }
  }

  it.each(rows)(
    "capHit=$capHit killSwitch=$killSwitch lastRun=$lastRun → $expected",
    ({ expected, ...facts }) => {
      expect(stopCause(facts)).toBe(expected);
    }
  );

  it("every stopped combination returns a shape, so no stop is unobservable", () => {
    const stopped = rows.filter((r) => r.killSwitch || r.capHit || r.lastRun !== "ok");
    expect(stopped.length).toBe(rows.length - 1);
    for (const row of stopped) {
      expect(stopCause({ capHit: row.capHit, killSwitch: row.killSwitch, lastRun: row.lastRun })).not.toBeNull();
    }
  });

  it("the only unstopped row is the one where nothing went wrong", () => {
    expect(stopCause({ capHit: false, killSwitch: false, lastRun: "ok" })).toBeNull();
  });
});
