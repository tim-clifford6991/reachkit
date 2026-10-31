// A value we could not read is said in words, with the reader's subject inside the sentence, and never drawn as 0.
import { describe, expect, it } from "vitest";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import { copy } from "@/lib/presentation/copy";
import { measuredText, NOT_BUILT } from "@/app/(public)/scan/[domain]/_address/measured";

const AT = new Date("2026-10-26T06:00:00.000Z");
// A search query is lower case, so a line that opened on it would open on a small letter.
const WHAT = "emergency plumber austin";

describe.each([
  ["not checked this time", unmeasured<number>("undeterminable", AT)],
  ["not checked, the check stopped early", unmeasured<number>("not_attempted", AT)],
  ["not checked yet", unmeasured<number>("not_attempted", AT, NOT_BUILT)],
] as [string, Measured<number>][])("%s", (_name, value) => {
  const shown = measuredText(value, WHAT);

  it("draws the dash, never a 0", () => {
    expect(shown.isDash).toBe(true);
    expect(shown.text).toBe(copy("unmeasured.dash"));
    expect(shown.text).not.toBe("0");
  });

  it("says it in a sentence that starts with a capital and carries the subject inside it", () => {
    expect(shown.line).toMatch(/^\p{Lu}/u);
    expect(shown.line!.indexOf(WHAT)).toBeGreaterThan(0);
    expect(shown.line).not.toMatch(/\b0\b/);
  });
});

it("the three reasons are three different sentences", () => {
  const lines = [
    measuredText(unmeasured<number>("undeterminable", AT), WHAT).line,
    measuredText(unmeasured<number>("not_attempted", AT), WHAT).line,
    measuredText(unmeasured<number>("not_attempted", AT, NOT_BUILT), WHAT).line,
  ];
  expect(new Set(lines).size).toBe(3);
});
