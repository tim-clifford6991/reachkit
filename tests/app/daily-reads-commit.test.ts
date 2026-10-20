// `local/daily-reads-commit` against the repo's real `eslint.config.mjs`:
// src/lib/generate takes only the date's page and the committed week from
// the plan, and nothing that ranks.
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const ROOT = path.resolve(__dirname, "../..");
const RULE = "local/daily-reads-commit";
const BOOT_MS = 60_000;

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: ROOT });
  await eslint.lintText("export const warmUp = true;\n", { filePath: path.join(ROOT, "src/lib/generate/warm-up.ts") });
}, BOOT_MS);

async function hits(source: string, file = "src/lib/generate/seeded.ts"): Promise<number> {
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, file) });
  return result!.messages.filter((m) => m.ruleId === RULE).length;
}

describe("the daily path reads the commit and never ranks", () => {
  it.each([
    ['import { planWeek } from "@/lib/opportunities/plan";\nvoid planWeek;\n', "the weekly commit, from the plan"],
    ['import { pageForDay, supplyDepth } from "@/lib/opportunities/plan";\nvoid pageForDay; void supplyDepth;\n', "any other plan export"],
    ['import * as plan from "@/lib/opportunities/plan";\nvoid plan;\n', "the whole plan"],
    ['import { rankOpen } from "@/lib/opportunities";\nvoid rankOpen;\n', "the ranking, from the barrel"],
    ['import { planWeek } from "@/lib/opportunities";\nvoid planWeek;\n', "the commit, from the barrel"],
    ['import { writableDays } from "@/lib/opportunities/rank/open";\nvoid writableDays;\n', "the ranking module"],
    ['import { choose } from "@/lib/opportunities/choose";\nvoid choose;\n', "the choice"],
    ['export async function f() {\n  const { rankOpen } = await import("@/lib/opportunities");\n  return rankOpen;\n}\n', "a lazy import"],
  ])("reports %#: %s", async (source) => {
    expect(await hits(source)).toBe(1);
  });

  it("leaves the date's page, the committed week and the rest of the barrel alone", async () => {
    const source = [
      'import { committedWeek, pageForDay } from "@/lib/opportunities/plan";',
      'import { opportunityById, restTopic, type Opportunity } from "@/lib/opportunities";',
      'import type { PlanEntry } from "@/lib/opportunities/store";',
      "export const used: unknown[] = [committedWeek, pageForDay, opportunityById, restTopic];",
      "export type O = Opportunity | PlanEntry;",
      "",
    ].join("\n");
    expect(await hits(source)).toBe(0);
  });

  it("holds only under src/lib/generate: the weekly pass may rank", async () => {
    expect(await hits('import { rankOpen } from "@/lib/opportunities";\nvoid rankOpen;\n', "src/lib/opportunities/seeded.ts")).toBe(0);
  });

  it("src/lib/generate on this branch is green", async () => {
    const results = await eslint.lintFiles(["src/lib/generate/**/*.ts"]);
    expect(results.length).toBeGreaterThan(10);
    expect(results.flatMap((r) => r.messages.filter((m) => m.ruleId === RULE).map((m) => `${r.filePath}: ${m.message}`))).toEqual([]);
  }, BOOT_MS);
});
