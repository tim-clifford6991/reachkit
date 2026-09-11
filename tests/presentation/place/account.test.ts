// tests/presentation/place/account.test.ts — BUILD §6.6, REQ-091 c2,
// REQ-043 c3/c5, ADR-011
//
// The arbiter. REQ-091 criterion 2's "exactly one written line" and
// REQ-043 criterion 5's "exactly one account of itself" are the same
// function call, and ADR-011's ordering is the array this file reads.
import { describe, expect, it } from "vitest";
import { COPY, TODO_COPY_MARKER } from "@/lib/presentation/copy";
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
  // Both lines are still the owner's. Since #246 they carry the
  // `TODO(copy)` marker rather than the empty value, so `account()` returns
  // instead of throwing and *which cause won* is read straight off the
  // answer — where this suite used to have to catch the throw and pull the
  // key out of its message. REQ-043 c3 reserves "there was nothing worth
  // publishing" to genuinely exhausted supply — "No date emptied by any
  // other cause, whether or not a requirement names that cause, ever
  // carries that line" — and this is that clause, decided today rather than
  // deferred until the owner writes.
  const winner = (causes: Cause[]): CauseTag => account(PLACE, causes).cause;

  it("a cause nobody classified never inherits the exhausted-supply line", () => {
    expect(winner([CAUSE["unrecognised"], CAUSE["supply-exhausted"]])).toBe("unrecognised");
    expect(winner([CAUSE["unrecognised"], CAUSE["supply-exhausted"]])).not.toBe("supply-exhausted");
  });

  it("supply-exhausted alone does reach its own line — the arm is reachable", () => {
    expect(winner([CAUSE["supply-exhausted"]])).toBe("supply-exhausted");
  });

  it("mutation: swapping the two entries in the precedence breaks this pair", () => {
    const swapped = [...CAUSE_PRECEDENCE];
    const i = swapped.indexOf("unrecognised");
    const j = swapped.indexOf("supply-exhausted");
    [swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!];
    const present: CauseTag[] = ["unrecognised", "supply-exhausted"];
    expect(swapped.find((t) => present.includes(t))).toBe("supply-exhausted");
    expect(winner([CAUSE["unrecognised"], CAUSE["supply-exhausted"]])).toBe("unrecognised");
  });

  it("and the two reach *different* lines, so the winner is visible in the sentence too", () => {
    // The tag alone would still pass if both arms rendered one line. They
    // are two keys, and the marker does not collapse them: each renders its
    // own, and `COPY` is what says which.
    expect(account(PLACE, [CAUSE["unrecognised"]]).line).toBe(COPY["cause.unrecognised"]);
    expect(account(PLACE, [CAUSE["supply-exhausted"]]).line).toBe(COPY["cause.supply-exhausted"]);
  });
});

describe("REQ-091 c2 — an unwritten line is an owner obligation, never a blank", () => {
  it("a place whose line the owner has written renders that line (#246, #460)", () => {
    // It used to throw (the keys were empty), then render the marker
    // (#246). The owner's approved set of 2026-09-10 wrote both lines, so
    // what comes back is the place's own sentence — still never `''`, and
    // no longer the marker.
    expect(account("calendar.date.page", []).line).toBe(COPY["place.calendar.date.page"]);
    expect(account("overview.weekly-presence.chart", []).line).toBe(
      COPY["place.overview.weekly-presence.chart"]
    );
    expect(account("calendar.date.page", []).line).not.toBe(TODO_COPY_MARKER);
    expect(account("overview.weekly-presence.chart", []).line).not.toBe(TODO_COPY_MARKER);
  });

  it("and the arbiter never returns an empty line for any place at all", () => {
    // Every place, not the one that happened to be written — which is what
    // this could assert before, and is the assertion #246 makes total.
    for (const place of Object.keys(PLACES) as PlaceKey[]) {
      expect(account(place, []).line, place).not.toBe("");
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
