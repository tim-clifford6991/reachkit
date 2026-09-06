// tests/app/shell/nopublish.test.ts — BUILD §4.4, REQ-040 criterion 4
//
// WO-154 `## Test plan`, row 2. The criterion, verbatim: "Given no publish
// is scheduled — publishing is paused, nothing is approved, no page is
// planned, or ReachKit itself stopped the work — when the customer looks at
// the navigation, then in place of a time it carries one written line naming
// which of those is the case; where it was ReachKit that stopped, that line
// 'names ReachKit's stop as the reason no publish is scheduled' (REQ-092
// criterion 7) and never one of the other three."
//
// ADR-011: "ReachKit's own stop outranks every other cause that is also
// true." That is the property the pair tests below discriminate — a resolver
// that returned the first cause it happened to test would pass the
// one-cause-at-a-time tests and fail these.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { nextPublishStatement } from "@/lib/presentation/stopped";
import {
  NEXT_PUBLISH_OTHERWISE,
  NO_PUBLISH_PRECEDENCE,
  resolveNoPublish,
  type NoPublishCauses,
  type NoPublishReason,
} from "@/app/(account)/app/_shell/nopublish";

const NONE: NoPublishCauses = {
  reachkit_stopped: false,
  publishing_paused: false,
  nothing_approved: false,
  nothing_planned: false,
};

const only = (...reasons: NoPublishReason[]): NoPublishCauses => ({
  ...NONE,
  ...Object.fromEntries(reasons.map((r) => [r, true])),
});

describe("the four causes, and the order they are resolved in", () => {
  it("the precedence is the four causes, stopped first, and nothing else", () => {
    expect([...NO_PUBLISH_PRECEDENCE]).toEqual([
      "reachkit_stopped",
      "publishing_paused",
      "nothing_approved",
      "nothing_planned",
    ]);
  });

  it.each(NO_PUBLISH_PRECEDENCE)("each of the four causes alone resolves to itself: %s", (reason) => {
    expect(resolveNoPublish(only(reason))).toBe(reason);
  });

  it("no cause at all resolves to nothing — that state is a scheduled publish", () => {
    expect(resolveNoPublish(NONE)).toBeUndefined();
  });
});

describe("REQ-092 c7 — ReachKit's stop outranks every other cause that is also true", () => {
  it("stopped and paused together resolve to reachkit_stopped and no other", () => {
    const reason = resolveNoPublish(only("reachkit_stopped", "publishing_paused"));
    expect(reason).toBe("reachkit_stopped");
    expect(reason).not.toBe("publishing_paused");
  });

  it("all four true resolve to reachkit_stopped", () => {
    expect(
      resolveNoPublish(
        only("reachkit_stopped", "publishing_paused", "nothing_approved", "nothing_planned")
      )
    ).toBe("reachkit_stopped");
  });

  it("mutation: reversing the precedence breaks the (stopped ∧ paused) pair", () => {
    const reversed = [...NO_PUBLISH_PRECEDENCE].reverse();
    const causes = only("reachkit_stopped", "publishing_paused");
    expect(reversed.find((r) => causes[r])).not.toBe("reachkit_stopped");
    expect(resolveNoPublish(causes)).toBe("reachkit_stopped");
  });

  it("the three lower causes still resolve among themselves in order", () => {
    expect(resolveNoPublish(only("nothing_approved", "nothing_planned"))).toBe("nothing_approved");
    expect(resolveNoPublish(only("publishing_paused", "nothing_planned"))).toBe("publishing_paused");
  });
});

describe("each cause has its own line, and the line is chosen in one place", () => {
  // Issue #20: the key table moved into `nextPublishStatement`
  // (`src/lib/presentation/stopped/statement.ts`), REQ-092 c7's one home.
  // What the shell keeps is the translation from its own four-boolean
  // vocabulary into that function's `otherwise` argument — three entries,
  // because a stop is not an `otherwise`.
  it("the three non-stop causes map one-to-one onto three distinct next-publish keys", () => {
    const keys = Object.values(NEXT_PUBLISH_OTHERWISE).map(
      (tag) => nextPublishStatement({ stopped: false, otherwise: { tag } }).key
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^next-publish\./);
    expect(keys).not.toContain("next-publish.stopped");
  });

  it("reachkit_stopped has no otherwise entry — it is passed as the stop itself", () => {
    expect(Object.keys(NEXT_PUBLISH_OTHERWISE)).not.toContain("reachkit_stopped");
    expect(Object.keys(NEXT_PUBLISH_OTHERWISE)).toHaveLength(NO_PUBLISH_PRECEDENCE.length - 1);
  });

  it("a stop resolves to next-publish.stopped — REQ-092 c7's own line", () => {
    const stopped = nextPublishStatement({
      stopped: true,
      // Publishing genuinely is paused as well; ADR-011 point 5 ignores it.
      otherwise: { tag: "paused" },
    });
    expect(stopped.key).toBe("next-publish.stopped");
    // It is the registry's line, not one composed here: the key exists.
    expect(Object.keys(COPY)).toContain("next-publish.stopped");
  });
});
