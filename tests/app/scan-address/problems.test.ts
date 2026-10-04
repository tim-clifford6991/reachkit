// tests/app/scan-address/problems.test.ts
//
// BUILD §4.1 module 3 (issue #13). The two files with no JSX in them:
// `_problems/model.ts` — three cards, one severity per count, one `Fix` arm
// — and `_problems/unblock.ts` — the exact lines a founder pastes.
//
// The monotonicity property is the point of the severity suite: severity is
// a step function of one number, so a larger count can never carry a lower
// severity, whatever the problem. That is asserted as a property over the
// whole range rather than at three sample points.
import { describe, expect, it } from "vitest";
import { AI_READER_AGENTS, SEVERITY_THRESHOLDS } from "../../../src/lib/config/constants.ts";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured.ts";
import type { Measured } from "../../../src/lib/measure/measured.ts";
import {
  cardsOf,
  PROBLEM_ORDER,
  severityOf,
  SEVERITY_INDEX,
  type ProblemName,
  type Severity,
} from "../../../src/app/(public)/scan/[domain]/_problems/model.ts";
import { unblockLines } from "../../../src/app/(public)/scan/[domain]/_problems/unblock.ts";
import { SEVERITY } from "../../../src/lib/presentation/bands.ts";
import { FIXTURE_DEGRADED_REPORT, FIXTURE_REPORT } from "../../../src/app/(public)/scan/[domain]/_fixture/states.ts";

const AT = new Date("2026-09-05T09:00:00.000Z");
const PROBLEMS: readonly ProblemName[] = PROBLEM_ORDER;

describe("REQ-009 c8 — severity follows its own count and nothing else", () => {
  it.each(PROBLEMS)("%s: a larger count never carries a lower severity", (problem) => {
    let previous = -1;
    for (let n = 0; n <= 40; n++) {
      const s = severityOf(problem, measured(n, AT));
      expect(s.kind).not.toBe("unmeasured");
      if (s.kind === "unmeasured") continue;
      const rank = SEVERITY_INDEX[s.value];
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it.each(PROBLEMS)("%s: the boundaries are the pin's, not this module's", (problem) => {
    const bounds = SEVERITY_THRESHOLDS[problem];
    const at = (n: number): Severity => {
      const s = severityOf(problem, measured(n, AT));
      if (s.kind === "unmeasured") throw new Error("unreachable");
      return s.value;
    };
    expect(at(bounds.mid - 1)).toBe("low");
    expect(at(bounds.mid)).toBe("mid");
    expect(at(bounds.high - 1)).toBe(bounds.high - 1 >= bounds.mid ? "mid" : "low");
    expect(at(bounds.high)).toBe("high");
  });

  it.each(PROBLEMS)("%s: a measured zero is a measured low, never a dash", (problem) => {
    const s = severityOf(problem, measuredZero(0, AT));
    expect(s.kind).toBe("zero");
    if (s.kind === "unmeasured") throw new Error("unreachable");
    expect(s.value).toBe("low");
  });

  it.each(PROBLEMS)("%s: an unmeasured count carries its reason through unchanged", (problem) => {
    for (const reason of ["undeterminable", "not_attempted"] as const) {
      const s = severityOf(problem, unmeasured<number>(reason, AT));
      expect(s).toEqual({ kind: "unmeasured", reason, at: AT });
    }
  });
});

describe("REQ-009 c1 — exactly three cards, in one fixed order", () => {
  it("cardsOf returns the three problems in PROBLEM_ORDER", () => {
    const cards = cardsOf(FIXTURE_REPORT, []);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.problem)).toEqual([...PROBLEM_ORDER]);
  });

  it("the blocked-readers count is the verdict's, never a second count of the same thing", () => {
    const [blocked] = cardsOf(FIXTURE_REPORT, []);
    expect(blocked.count).toBe(FIXTURE_REPORT.verdict.blockedReaders);
  });

  it("every card names a severity word from the ordered SEVERITY triple", () => {
    for (const card of cardsOf(FIXTURE_REPORT, [])) {
      if (card.severity.kind === "unmeasured") continue;
      expect(SEVERITY[SEVERITY_INDEX[card.severity.value]]).toMatch(/^severity\./);
    }
  });
});

describe("REQ-009 c2/c3/c4 — lines exist on exactly one Fix arm", () => {
  it("a measured, non-zero blocked-readers count is the only card that carries lines", () => {
    const lines = unblockLines([...AI_READER_AGENTS].slice(0, 2));
    const [blocked, missing, unquotable] = cardsOf(FIXTURE_REPORT, lines);
    expect(blocked.fix).toEqual({ kind: "paste", lines });
    expect(missing.fix).toEqual({ kind: "we_write" });
    expect(unquotable.fix).toEqual({ kind: "we_rewrite" });
  });

  it("a measured zero needs no fix, on every problem", () => {
    const report = {
      ...FIXTURE_REPORT,
      verdict: { ...FIXTURE_REPORT.verdict, blockedReaders: measuredZero(0, AT) as Measured<number> },
      supply: { missingPages: measuredZero(0, AT), unquotablePages: measuredZero(0, AT) },
    };
    for (const card of cardsOf(report, ["User-agent: GPTBot"])) {
      expect(card.fix).toEqual({ kind: "none_needed" });
    }
  });

  it("an unmeasured count carries no lines — a founder is never shown a directive from a measurement that did not happen", () => {
    for (const card of cardsOf(FIXTURE_DEGRADED_REPORT, ["User-agent: GPTBot", "Allow: /"])) {
      if (card.count.kind !== "unmeasured") continue;
      expect(card.fix).toEqual({ kind: "unknown" });
      expect(card.fix).not.toHaveProperty("lines");
    }
  });
});

describe("ADR-022 — the unblock lines come from the pin and from nowhere else", () => {
  it("emits one directive pair per blocked agent, in the pin's order", () => {
    // Deliberately reversed relative to the pin: the output order must be
    // the pin's, because the pin is what is iterated.
    const blocked = [...AI_READER_AGENTS].reverse().slice(0, 3);
    const lines = unblockLines(blocked);
    const agentsInOrder = lines.filter((l) => l.startsWith("User-agent:")).map((l) => l.slice("User-agent: ".length));
    expect(agentsInOrder).toEqual(AI_READER_AGENTS.filter((a) => blocked.includes(a)));
  });

  it("two blocked agents produce this exact block, character for character", () => {
    expect(unblockLines(["Googlebot", "PerplexityBot"]).join("\n")).toBe(
      ["User-agent: Googlebot", "Allow: /", "", "User-agent: PerplexityBot", "Allow: /"].join("\n")
    );
  });

  it("every member of the pin, and only members of the pin, can appear", () => {
    const all = unblockLines([...AI_READER_AGENTS]);
    const named = all.filter((l) => l.startsWith("User-agent:")).map((l) => l.slice("User-agent: ".length));
    expect(named).toEqual([...AI_READER_AGENTS]);
  });

  it("an empty input is an empty block, not a block with nothing in it", () => {
    expect(unblockLines([])).toEqual([]);
  });

  it("no agent name is written in code anywhere under src/ outside constants.ts", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../../src");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (statSync(full).isFile() && /\.tsx?$/.test(entry.name)) {
          if (full.endsWith(path.join("config", "constants.ts"))) continue;
          // Comments stripped first: `src/lib/egress/robots.ts` explains
          // *why* it matches a user-agent token case-insensitively by
          // quoting one, and a citation in prose composes no directive.
          // What this check is for is a second copy of the list in code.
          const source = readFileSync(full, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
          for (const agent of AI_READER_AGENTS) {
            if (source.includes(agent)) offenders.push(`${path.relative(root, full)}: ${agent}`);
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
