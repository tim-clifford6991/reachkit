// A pull request sweeps half the width × theme cases; the nightly run on main sweeps them all.
import { describe, expect, it } from "vitest";
import { NO_OVERFLOW_THEMES, noOverflowCasesFor, noOverflowWidthsFor } from "../ui/layout/no-overflow";

const pairs = (path: string, pr: boolean) =>
  noOverflowCasesFor(path, pr).flatMap(({ width, themes }) => themes.map((theme) => `${width} ${theme}`));

describe.each(["/", "/app"])("the sweep's cases for %s", (path) => {
  it("the nightly sweeps every width in both themes", () => {
    expect(pairs(path, false)).toEqual(
      noOverflowWidthsFor(path).flatMap((w) => NO_OVERFLOW_THEMES.map((t) => `${w} ${t}`)),
    );
  });

  it("a pull request sweeps a subset that holds every width once and both themes", () => {
    const pr = pairs(path, true);
    const nightly = pairs(path, false);
    expect(pr.every((c) => nightly.includes(c))).toBe(true);
    expect(pr.map((c) => Number(c.split(" ")[0]))).toEqual([...noOverflowWidthsFor(path)]);
    expect(new Set(pr.map((c) => c.split(" ")[1]))).toEqual(new Set(NO_OVERFLOW_THEMES));
    expect(pr.length * 2).toBe(nightly.length);
  });
});
