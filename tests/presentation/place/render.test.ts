// tests/presentation/place/render.test.ts — BUILD §6.6, REQ-091 c2
//
// The renderer. What this file decides is that `Place<T>` has nowhere to
// put a blank: the renderings REQ-091 criterion 2 forbids are absent from
// the return type, not tested for downstream.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COPY, TODO_COPY_MARKER } from "@/lib/presentation/copy";
import { unmeasured, measuredZero } from "@/lib/measure/measured";
import {
  PLACES,
  emptyStateLine,
  renderPlace,
  type Place,
  type PlaceKey,
} from "@/lib/presentation/place";

const AT = new Date("2026-09-06T00:00:00.000Z");
const VALUE_PLACE: PlaceKey = "report.first-page.rival";
const MODULE_PLACE: PlaceKey = "calendar.date.page";
const SERIES_PLACE: PlaceKey = "overview.weekly-presence.chart";

const RENDER_SOURCE = path.resolve(
  import.meta.dirname,
  "../../../src/lib/presentation/place/render.ts"
);

describe("REQ-091 c2 — the return type has no blank and no hidden arm", () => {
  it("a Place is either filled or accounted, and nothing else compiles", () => {
    // @ts-expect-error — there is no `blank` arm.
    const blank: Place<number> = { state: "blank", place: VALUE_PLACE };
    // @ts-expect-error — there is no `hidden` arm.
    const hidden: Place<number> = { state: "hidden", place: VALUE_PLACE };
    // @ts-expect-error — the accounted arm's line is required, never undefined.
    const lineless: Place<number> = { state: "accounted", place: VALUE_PLACE, cause: "no-presence-yet" };
    expect([blank, hidden, lineless]).toHaveLength(3);
  });

  it("the source names no blank, hidden, placeholder or spinner rendering", () => {
    const source = readFileSync(RENDER_SOURCE, "utf8");
    const code = source
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
      .join("\n");
    for (const forbidden of ['"blank"', "'blank'", '"hidden"', "'hidden'", "placeholder", "spinner"]) {
      expect(code, `render.ts must not name ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("REQ-091 c2 — null, [] and unmeasured are accounted, never empty", () => {
  it("null is a cause, and comes back as one line", () => {
    const p = renderPlace(VALUE_PLACE, null);
    expect(p.state).toBe("accounted");
    if (p.state !== "accounted") throw new Error("unreachable");
    expect(p.cause).toBe("no-presence-yet");
    expect(p.line).toBe(COPY[PLACES[VALUE_PLACE].line]);
  });

  it("an empty list is a cause — the module stays on the screen carrying its line", () => {
    const p = renderPlace(MODULE_PLACE, [], [{ tag: "named", line: "NOTHING-PLANNED" }]);
    expect(p.state).toBe("accounted");
    if (p.state !== "accounted") throw new Error("unreachable");
    expect(p.line).toBe("NOTHING-PLANNED");
  });

  it("a chart with no series is a cause, not an absent chart", () => {
    const p = renderPlace(SERIES_PLACE, [], [{ tag: "named", line: "NO-WEEKS-YET" }]);
    expect(p.state).toBe("accounted");
    if (p.state !== "accounted") throw new Error("unreachable");
    expect(p.line).not.toBe("");
  });

  it("and with no cause at all it reaches the place's own line, which the owner has written", () => {
    // Never a blank. The unwritten baseline used to throw naming the key,
    // then (#246) render the `TODO(copy)` marker; since #460 the line is
    // the owner's approved sentence, and a blank is still what cannot
    // happen.
    const accounted = renderPlace(SERIES_PLACE, []);
    expect(accounted.state).toBe("accounted");
    expect(accounted.state === "accounted" && accounted.line).toBe(
      COPY["place.overview.weekly-presence.chart"]
    );
    expect(accounted.state === "accounted" && accounted.line).not.toBe(TODO_COPY_MARKER);
  });

  it("an unmeasured measurement is accounted, and says so through its own cause", () => {
    const p = renderPlace(VALUE_PLACE, unmeasured<number>("undeterminable", AT), [
      { tag: "named", line: "MEASUREMENT-FAILED" },
    ]);
    expect(p.state).toBe("accounted");
    if (p.state !== "accounted") throw new Error("unreachable");
    expect(p.cause).toBe("named");
  });

  it("a 'module' place with no entries and no series is accounted, never dropped", () => {
    expect(renderPlace(MODULE_PLACE, {}, [{ tag: "named", line: "NOTHING-PLANNED" }]).state).toBe(
      "accounted"
    );
  });
});

describe("REQ-004 c7 — a measured zero fills its place", () => {
  it("zero is a value, not an absence", () => {
    const p = renderPlace(VALUE_PLACE, 0);
    expect(p.state).toBe("filled");
    if (p.state !== "filled") throw new Error("unreachable");
    expect(p.value).toBe(0);
  });

  it("a Measured whose kind is zero is a value too", () => {
    const p = renderPlace(VALUE_PLACE, measuredZero(0, AT));
    expect(p.state).toBe("filled");
  });

  it("a non-empty list fills its place", () => {
    const p = renderPlace(MODULE_PLACE, ["a"]);
    expect(p.state).toBe("filled");
  });
});

describe("emptyStateLine — the line for a place with no cause to arbitrate", () => {
  it("returns the place's own line and nothing else", () => {
    expect(emptyStateLine(VALUE_PLACE)).toEqual({ line: COPY[PLACES[VALUE_PLACE].line] });
  });
});
