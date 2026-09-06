// tests/presentation/stopped/statement.test.ts — BUILD §6.5, §11, REQ-092
// criteria 1, 2, 4, 6, 7, and ADR-011 points 4 and 5
//
// Every line these functions return is a registry key whose sentence is the
// owner's. What is asserted is which key each statement reaches — never the
// wording — and, for criterion 7, byte equality across four `otherwise`
// causes, which is the assertion an `else if` fails.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { account, type Cause } from "@/lib/presentation/place";
import {
  dayAccount,
  nextPublishStatement,
  stoppedWorkStatement,
  type NextPublishCause,
  type WorkStop,
} from "@/lib/presentation/stopped";

const SOURCE = path.resolve(
  import.meta.dirname,
  "../../../src/lib/presentation/stopped/statement.ts"
);

const SINCE = new Date("2026-09-06T09:00:00.000Z");
const RESUMES_ON = new Date("2026-09-08T09:00:00.000Z");
const formatDate = (on: Date): string => on.toISOString().slice(0, 10);
const FORMAT = { formatDate };

const BASE: WorkStop = {
  since: SINCE,
  resumes: { promised: false },
  needs: { kind: "nothing" },
  partial: false,
};

const OTHERWISE_CAUSES: NextPublishCause[] = ["paused", "nothing-approved", "none-planned"];

describe("REQ-092 c1 — what the customer reads is that ReachKit did not do the work", () => {
  it("the statement's first line is the stopped-work line, never the exhausted-supply one", () => {
    expect(stoppedWorkStatement(BASE, FORMAT).line).toBe(COPY["stopped.work.line"]);
    expect(stoppedWorkStatement(BASE, FORMAT).line).not.toBe(COPY["cause.supply-exhausted"]);
  });

  it("a stopped day reaches the arbiter as a cause, and the stop wins", () => {
    const day = dayAccount(BASE, false, false);
    const causes: Cause[] = [day, { tag: "supply-exhausted" }];
    const resolved = account("calendar.date.page", causes);
    expect(resolved.cause).toBe("reachkit-stopped");
    expect(resolved.line).toBe(COPY["stopped.work.line"]);
    expect(resolved.line).not.toBe(COPY["cause.supply-exhausted"]);
  });
});

describe("REQ-092 c2 — whether anything is needed, on both arms", () => {
  it("the nothing arm says so in its own sentence", () => {
    expect(stoppedWorkStatement(BASE, FORMAT).needsLine).toBe(COPY["stopped.work.needs-nothing"]);
  });

  it("the action arm speaks the key the stop carries", () => {
    const stop: WorkStop = { ...BASE, needs: { kind: "action", key: "shell.nav.settings" } };
    expect(stoppedWorkStatement(stop, FORMAT).needsLine).toBe(COPY["shell.nav.settings"]);
  });

  it("all three fields are always returned — no arm drops one", () => {
    for (const stop of [
      BASE,
      { ...BASE, resumes: { on: RESUMES_ON } } as WorkStop,
      { ...BASE, needs: { kind: "action", key: "shell.nav.settings" } } as WorkStop,
    ]) {
      expect(Object.keys(stoppedWorkStatement(stop, FORMAT)).sort()).toEqual([
        "line",
        "needsLine",
        "resumesLine",
      ]);
    }
  });
});

describe("REQ-092 c4 — the resumption date, or that no time is promised, never neither", () => {
  it("the on arm reaches resumes-on, and carries the caller's formatted date once written", () => {
    const statement = stoppedWorkStatement({ ...BASE, resumes: { on: RESUMES_ON } }, FORMAT);
    expect(statement.resumesLine).toBe(COPY["stopped.work.resumes-on"]);
    // The sentence is still the owner's and holds no `{date}` placeholder
    // yet, so the substitution assertion is armed the day it is written
    // rather than skipped (rule 5.5). Which key the arm reaches is decided
    // in `keys.test.ts`, where `copy()` is the identity.
    if (COPY["stopped.work.resumes-on"].includes("{date}")) {
      expect(statement.resumesLine).toContain(formatDate(RESUMES_ON));
    }
  });

  it("the promised:false arm reaches no-time-promised", () => {
    expect(stoppedWorkStatement(BASE, FORMAT).resumesLine).toBe(
      COPY["stopped.work.no-time-promised"]
    );
  });

  it("neither arm returns an empty string — a blank is not a statement", () => {
    for (const stop of [BASE, { ...BASE, resumes: { on: RESUMES_ON } } as WorkStop]) {
      expect(stoppedWorkStatement(stop, FORMAT).resumesLine).not.toBe("");
    }
  });
});

describe("REQ-092 c6 — a partial pass is stated, never presented as complete", () => {
  it("a page produced under a cut-short pass reaches the partial-pass line", () => {
    const day = dayAccount({ ...BASE, partial: true }, true, false);
    expect(day.line).toBe(COPY["stopped.work.partial-pass"]);
    expect("partialPass" in day && day.partialPass).toBe(true);
  });

  it("no page produced is the plain stopped line, and carries no partialPass", () => {
    const day = dayAccount({ ...BASE, partial: true }, false, false);
    expect(day.line).toBe(COPY["stopped.work.line"]);
    expect("partialPass" in day).toBe(false);
  });

  it("a complete pass that still stopped is the plain line, not the partial one", () => {
    const day = dayAccount({ ...BASE, partial: false }, true, false);
    expect(day.line).toBe(COPY["stopped.work.line"]);
  });
});

describe("REQ-092 c7 / ADR-011 point 5 — a stop ignores every other cause", () => {
  it("every otherwise cause resolves to exactly the same line under a stop", () => {
    const lines = new Set(
      OTHERWISE_CAUSES.map((tag) => nextPublishStatement({ stopped: true, otherwise: { tag } }).line)
    );
    lines.add(
      nextPublishStatement({
        stopped: true,
        otherwise: { tag: "scheduled", at: "Tue 8 Sep, 09:00 EDT" },
      }).line
    );
    expect(lines.size).toBe(1);
    expect([...lines][0]).toBe(COPY["next-publish.stopped"]);
  });

  it("no other cause's line is appended, prefixed or shown as secondary text", () => {
    const stopped = nextPublishStatement({ stopped: true, otherwise: { tag: "paused" } });
    const paused = nextPublishStatement({ stopped: false, otherwise: { tag: "paused" } });
    expect(stopped.line).toBe(COPY["next-publish.stopped"]);
    expect(stopped.key).toBe("next-publish.stopped");
    // Byte equality is the assertion an `else if` or a concatenation fails.
    expect(stopped.line.length).toBe(COPY["next-publish.stopped"].length);
    if (COPY["next-publish.paused"] !== COPY["next-publish.stopped"]) {
      expect(stopped.line).not.toContain(paused.line);
    }
  });

  it("a scheduled time is not carried through a stop", () => {
    const at = "Tue 8 Sep, 09:00 EDT";
    const stopped = nextPublishStatement({ stopped: true, otherwise: { tag: "scheduled", at } });
    expect(stopped.line).not.toContain(at);
  });
});

describe("REQ-040 c4 — with no stop, the line comes from otherwise alone", () => {
  it.each(OTHERWISE_CAUSES)("%s reaches its own key and no stopped-work key", (tag) => {
    const statement = nextPublishStatement({ stopped: false, otherwise: { tag } });
    expect(statement.key).toBe(`next-publish.${tag}`);
    expect(statement.key).not.toBe("next-publish.stopped");
  });

  it("a scheduled publish carries its time", () => {
    const at = "Tue 8 Sep, 09:00 EDT";
    const statement = nextPublishStatement({ stopped: false, otherwise: { tag: "scheduled", at } });
    expect(statement.key).toBe("next-publish.scheduled");
    expect(statement.line).toContain(at);
  });

  it("the four otherwise tags reach four distinct keys", () => {
    const keys = [...OTHERWISE_CAUSES.map((tag) => ({ tag }) as const), { tag: "scheduled", at: "x" } as const].map(
      (otherwise) => nextPublishStatement({ stopped: false, otherwise }).key
    );
    expect(new Set(keys).size).toBe(4);
  });
});

describe("ADR-011 point 4 — a stop carries the instruction, or is rejected", () => {
  it("an outstanding instruction against a stop that needs nothing throws", () => {
    expect(() => dayAccount(BASE, false, true)).toThrow(/instruction/);
  });

  it("the rejection names neither the instruction's text nor an internal cause", () => {
    try {
      dayAccount(BASE, false, true);
      throw new Error("expected dayAccount to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const forbidden of ["cap", "spend", "€", "$", "HTTP", "status code"]) {
        expect(message.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });

  it("a stop that carries the instruction in its needs arm returns normally", () => {
    const stop: WorkStop = { ...BASE, needs: { kind: "action", key: "shell.nav.settings" } };
    expect(() => dayAccount(stop, false, true)).not.toThrow();
    expect(stoppedWorkStatement(stop, FORMAT).needsLine).toBe(COPY["shell.nav.settings"]);
  });
});

describe("the module writes no sentence, and does not vary with who is reading", () => {
  it("every line is a copy key — no string literal stands outside a copy() argument", () => {
    const source = readFileSync(SOURCE, "utf8");
    const code = source
      .split("\n")
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n")
      // The one `throw new Error(...)` ADR-011 point 4 requires is a
      // developer-facing message, not a sentence the product speaks: it
      // reaches no screen, no mail and no reader. What it may *not* say is
      // asserted above ("the rejection names neither the instruction's text
      // nor an internal cause"), which is the assertion that matters.
      .replace(/throw new Error\([\s\S]*?\n\s*\);/g, "throw new Error();");
    const literals = [...code.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]!);
    for (const literal of literals) {
      const isKey = Object.prototype.hasOwnProperty.call(COPY, literal);
      // The tags this module switches over, and the two property names its
      // own types index by. Neither is a sentence and neither reaches a
      // reader; nothing else is admitted.
      const isTag = [
        "paused",
        "nothing-approved",
        "none-planned",
        "scheduled",
        "action",
        "reachkit-stopped",
        "on",
        "tag",
        "nothing",
      ].includes(literal);
      const isImportPath = literal.startsWith("../") || literal.startsWith("./");
      expect(
        isKey || isTag || isImportPath,
        `statement.ts holds the string literal ${JSON.stringify(literal)}, which is neither a copy key nor a tag`
      ).toBe(true);
    }
  });

  it("no function takes a session, reader or persona argument", () => {
    const source = readFileSync(SOURCE, "utf8");
    for (const word of ["session", "reader", "persona", "locale"]) {
      expect(source.toLowerCase()).not.toContain(`${word}:`);
    }
  });

  it("identical arguments yield byte-identical results", () => {
    expect(stoppedWorkStatement(BASE, FORMAT)).toEqual(stoppedWorkStatement(BASE, FORMAT));
    expect(nextPublishStatement({ stopped: true, otherwise: { tag: "paused" } })).toEqual(
      nextPublishStatement({ stopped: true, otherwise: { tag: "paused" } })
    );
  });
});
