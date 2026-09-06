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

const PLACE: PlaceKey = "calendar.date.page";

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

describe("REQ-091 c2 — a place holding nothing gets exactly one line", () => {
  it.each(subsetsUpTo(3).map((tags) => [tags.join("+"), tags] as const))(
    "%s resolves to the highest-ranked cause present, and to one line",
    (_name, tags) => {
      const shuffled = [...tags].reverse().map((tag) => CAUSE[tag]);
      const result = account(PLACE, shuffled);
      const expected = CAUSE_PRECEDENCE.find((tag) => tags.includes(tag));
      expect(result.cause).toBe(expected);
      expect(Object.keys(result).sort()).toEqual(["cause", "line"]);
      expect(typeof result.line).toBe("string");
      expect(result.line).not.toBe("");
    }
  );

  it("a winning arm's line is returned byte for byte — never with a second reason appended", () => {
    const result = account(PLACE, [CAUSE["reachkit-stopped"], CAUSE["supply-exhausted"]]);
    expect(result.line).toBe("STOPPED-LINE");
    expect(result.line).not.toContain(COPY["cause.supply-exhausted"]);
  });

  it("an empty causes array is accounted, never blank", () => {
    const result = account(PLACE, []);
    expect(result.cause).toBe("no-presence-yet");
    expect(result.line).toBe(COPY[PLACES[PLACE].line]);
    expect(result.line).not.toBe("");
  });

  it("the baseline account is the place's own line, and differs per place", () => {
    const a = account("calendar.date.page", []);
    const b = account("report.first-page.rival", []);
    expect(a.line).toBe(COPY["place.calendar.date.page"]);
    expect(b.line).toBe(COPY["place.report.first-page.rival"]);
  });
});

describe("ADR-011 point 2 — unrecognised outranks supply-exhausted", () => {
  it("a cause nobody classified never inherits the exhausted-supply line", () => {
    // REQ-043 c3 reserves "there was nothing worth publishing" to genuinely
    // exhausted supply: "No date emptied by any other cause, whether or not
    // a requirement names that cause, ever carries that line."
    const result = account(PLACE, [CAUSE["unrecognised"], CAUSE["supply-exhausted"]]);
    expect(result.cause).toBe("unrecognised");
    expect(result.line).toBe(COPY["cause.unrecognised"]);
    // Both sentences are still the owner's and both render the same visible
    // marker today, so the *key* is what discriminates and the sentence
    // assertion below is armed the day either one is written. It is stated
    // rather than skipped: a suite that quietly asserted nothing here would
    // read as covering the clause it does not yet cover (rule 5.5).
    if (COPY["cause.unrecognised"] !== COPY["cause.supply-exhausted"]) {
      expect(result.line).not.toBe(COPY["cause.supply-exhausted"]);
    }
  });

  it("mutation: swapping the two entries in the precedence breaks this pair", () => {
    const swapped = [...CAUSE_PRECEDENCE];
    const i = swapped.indexOf("unrecognised");
    const j = swapped.indexOf("supply-exhausted");
    [swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!];
    const present: CauseTag[] = ["unrecognised", "supply-exhausted"];
    expect(swapped.find((t) => present.includes(t))).toBe("supply-exhausted");
    expect(account(PLACE, [CAUSE["unrecognised"], CAUSE["supply-exhausted"]]).cause).toBe(
      "unrecognised"
    );
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
