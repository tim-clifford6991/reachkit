// Issue #295 — the layout sweep's seed writes rows the engine could have
// written.
//
// The flake this closes was not a layout defect at all. `tests/ui/layout/seed.ts`
// wrote every seeded opportunity's evidence as `{"family":"write"}` — legal
// jsonb, legal against `opportunities_evidence_family_agrees`, and not an
// `Evidence` any part of §7 could have produced: the Write arm carries a
// `query`, a `volume` and a `rival`. `readOpportunity` hands whatever it read
// straight back as one, so the calendar's `measuredAtOf` read `.at` off an
// absent `volume` and `/app/calendar` threw for **every** live request. Next
// answered with its own error page, which carries none of the app's
// stylesheet — and whether that page kept the stylesheet or not came down to
// how far the streamed response had got, which is why a deterministic break
// reached CI as a one-in-five flake.
//
// So the assertion is about the seed, where the defect was, and it is a
// runtime one: the type would have caught this if the seed had built the
// object in TypeScript, and it did not because the seed writes SQL text. This
// is that missing check.
import { describe, expect, it } from "vitest";
import type { Acceptance, Evidence } from "@/lib/opportunities";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  acceptanceFor,
  ACCESS_ENDS_ON,
  LIVE_DRAFTS,
  scheduledFor,
  seededVolume,
  SETUP_COMPLETED_ON,
  SWEEP_NOW,
  writeEvidence,
} from "../ui/layout/seed-rows";

/** A `Measured<T>` as it survives a round trip through jsonb: the arm, the
 *  value and the instant, with the instant still an ISO string. */
function expectMeasured(m: unknown): void {
  expect(m).toBeTypeOf("object");
  const measured = m as { kind?: unknown; value?: unknown; at?: unknown };
  expect(measured.kind).toBe("measured");
  expect(measured.value).not.toBeUndefined();
  expect(typeof measured.at).toBe("string");
  expect(Number.isNaN(new Date(measured.at as string).getTime())).toBe(false);
}

describe("the layout seed's opportunity rows", () => {
  it("writes a whole Write evidence for every draft it seeds — query, volume and rival", () => {
    for (const index of LIVE_DRAFTS.keys()) {
      const evidence = JSON.parse(writeEvidence(index)) as Evidence;
      expect(evidence.family).toBe("write");
      if (evidence.family !== "write") return;

      expect(evidence.query.length).toBeGreaterThan(0);
      // The member whose absence threw. Every non-Fix evidence carries one,
      // and the calendar reads its date onto the day panel's provenance line.
      expectMeasured(evidence.volume);
      expect(evidence.volume.kind).toBe("measured");
      if (evidence.volume.kind === "unmeasured") return;
      expect(evidence.volume.value).toBe(seededVolume(index));

      expect(evidence.rival.domain.length).toBeGreaterThan(0);
      expectMeasured(evidence.rival.url);
      expectMeasured(evidence.rival.position);
    }
  });

  it("gives each row a different demand, so the ranking has a strict order", () => {
    const volumes = [...LIVE_DRAFTS.keys()].map((index) => seededVolume(index));
    expect(new Set(volumes).size).toBe(volumes.length);
    expect(volumes.every((volume) => volume > 0)).toBe(true);
  });

  it("dates that evidence off a fixed instant, not off today", () => {
    // The second half of date-stability: a provenance line derived from the
    // clock moves the rendered sentence, and the committed picture under it,
    // on every run.
    const first = JSON.parse(writeEvidence(0)) as Evidence;
    const again = JSON.parse(writeEvidence(0)) as Evidence;
    expect(first).toEqual(again);
    if (first.family === "fix") return;
    expect(first.volume.at as unknown as string).not.toContain(
      new Date().toISOString().slice(0, 10)
    );
  });

  it("writes an acceptance test in one of §7's three forms — never a shape of its own", () => {
    for (const index of LIVE_DRAFTS.keys()) {
      const acceptance = JSON.parse(acceptanceFor(index)) as Acceptance;
      expect(["top20", "named_on", "gate_cleared"]).toContain(acceptance.form);
      // A Write row can never carry the gate form: `gate_cleared` is the Fix
      // family's, and `doneWhen` reaches it only by falling through both
      // named arms — which is exactly what the old `{"check": "..."}` did.
      expect(acceptance.form).not.toBe("gate_cleared");
    }
  });

  it("dates a scheduled page off the sweep's own instant, not off the clock", () => {
    // Issue #305. It used to read `new Date()` — one read, which closed
    // #295's cross-midnight flake — and that still left the seeded pages
    // moving one calendar cell every midnight, which is why `/app/calendar`
    // could not be photographed as the live account. The day is `SWEEP_NOW`'s
    // now, and `SWEEP_NOW` is the same instant the app renders as today.
    const frozen = new Date(SWEEP_NOW);
    const midday = Date.UTC(frozen.getUTCFullYear(), frozen.getUTCMonth(), frozen.getUTCDate(), 12);
    for (const offset of [-2, 0, 1, 3]) {
      expect(scheduledFor(offset)).toBe(
        new Date(midday + offset * 86_400_000).toISOString().slice(0, 10)
      );
    }
  });

  it("answers the same dates whatever day it is asked", () => {
    // The property the case above is for: two calls a midnight apart are the
    // same string. Asserted by asking twice rather than by mocking a clock —
    // there is no clock left in it to mock.
    expect([scheduledFor(-2), scheduledFor(0), scheduledFor(3)]).toEqual([
      scheduledFor(-2),
      scheduledFor(0),
      scheduledFor(3),
    ]);
    expect(scheduledFor(0)).toBe(SWEEP_NOW.slice(0, 10));
  });
});

describe("the layout seed's clock reads", () => {
  const SEED = readFileSync(
    path.join(import.meta.dirname, "../ui/layout/seed.ts"),
    "utf8"
  );

  it("dates every account's access on a fixed day, not on the day the seed ran", () => {
    // Issue #304. `paid_through` was `now() + interval '365 days'`, and
    // `/app/settings` states that day in words — "cancelling keeps
    // everything running until Sep 8, 2027" — inside the captured viewport.
    // A seed that read the clock therefore made the picture a different one
    // every day: two baselines taken a day apart differed by 60-odd pixels
    // where the day and the year are written, and the shift the narrower
    // glyph put on everything after them.
    expect(Number.isNaN(Date.parse(ACCESS_ENDS_ON))).toBe(false);
    expect(Number.isNaN(Date.parse(SETUP_COMPLETED_ON))).toBe(false);
    expect(SEED).toContain("'${ACCESS_ENDS_ON}'");
    expect(SEED).toContain("'${SETUP_COMPLETED_ON}'");
    expect(SEED).not.toContain("interval '365 days'");
  });

  it("keeps a year of headroom on that day, so it is moved on purpose", () => {
    // `hasActiveAccess()` is `paid_through > now()` and nothing else
    // (ADR-050), so the day this date passes every seeded account loses
    // access and every `/app` address in the sweep redirects. This fails a
    // year before that, while the fix is a one-line edit rather than a
    // morning spent reading redirects.
    const yearAhead = new Date();
    yearAhead.setUTCFullYear(yearAhead.getUTCFullYear() + 1);
    expect(
      Date.parse(ACCESS_ENDS_ON),
      `tests/ui/layout/seed-rows.ts: ACCESS_ENDS_ON (${ACCESS_ENDS_ON}) is less than a year away. ` +
        "Move it further out — when it passes, hasActiveAccess() is false for every seeded " +
        "account and every /app address in the sweep answers with the sign-in prompt."
    ).toBeGreaterThan(yearAhead.getTime());
  });
});

// ── the render path's clock reads (issue #305) ──────────────────────────

/**
 * The four surfaces that read a clock, and the one seam they read it
 * through.
 *
 * Asserted over the source because that is where the property lives: every
 * module under `src/lib/` takes its `now` as an argument, so a surface is
 * the only place a wall-clock read can appear, and a new `new Date()` in one
 * of these four would silently unfreeze the sweep — the baselines would go
 * back to being pictures of the day they were taken, which is the defect
 * this issue closed. A rendered assertion could not catch it: the picture is
 * right on the day it is taken and wrong the next.
 *
 * The list is not a glob: these are the four that read a clock today, and a
 * fifth surface that needs one is a deliberate addition to this list rather
 * than an omission nobody notices.
 */
const CLOCK_READING_SURFACES = [
  "src/app/(account)/app/_overview/store.ts",
  "src/app/(account)/app/_shell/store.ts",
  "src/app/(account)/app/settings/store.ts",
  "src/app/(account)/app/calendar/provider.ts",
] as const;

describe("the render path's clock reads", () => {
  const REPO_ROOT = path.join(import.meta.dirname, "../..");
  const sourceOf = (rel: string): string => readFileSync(path.join(REPO_ROOT, rel), "utf8");

  for (const rel of CLOCK_READING_SURFACES) {
    it(`${rel} reads today through the seam, never the wall clock`, () => {
      const source = sourceOf(rel);
      expect(source).toContain('from "@/lib/config/now"');
      // Comments quote `new Date()` when they explain what was there before,
      // so the assertion is about code: the string with a following `;`, a
      // `)` or a `,` is a call being used, and none is left.
      const calls = source
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
        .filter((line) => /new Date\(\)/.test(line));
      expect(calls, `${rel} still reads the wall clock: ${calls.join(" / ")}`).toEqual([]);
    });
  }

  it("the seam refuses a frozen clock on a real deployment", () => {
    // The whole reason a test binding may exist in the product at all. The
    // behaviour is `tests/config/now.test.ts`'s; what is asserted here is
    // that the boot path calls it, because a refusal nothing invokes is a
    // comment.
    const boot = sourceOf("src/instrumentation.ts");
    expect(boot).toContain("assertClockBinding");
    expect(boot).toContain('log("clock", "checked")');
  });
});
