// Readiness is assessed in two places only: the week's commit and the
// evening check of its rows (owner ruling C6, 2026-10-19).
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

function callSites(): string[] {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" }).filter((file) => /\.tsx?$/.test(file));
  return files.flatMap((file) =>
    readFileSync(`src/${file}`, "utf8")
      .split("\n")
      .flatMap((line, n) => (/\bassessReadiness\(/.test(line) && !/function assessReadiness\(/.test(line) ? [`src/${file}:${n + 1}`] : []))
  );
}

describe("readiness is assessed in two places", () => {
  it("the week's commit and the evening check, both in plan.ts", () => {
    const sites = callSites();
    expect(sites).toHaveLength(2);
    expect(sites.every((site) => site.startsWith("src/lib/opportunities/plan.ts:"))).toBe(true);
  });
});
