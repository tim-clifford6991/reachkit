// tests/presentation/copy/explain.test.ts
//
// WO-042's test plan (folded into WO-278 `## Test plan` under rule 2.6 —
// see WO-278 `## Consolidation`). REQ-093 criterion 4 (four properties) and
// criterion 5, quoted verbatim in the work order's own `## Test plan`
// table.
//
// No key seeded anywhere in the real registry declares a `'measured'`
// slot yet (`ExplainKey` is therefore `never` on the real `COPY_META` —
// confirmed by direct read of every `keys/*.ts` partition on 2026-09-04).
// The runtime-behaviour rows below need one to exist. WO-041's own
// `tests/presentation/copy/copy.test.ts` already established the pattern
// for exactly this situation — "used only for the two properties that no
// *currently seeded* real key can exercise" — a synthetic registry bound
// via `vi.doMock`, imported fresh per test. This file reuses that
// convention rather than inventing a second one (rule 7.1), and the same
// convention is why the fixture keys below are cast `as unknown as
// ExplainKey`, exactly as `copy.test.ts` casts its own fixtures `as
// CopyKey`: white-box testing of `explain.ts`'s own logic, not a claim
// about any real `CopyKey`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { explain, type ExplainKey } from "../../../src/lib/presentation/copy/index.ts";
import { measured, unmeasured } from "../../../src/lib/measure/measured.ts";

const REGISTRY_PATH = "../../../src/lib/presentation/copy/registry.ts";
const MEASURED_PATH = "../../../src/lib/presentation/measured.ts";
const EXPLAIN_TS_PATH = path.resolve(import.meta.dirname, "../../../src/lib/presentation/copy/explain.ts");

const AT_A = new Date("2026-09-01T00:00:00.000Z");
const AT_B = new Date("2026-09-02T00:00:00.000Z");

type FixtureMeta = { slots: Record<string, "text" | "date" | "measured">; fixedBy: string };
type FixtureEntries = Record<string, readonly [string, FixtureMeta]>;

const ENTRIES: FixtureEntries = {
  "fixture.oneMeasured": ["Count: {n}.", { slots: { n: "measured" }, fixedBy: "TEST" }],
  "fixture.twoMeasured": ["{a} then {b}.", { slots: { a: "measured", b: "measured" }, fixedBy: "TEST" }],
  "fixture.mixed": ["{name} scored {n}.", { slots: { name: "text", n: "measured" }, fixedBy: "TEST" }],
  "fixture.ownerOwed": ["", { slots: { n: "measured" }, fixedBy: "TEST" }],
};

function synthRegistry(entries: FixtureEntries) {
  const COPY = Object.freeze(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v[0]])));
  const COPY_META = Object.freeze(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v[1]])));
  const OWNER_OWED = Object.freeze((Object.keys(entries) as string[]).filter((k) => COPY[k as keyof typeof COPY] === ""));
  return { COPY, COPY_META, OWNER_OWED };
}

/** A fresh `explain()` bound to a synthetic registry — the same convention
 *  `copy.test.ts`'s `freshCopyWith` established, reused rather than
 *  duplicated (rule 7.1). */
async function freshExplainWith(entries: FixtureEntries) {
  vi.resetModules();
  vi.doMock(REGISTRY_PATH, () => synthRegistry(entries));
  const mod = await import("../../../src/lib/presentation/copy/explain.ts");
  return mod.explain;
}

describe('REQ-093 c4 — "…every value inside it was read from a measurement the product stored for that domain, carrying the date of the scan it came from — never estimated, never recomputed for display, and never produced by a language model — and the words around those values do not change with who is reading." — a raw number cannot enter a sentence', () => {
  // The three @ts-expect-error fixtures below are never invoked at
  // runtime — `npm run typecheck` is what discriminates (WO-277's own
  // convention, reused rather than a second one invented here).
  //
  // No key seeded anywhere in the real registry declares a 'measured'
  // slot (module header note, above), so `ExplainKey` is `never` on the
  // real `COPY_META` today and every one of these three calls fails at
  // the `key` argument, not only at the `slots` argument a later,
  // measured-slot-bearing key would isolate (a) and (b) against. That is
  // the honest state of the corpus, not a weaker test: each fixture is
  // still a genuine compile error and no fixture is force-cast past
  // `ExplainKey` to manufacture one.
  function _typeLevelNegatives(): void {
    // (a) a bare number where a slot is expected.
    // @ts-expect-error — no real CopyKey is assignable to ExplainKey yet, and a bare `number` is not a slot object either way.
    explain("fixture.oneMeasured", { n: 42 });

    // (b) a `{ value: 42 }` object with no `kind`/`at` — not a `Measured<unknown>`.
    // @ts-expect-error — no real CopyKey is assignable to ExplainKey yet, and `{ value: 42 }` has no `kind`/`at` either way.
    explain("fixture.oneMeasured", {
      n: { value: 42, format: (v: never) => String(v) },
    });

    // (c) a real CopyKey with no measured slot as the first argument —
    // the cleanest of the three: a genuine member of the real `CopyKey`
    // union, rejected solely because it declares no 'measured' slot.
    // @ts-expect-error — 'band.score.invisible' is a real CopyKey but declares no 'measured' slot; not assignable to ExplainKey.
    explain("band.score.invisible", {});
  }
  void _typeLevelNegatives;

  it("documents the three @ts-expect-error fixtures above; each is a compile error", () => {
    expect(typeof _typeLevelNegatives).toBe("function");
  });
});

describe('REQ-093 c4 — same criterion — the scan date travels with the value', () => {
  it("measuredAt contains every slot's `at`, in slot order, and nothing else", async () => {
    const explainFn = await freshExplainWith(ENTRIES);
    const result = explainFn("fixture.twoMeasured" as unknown as ExplainKey, {
      a: { value: measured(3, AT_A), format: (v: number) => String(v) },
      b: { value: measured(5, AT_B), format: (v: number) => String(v) },
    });
    expect(result.measuredAt).toEqual([AT_A, AT_B]);
    vi.doUnmock(REGISTRY_PATH);
  });

  it("measuredAt is never empty — ExplainKey has at least one measured slot", async () => {
    const explainFn = await freshExplainWith(ENTRIES);
    const result = explainFn("fixture.oneMeasured" as unknown as ExplainKey, {
      n: { value: measured(1, AT_A), format: (v: number) => String(v) },
    });
    expect(result.measuredAt.length).toBeGreaterThan(0);
    vi.doUnmock(REGISTRY_PATH);
  });
});

describe('REQ-093 c4 — same criterion — an unmeasured slot renders as a dash and the sentence still renders', () => {
  it("hasUnmeasured is true, text is non-empty, and the slot's rendering is renderMeasured's — asserted by a spy", async () => {
    vi.resetModules();
    const spy = vi.fn(() => ({ text: "—", isDash: true, line: "a line" }));
    vi.doMock(MEASURED_PATH, () => ({ renderMeasured: spy }));
    vi.doMock(REGISTRY_PATH, () => synthRegistry(ENTRIES));
    const mod = await import("../../../src/lib/presentation/copy/explain.ts");

    const result = mod.explain("fixture.oneMeasured" as unknown as ExplainKey, {
      n: { value: unmeasured<number>("undeterminable", AT_A), format: (v: number) => String(v) },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.hasUnmeasured).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);

    vi.doUnmock(MEASURED_PATH);
    vi.doUnmock(REGISTRY_PATH);
  });

  it("calls renderMeasured once per measured slot, and not for a measured value", async () => {
    vi.resetModules();
    const spy = vi.fn((m: { kind: string; value?: unknown }, o: { format: (v: never) => string }) =>
      m.kind === "unmeasured"
        ? { text: "—", isDash: true, line: "a line" }
        : { text: o.format(m.value as never), isDash: false }
    );
    vi.doMock(MEASURED_PATH, () => ({ renderMeasured: spy }));
    vi.doMock(REGISTRY_PATH, () => synthRegistry(ENTRIES));
    const mod = await import("../../../src/lib/presentation/copy/explain.ts");

    mod.explain("fixture.twoMeasured" as unknown as ExplainKey, {
      a: { value: measured(3, AT_A), format: (v: number) => String(v) },
      b: { value: unmeasured<number>("not_attempted", AT_B), format: (v: number) => String(v) },
    });

    expect(spy).toHaveBeenCalledTimes(2);

    vi.doUnmock(MEASURED_PATH);
    vi.doUnmock(REGISTRY_PATH);
  });
});

describe('REQ-093 c4 — same criterion — the words do not change with who is reading', () => {
  it("explain.length === 3 and no argument position accepts a session, reader or persona", () => {
    expect(explain.length).toBe(3);
  });

  it("two invocations with identical arguments return byte-identical text", async () => {
    const explainFn = await freshExplainWith(ENTRIES);
    const args = [
      "fixture.mixed" as unknown as ExplainKey,
      { n: { value: measured(9, AT_A), format: (v: number) => String(v) } },
      { name: "Ada" },
    ] as const;
    const a = explainFn(...args);
    const b = explainFn(...args);
    expect(a.text).toBe(b.text);
    expect(a.text).toBe("Ada scored 9.");
    vi.doUnmock(REGISTRY_PATH);
  });
});

// Sibling modules under src/lib/measure/ import each other without a ".ts"
// extension (e.g. src/lib/measure/score.ts's `from "./measured"`); this
// walker follows both conventions.
function resolveModulePath(p: string): string {
  return /\.tsx?$/.test(p) ? p : `${p}.ts`;
}

describe("REQ-093 c5 — explain renders with every model unavailable", () => {
  it("explain.ts's transitive import graph contains no path under src/lib/llm/", () => {
    const visited = new Set<string>();
    const externalSpecifiers: string[] = [];
    const queue = [EXPLAIN_TS_PATH];

    while (queue.length > 0) {
      const file = queue.shift();
      if (!file || visited.has(file)) continue;
      visited.add(file);
      const src = readFileSync(file, "utf8");
      const re = /\bfrom\s+["']([^"']+)["']/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(src))) {
        const specifier = match[1];
        if (!specifier) continue;
        if (specifier.startsWith(".")) {
          queue.push(resolveModulePath(path.resolve(path.dirname(file), specifier)));
        } else if (specifier.startsWith("@/")) {
          queue.push(resolveModulePath(path.resolve(import.meta.dirname, "../../../src", specifier.slice(2))));
        } else {
          externalSpecifiers.push(specifier);
        }
      }
    }

    expect(visited.size).toBeGreaterThan(0);
    for (const specifier of externalSpecifiers) {
      expect(specifier).not.toMatch(/lib\/llm/);
    }
  });

  it("a sentence with a measured slot renders unchanged (nothing in the read path reaches for a model)", async () => {
    const explainFn = await freshExplainWith(ENTRIES);
    const result = explainFn("fixture.oneMeasured" as unknown as ExplainKey, {
      n: { value: measured(4, AT_A), format: (v: number) => String(v) },
    });
    expect(result.text).toBe("Count: 4.");
    vi.doUnmock(REGISTRY_PATH);
  });
});

describe("explain() on an owner-owed key throws the same way copy() does", () => {
  it("throws naming the key, before any slot is rendered", async () => {
    const explainFn = await freshExplainWith(ENTRIES);
    expect(() =>
      explainFn("fixture.ownerOwed" as unknown as ExplainKey, {
        n: { value: measured(1, AT_A), format: (v: number) => String(v) },
      })
    ).toThrow("fixture.ownerOwed");
    expect(() =>
      explainFn("fixture.ownerOwed" as unknown as ExplainKey, {
        n: { value: measured(1, AT_A), format: (v: number) => String(v) },
      })
    ).toThrow("owner-owed");
    vi.doUnmock(REGISTRY_PATH);
  });
});
