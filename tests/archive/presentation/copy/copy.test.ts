// tests/presentation/copy/copy.test.ts
//
// WO-041 test plan. REQ-093 criterion 4, quoted verbatim in the work
// order's own `## Test plan` table, plus the additional tests WO-041 owns
// (owner-owed throw, the missing-key compile error).
import { describe, expect, it, vi } from "vitest";
import { copy, type CopyKey } from "../../../src/lib/presentation/copy/index.ts";
// OWNER_OWED is WO-041's own addition to the interface (not the
// blueprint's), declared in registry.ts and not re-exported through the
// public barrel — see registry.test.ts's same import.
import { OWNER_OWED } from "../../../src/lib/presentation/copy/registry.ts";

const REGISTRY_PATH = "../../../src/lib/presentation/copy/registry.ts";

/** A fresh `copy()` bound to a synthetic registry — used only for the two
 *  properties that no *currently seeded* real key can exercise: a
 *  'measured' slot (no seeded key declares one; that arrives with a later
 *  work order) and slot substitution (every seeded key that carries a slot
 *  is owner-owed, which throws before substitution ever runs). This is
 *  white-box testing of copy.ts's own logic, not a claim about any real
 *  CopyKey. */
async function freshCopyWith(entries: Record<string, readonly [string, { slots: Record<string, "text" | "date" | "measured">; fixedBy: string }]>) {
  vi.resetModules();
  const COPY = Object.freeze(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v[0]])));
  const COPY_META = Object.freeze(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v[1]])));
  // Derived exactly as registry.ts derives it: a key is owner-owed when its
  // value is the empty string.
  const OWNER_OWED = Object.freeze(Object.entries(entries).filter(([, v]) => v[0] === "").map(([k]) => k));
  vi.doMock(REGISTRY_PATH, () => ({ COPY, COPY_META, OWNER_OWED }));
  const mod = await import("../../../src/lib/presentation/copy/copy.ts");
  return mod.copy;
}

describe("REQ-093 c4 — copy() refuses a measured key and takes no reader", () => {
  it("throws naming the key when its meta declares a 'measured' slot", async () => {
    const copyFn = await freshCopyWith({
      "fixture.measured": ["irrelevant {amount}", { slots: { amount: "measured" }, fixedBy: "TEST" }],
    });
    // `vars` supplies the one declared slot, so the general "slot named in
    // meta.slots and absent from vars" throw (step 6c) cannot fire here —
    // only the measured-slot check (step 6b) can. Without a satisfying
    // `vars`, both throw paths embed the key in their message and the
    // assertion below could not tell them apart (TST-018 defect 1).
    expect(() => copyFn("fixture.measured" as CopyKey, { amount: "12" })).toThrow(
      "declares a 'measured' slot"
    );
    expect(() => copyFn("fixture.measured" as CopyKey, { amount: "12" })).toThrow("fixture.measured");
    vi.doUnmock(REGISTRY_PATH);
  });

  it("copy.length is 2 and its exported signature accepts no third argument", () => {
    expect(copy.length).toBe(2);
  });

  it("two calls with identical arguments return byte-identical strings", async () => {
    const copyFn = await freshCopyWith({
      "fixture.hello": ["Hello {name}.", { slots: { name: "text" }, fixedBy: "TEST" }],
    });
    const a = copyFn("fixture.hello" as CopyKey, { name: "Ada" });
    const b = copyFn("fixture.hello" as CopyKey, { name: "Ada" });
    expect(a).toBe(b);
    expect(a).toBe("Hello Ada.");
    vi.doUnmock(REGISTRY_PATH);
  });
});

describe("copy() implementation order (WO-041 step 6)", () => {
  it("substitutes named slots from vars", async () => {
    const copyFn = await freshCopyWith({
      "fixture.greet": [
        "Hello {name}, you are {age}.",
        { slots: { name: "text", age: "text" }, fixedBy: "TEST" },
      ],
    });
    expect(copyFn("fixture.greet" as CopyKey, { name: "Ada", age: 30 })).toBe(
      "Hello Ada, you are 30."
    );
    vi.doUnmock(REGISTRY_PATH);
  });

  it("a slot named in COPY_META[key].slots and absent from vars throws naming the slot", async () => {
    const copyFn = await freshCopyWith({
      "fixture.needsName": ["Hello {name}.", { slots: { name: "text" }, fixedBy: "TEST" }],
    });
    expect(() => copyFn("fixture.needsName" as CopyKey, {})).toThrow("name");
    expect(() => copyFn("fixture.needsName" as CopyKey)).toThrow("name");
    vi.doUnmock(REGISTRY_PATH);
  });
});

describe("an owner-owed key throws rather than rendering blank", () => {
  // With every owed sentence written, the real OWNER_OWED is empty — the
  // goal, not a failure — so this holds vacuously on the true state and
  // bites again the moment an empty value lands.
  it("copy() throws on every OWNER_OWED key, and the message names the key", () => {
    for (const key of OWNER_OWED) {
      expect(() => copy(key)).toThrow(key);
      expect(() => copy(key)).toThrow("owner-owed");
    }
  });

  // The throw itself, proven on a synthetic empty-value key through the
  // same registry override the tests above use, so it stays exercised
  // however many real keys are owed.
  it("an empty-value key is owner-owed, and copy() throws naming it", async () => {
    const copyFn = await freshCopyWith({
      "fixture.owed": ["", { slots: {}, fixedBy: "TEST" }],
      "fixture.written": ["Written.", { slots: {}, fixedBy: "TEST" }],
    });
    expect(() => copyFn("fixture.owed" as CopyKey)).toThrow("fixture.owed");
    expect(() => copyFn("fixture.owed" as CopyKey)).toThrow("owner-owed");
    expect(copyFn("fixture.written" as CopyKey)).toBe("Written.");
    vi.doUnmock(REGISTRY_PATH);
  });
});

describe("a missing key is a compile error", () => {
  it("copy('not-a-key') does not type-check", () => {
    // @ts-expect-error — 'not-a-key' is not a CopyKey; a missing key is a
    // compile error, not a blank on a screen. Discharged by
    // `npm run typecheck`, not by Vitest.
    expect(() => copy("not-a-key")).toThrow();
  });
});
