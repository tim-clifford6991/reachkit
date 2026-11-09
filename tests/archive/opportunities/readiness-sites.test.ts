// Readiness is assessed in three places only: the week's commit, the evening
// check of its rows, and the rows a refresh planner has just created between
// Mondays (decision 2026-11-05-2390, amending 2026-10-24-1624).
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

function callSites(): { file: string; line: number }[] {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" }).filter((file) => /\.tsx?$/.test(file));
  return files.flatMap((file) =>
    readFileSync(`src/${file}`, "utf8")
      .split("\n")
      .flatMap((line, n) => (/\bassessReadiness\(/.test(line) && !/function assessReadiness\(/.test(line) ? [{ file: `src/${file}`, line: n + 1 }] : []))
  );
}

describe("readiness is assessed in three places", () => {
  it("the week's commit and the evening check in plan.ts, and the refresh planners' one helper", () => {
    const sites = callSites();
    expect(sites.map((site) => site.file).sort()).toEqual([
      "src/lib/opportunities/plan.ts",
      "src/lib/opportunities/plan.ts",
      "src/lib/opportunities/refresh.ts",
    ]);
    const refresh = readFileSync("src/lib/opportunities/refresh.ts", "utf8").split("\n");
    const at = sites.find((site) => site.file.endsWith("refresh.ts"))!.line;
    const helper = refresh.slice(0, at).filter((line) => /^(export )?async function /.test(line)).pop();
    // The day's update fallback plans its row through the same helper (decision 2026-11-08-2503).
    expect(helper).toMatch(/^export async function persistAssessed\(/);
  });
});
