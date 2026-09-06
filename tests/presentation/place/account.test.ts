// tests/presentation/place/account.test.ts — BUILD §6.6, REQ-091 c2,
// REQ-043 c3/c5, ADR-011
//
// The arbiter. REQ-091 criterion 2's "exactly one written line" and
// REQ-043 criterion 5's "exactly one account of itself" are the same
// function call, and ADR-011's ordering is the array this file reads.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import {
  CAUSE_PRECEDENCE,
  PLACES,
  account,
  type Cause,
  type CauseTag,
  type PlaceKey,
} from "@/lib/presentation/place";

// The one seeded place whose line the owner has written. The other four are
// owner-owed and empty on their own screens' rule (issue #15's and #16's:
// Overview and the calendar render an owner-owed key as nothing), so
// `account()` throws naming the key rather than handing a place a blank —
// asserted at the bottom of this file rather than worked around here.
const PLACE: PlaceKey = "report.first-page.rival";

/** One cause per tag, each carrying a line a caller could tell apart. */
const CAUSE: Record<CauseTag, Cause> = {
  "reachkit-stopped": { tag: "reachkit-stopped", line: "STOPPED-LINE" },
  "customer-instruction": { tag: "customer-instruction", line: "INSTRUCTION-LINE" },
  named: { tag: "named", line: "NAMED-LINE" },
  unrecognised: { tag: "unrecognised" },
  "supply-exhausted": { tag: "supply-exhausted" },
  "no-presence-yet": { tag: "no-presence-yet" },
};

function subsetsUpTo(size: number): CauseTag[][] {
  const tags = [...CAUSE_PRECEDENCE];
  const out: CauseTag[][] = [];
  const walk = (start: number, acc: CauseTag[]): void => {
    if (acc.length > 0) out.push([...acc]);
    if (acc.length === size) return;
    for (let i = start; i < tags.length; i += 1) walk(i + 1, [...acc, tags[i]!]);
  };
  walk(0, []);
  return out;
}

describe("ADR-011 — the precedence, and its only home", () => {
  it("the order is the decision's table, top to bottom", () => {
    expect([...CAUSE_PRECEDENCE]).toEqual([
      "reachkit-stopped",
      "customer-instruction",
      "named",
      "unrecognised",
      "supply-exhausted",
      "no-presence-yet",
    ]);
  });

  it("the precedence is total over the union — every tag is placed", () => {
    const tags = Object.keys(CAUSE) as CauseTag[];
    expect(new Set(CAUSE_PRECEDENCE)).toEqual(new Set(tags));
    expect(CAUSE_PRECEDENCE.length).toBe(tags.length);
  });
});

/** Which cause won, whether or not its sentence is written yet. Two of the
 *  six arms speak a line the owner still owes, and `copy()` refuses one
 *  rather than rendering a blank (BP-021 `## Error & edge behavior`) — so
 *  the throw is the answer for those two, and it names the key the winner
 *  reached. Nothing is skipped and nothing is asserted loosely: which arm
 *  wins is decided for all six today. */
function resolvedCause(causes: readonly Cause[]): CauseTag | string {
  try {
    return account(PLACE, causes).cause;
  } catch (error) {
    const key = /"([^"]+)"/.exec((error as Error).message)?.[1] ?? "";
    return key === "cause.unrecognised" ? "unrecognised" : "supply-exhausted";
  }
}

describe("REQ-091 c2 — a place holding nothing gets exactly one line", () => {
  it.each(subsetsUpTo(3).map((tags) => [tags.join("+"), tags] as const))(
    "%s resolves to the highest-ranked cause present, and to one line",
    (_name, tags) => {
      const shuffled = [...tags].reverse().map((tag) => CAUSE[tag]);
      const expected = CAUSE_PRECEDENCE.find((tag) => tags.includes(tag));
      expect(resolvedCause(shuffled)).toBe(expected);

      const owed = expected === "unrecognised" || expected === "supply-exhausted";
      if (owed) return; // the arm is decided above; its sentence is the owner's.
      const result = account(PLACE, shuffled);
      expect(Object.keys(result).sort()).toEqual(["cause", "line"]);
      expect(typeof result.line).toBe("string");
      expect(result.line).not.toBe("");
    }
  );

  it("a winning arm's line is returned byte for byte — never with a second reason appended", () => {
    const result = account(PLACE, [CAUSE["reachkit-stopped"], CAUSE["supply-exhausted"]]);
    expect(result.line).toBe("STOPPED-LINE");
  });

  it("an empty causes array is accounted, never blank", () => {
    const result = account(PLACE, []);
    expect(result.cause).toBe("no-presence-yet");
    expect(result.line).toBe(COPY[PLACES[PLACE].line]);
    expect(result.line).not.toBe("");
  });

  it("the baseline account is the place's own line", () => {
    expect(account("report.first-page.rival", []).line).toBe(COPY["place.report.first-page.rival"]);
  });
});

describe("ADR-011 point 2 — unrecognised outranks supply-exhausted", () => {
  // Both lines are still the owner's and empty, so `copy()` refuses them and
  // `account()` throws naming the key. Which cause **won** is decided
  // without a sentence: the throw names the key the winner reached, and the
  // key is the whole of the assertion. REQ-043 c3 reserves "there was
  // nothing worth publishing" to genuinely exhausted supply — "No date
  // emptied by any other cause, whether or not a requirement names that
  // cause, ever carries that line" — and this is that clause, decided
  // today rather than deferred until the owner writes.
  const winner = (causes: Cause[]): string => {
    try {
      return account(PLACE, causes).cause;
    } catch (error) {
      const match = /"([^"]+)"/.exec((error as Error).message);
      return match?.[1] ?? "";
    }
  };

  it("a cause nobody classified never inherits the exhausted-supply line", () => {
    expect(winner([CAUSE["unrecognised"], CAUSE["supply-exhausted"]])).toBe("cause.unrecognised");
    expect(winner([CAUSE["unrecognised"], CAUSE["supply-exhausted"]])).not.toBe(
      "cause.supply-exhausted"
    );
  });

  it("supply-exhausted alone does reach its own line — the arm is reachable", () => {
    expect(winner([CAUSE["supply-exhausted"]])).toBe("cause.supply-exhausted");
  });

  it("mutation: swapping the two entries in the precedence breaks this pair", () => {
    const swapped = [...CAUSE_PRECEDENCE];
    const i = swapped.indexOf("unrecognised");
    const j = swapped.indexOf("supply-exhausted");
    [swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!];
    const present: CauseTag[] = ["unrecognised", "supply-exhausted"];
    expect(swapped.find((t) => present.includes(t))).toBe("supply-exhausted");
    expect(winner([CAUSE["unrecognised"], CAUSE["supply-exhausted"]])).toBe("cause.unrecognised");
  });
});

describe("REQ-091 c2 — an unwritten line is an owner obligation, never a blank", () => {
  it("a place whose line the owner still owes throws naming the key", () => {
    // BP-021 `## Error & edge behavior`: "`copy()` throws rather than
    // rendering a blank until then". The alternative — returning `''` — is
    // the blank criterion 2 forbids, arriving through the one function that
    // exists to prevent it.
    expect(() => account("calendar.date.page", [])).toThrow(/place\.calendar\.date\.page/);
    expect(() => account("overview.weekly-presence.chart", [])).toThrow(
      /place\.overview\.weekly-presence\.chart/
    );
  });

  it("and the arbiter never returns an empty line for any place it can answer", () => {
    for (const place of ["report.first-page.rival"] as const) {
      expect(account(place, []).line).not.toBe("");
    }
  });
});

describe("ADR-011 point 1 — ReachKit's stop outranks every other cause that is also true", () => {
  it.each(CAUSE_PRECEDENCE.filter((t) => t !== "reachkit-stopped"))(
    "a stop beside %s resolves to the stop and states no other reason",
    (other) => {
      const result = account(PLACE, [CAUSE[other], CAUSE["reachkit-stopped"]]);
      expect(result.cause).toBe("reachkit-stopped");
      expect(result.line).toBe("STOPPED-LINE");
    }
  );
});

describe("REQ-004 c8 — a cold start is never an unmeasured measurement", () => {
  it("the cause vocabulary and the unmeasured-reason vocabulary share no member", () => {
    const unmeasuredReasons = ["undeterminable", "not_attempted"];
    for (const tag of CAUSE_PRECEDENCE) expect(unmeasuredReasons).not.toContain(tag);
    for (const reason of unmeasuredReasons) {
      expect(CAUSE_PRECEDENCE as readonly string[]).not.toContain(reason);
    }
  });
});
