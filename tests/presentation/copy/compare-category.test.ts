// The /compare lead and its search snippet name the same kinds of tool, in O6's plain words.
import { describe, expect, it } from "vitest";
import { COPY, type CopyKey } from "@/lib/presentation/copy";

const text = (key: CopyKey): string => (COPY as Record<string, string>)[key] ?? "";

/** The tools a "compares with A, B and C" clause names, in order. */
const named = (sentence: string): string[] =>
  (sentence.match(/compares with ([^.:]+)[.:]/)?.[1] ?? "").split(/, | and /).map((s) => s.trim());

describe("the /compare lead and snippet", () => {
  it("name the same tools", () => {
    expect(named(text("compare.lead")).length).toBeGreaterThan(1);
    expect(named(text("meta.compare.description"))).toEqual(named(text("compare.lead")));
  });

  it("never say SEO (O6 rule 4)", () => {
    for (const key of ["compare.lead", "meta.compare.description"] satisfies CopyKey[]) expect(text(key), key).not.toMatch(/\bSEO\b/);
  });
});
