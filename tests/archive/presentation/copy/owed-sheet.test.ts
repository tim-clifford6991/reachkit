// tests/presentation/copy/owed-sheet.test.ts
// Generator checks. The sheet itself is gitignored — not a merge artifact.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { OWNER_OWED, AWAITING_COPY } from "../../../src/lib/presentation/copy/registry.ts";
import { buildSheet, readRegistry } from "../../../scripts/copy/owed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Every key the sheet lists, read out of the first column of its tables. */
function keysListed(text: string): string[] {
  return [...text.matchAll(/^\| `([A-Za-z0-9._-]+)`/gm)].map((m) => m[1] as string);
}

describe("the owed-copy generator", () => {
  const generated = () => buildSheet(ROOT);

  it("is total: it lists every owed key the registry holds, and no other", () => {
    const owed = [...OWNER_OWED, ...AWAITING_COPY].sort();
    expect(keysListed(generated()).sort()).toEqual(owed);
  });

  it("reads the same registry TypeScript reads — same keys, same values", () => {
    const parsed = readRegistry(ROOT);
    const unwritten = parsed
      .filter((entry) => entry.value === "" || entry.value === "TODO(copy)")
      .map((entry) => entry.key)
      .sort();
    expect(unwritten).toEqual([...OWNER_OWED, ...AWAITING_COPY].sort());
  });

  it("lists every key exactly once, so the owner writes each sentence once", () => {
    const listed = keysListed(generated());
    expect(listed.length).toBe(new Set(listed).size);
  });
});
