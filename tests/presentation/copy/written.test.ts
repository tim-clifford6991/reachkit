// tests/presentation/copy/written.test.ts — issue #19
//
// `isWritten` is the question a surface asks before it speaks a line the
// owner may not have written yet (`src/lib/presentation/copy/written.ts`).
// Its whole contract is that it answers the same fact `OWNER_OWED` is
// derived from, for every key, so a surface guarded by it and a `copy()`
// call that would throw can never disagree.
import { describe, expect, it } from "vitest";
import { COPY, copy, isWritten, type CopyKey } from "../../../src/lib/presentation/copy/index.ts";
import { OWNER_OWED } from "../../../src/lib/presentation/copy/registry.ts";

describe("isWritten agrees with OWNER_OWED over the whole registry", () => {
  it("returns false for exactly the owner-owed keys and true for every other", () => {
    const owed = (Object.keys(COPY) as CopyKey[]).filter((key) => !isWritten(key));
    expect(owed.sort()).toEqual([...OWNER_OWED].sort());
    expect(owed.length).toBeGreaterThan(0); // rule 5.5: the set it partitions is not empty
  });

  it("a key it answers true for renders through copy(); one it answers false for throws", () => {
    // Every key it answers false for throws out of copy(), whatever slots
    // that key declares — the throw for an owner-owed key comes first
    // (BP-020 step 6a), before any slot is looked at.
    for (const key of Object.keys(COPY) as CopyKey[]) {
      if (!isWritten(key)) expect(() => copy(key)).toThrow("owner-owed");
    }
    // The discriminating half, stated on one key of each kind rather than
    // over the whole registry (slotted keys need vars copy() would demand).
    expect(isWritten("signin.heading")).toBe(true);
    expect(copy("signin.heading")).toBe(COPY["signin.heading"]);
    expect(isWritten("signin.link_dead")).toBe(false);
    expect(() => copy("signin.link_dead")).toThrow("signin.link_dead");
  });
});
