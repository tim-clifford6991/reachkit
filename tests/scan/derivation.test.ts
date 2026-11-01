// Issue 1481 — the deployment's derivation: a fingerprint of the code under
// `src/lib` the re-score executes. A change to it is a new derivation, which
// the `scan/rescore` tick re-scores every stored scan for; a change anywhere
// else is not.
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { derivation, derivationFiles } from "../../scripts/derivation.mjs";
import { claimRequest, type RescoreQueue } from "../../src/lib/scan/rescore-run";
import { nextStep, type RunRecord } from "../../src/lib/scan/derivation";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "derivation-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

function copied(): string {
  const root = tree({});
  cpSync("src/lib", join(root, "src/lib"), { recursive: true });
  return root;
}

function edit(root: string, file: string, from: string, to: string): void {
  const text = readFileSync(join(root, file), "utf8");
  expect(text).toContain(from);
  writeFileSync(join(root, file), text.replace(from, to));
}

const FILES = {
  "src/lib/scan/rescore-run.ts":
    'import { rescoreScan } from "./rescore";\nimport type { Drivers } from "@/lib/measure/score";\nimport { type Row, type Cell } from "./row";\nexport const lazy = () => import("@/lib/db");\nexport const run = () => rescoreScan();\n',
  "src/lib/scan/row.ts": "export type Row = 1;\nexport type Cell = 2;\n",
  "src/lib/scan/rescore.ts": 'import { band } from "../measure/bands";\nexport function rescoreScan() {\n  return band;\n}\n',
  "src/lib/measure/score.ts": "export type Drivers = { score: number };\n",
  "src/lib/measure/bands.ts": "export const band = 25;\n",
  "src/lib/db/index.ts": "export const dbAdmin = () => null;\n",
  "src/lib/generate/page.ts": "export const page = 1;\n",
  "src/app/report.tsx": 'import { band } from "@/lib/measure/bands";\n',
};

describe("the re-score's derivation", () => {
  it("reaches the scoring files through static value imports, and not a type-only import, the database's lazy one or an unreached file", () => {
    expect(derivationFiles(tree(FILES))).toEqual([
      "src/lib/measure/bands.ts",
      "src/lib/scan/rescore-run.ts",
      "src/lib/scan/rescore.ts",
    ]);
  });

  it("changes when a scoring file changes, and only then", () => {
    const base = derivation(tree(FILES));
    expect(derivation(tree(FILES))).toBe(base);
    expect(derivation(tree({ ...FILES, "src/lib/measure/bands.ts": "export const band = 30;\n" }))).not.toBe(base);
    expect(derivation(tree({ ...FILES, "src/lib/generate/page.ts": "export const page = 2;\n" }))).toBe(base);
    expect(derivation(tree({ ...FILES, "src/app/report.tsx": "export {};\n" }))).toBe(base);
  });

  it("barrel re-exports are resolved to the used file", () => {
    const files = derivationFiles(
      tree({
        "src/lib/scan/rescore-run.ts":
          'import { GUARD } from "@/lib/config/constants";\nimport { fromStored } from "@/lib/presentation/text";\nexport const run = () => [GUARD, fromStored("a")];\n',
        "src/lib/config/constants.ts": 'export * from "./constants/scan";\nexport * from "./constants/ui";\n',
        "src/lib/config/constants/scan.ts": "export const GUARD = 15;\n",
        "src/lib/config/constants/ui.ts": "export const NAV = 3;\n",
        "src/lib/presentation/text.ts":
          'import { copy } from "./copy";\nexport const fromStored = (t: string) => ({ t });\nexport const label = () => copy("k");\n',
        "src/lib/presentation/copy/index.ts": 'export { copy } from "./registry";\n',
        "src/lib/presentation/copy/registry.ts": "export const copy = (k: string) => k;\n",
      }),
    );
    expect(files).toEqual([
      "src/lib/config/constants.ts",
      "src/lib/config/constants/scan.ts",
      "src/lib/presentation/text.ts",
      "src/lib/scan/rescore-run.ts",
    ]);
  });

  it("a copy key the re-score does not read leaves it unchanged; a constant it reads changes it", () => {
    const root = copied();
    const settled = derivation(root);
    edit(root, "src/lib/presentation/copy/keys/chrome.ts", '"chrome.wordmark": ["ReachKit"', '"chrome.wordmark": ["Reach Kit"');
    expect(derivation(root)).toBe(settled);
    edit(root, "src/lib/config/constants/scan.ts", "maxScoreMove: 15,", "maxScoreMove: 16,");
    const guarded = derivation(root);
    expect(guarded).not.toBe(settled);
    edit(root, "src/lib/config/constants/scan.ts", "export const SCORING = Object.freeze({", "export const SCORING = Object.freeze({ extra: 1,");
    expect(derivation(root)).not.toBe(guarded);
  });

  it("scoring roots stay in the set", () => {
    const files = derivationFiles();
    for (const file of ["src/lib/scan/rescore-run.ts", "src/lib/scan/rescore.ts", "src/lib/scan/derivation.ts", "src/lib/scan/report.ts", "src/lib/measure/score.ts", "src/lib/measure/drivers.ts", "src/lib/measure/bands.ts", "src/lib/measure/verdict.ts", "src/lib/config/constants/scan.ts"]) {
      expect(files).toContain(file);
    }
    expect(files.filter((file: string) => file.startsWith("src/lib/presentation/copy/"))).toEqual([]);
  });

  it("reaches the repository's own scoring, rivals and reading, and not the vendor's transport or a module only its types reach", () => {
    const files = derivationFiles();
    for (const file of ["src/lib/scan/rescore.ts", "src/lib/measure/score.ts", "src/lib/business/retrofit.ts", "src/lib/config/constants.ts"]) {
      expect(files).toContain(file);
    }
    for (const file of ["src/lib/vendors/dataforseo/transport.ts", "src/lib/scan/store.ts", "src/lib/market/views.ts", "src/lib/db/index.ts"]) {
      expect(files).not.toContain(file);
    }
    expect(files.every((file: string) => file.startsWith("src/lib/"))).toBe(true);
  });

  it("a deploy that changes only the vendor's transport asks a settled derivation nothing, so no stored scan is read; one that changes the re-score asks the apply", async () => {
    const root = copied();
    const settled = derivation(root);
    appendFileSync(join(root, "src/lib/vendors/dataforseo/transport.ts"), "export const deployed = 1;\n");
    const transport = derivation(root);
    appendFileSync(join(root, "src/lib/scan/rescore.ts"), "globalThis.deployed = 1;\n");
    const scoring = derivation(root);
    expect(transport).toBe(settled);
    expect(scoring).not.toBe(settled);

    const asked: string[] = [];
    const queue: RescoreQueue = {
      claim: async () => null,
      runs: async () => [
        { mode: "apply", derivation: settled, requestedAt: "2026-10-25T04:22:00Z", finishedAt: "2026-10-25T04:23:00Z", error: null, held: null, unreadable: 0 },
      ],
      ask: async (mode) => void asked.push(mode),
      answer: async () => undefined,
      failed: async () => undefined,
    };
    const at = new Date("2026-10-26T12:00:00Z");
    await expect(claimRequest(at, transport, queue, true)).resolves.toBeNull();
    expect(asked).toEqual([]);
    await claimRequest(at, scoring, queue, true);
    expect(asked).toEqual(["apply"]);
  });

  it("asks one apply at a new derivation, and nothing after a run there finished, held or failed", () => {
    const run = (r: Partial<RunRecord>): RunRecord => ({ mode: "apply", derivation: "d1", requestedAt: "2026-11-01T10:00:00Z", finishedAt: "2026-11-01T10:01:00Z", error: null, held: null, unreadable: 0, ...r });
    const table: [readonly RunRecord[], ReturnType<typeof nextStep>][] = [
      [[], { ask: "apply" }],
      [[run({ derivation: "d0" })], { ask: "apply" }],
      [[run({})], { settled: true }],
      [[run({ mode: "dry" })], { settled: true }],
      [[run({ held: "zapier.com moves 20 points" })], { held: "zapier.com moves 20 points" }],
      [[run({ error: "timeout" })], { held: "the apply failed: timeout" }],
      [[run({ finishedAt: null })], { wait: true }],
    ];
    for (const [runs, step] of table) expect(nextStep(runs, "d1")).toEqual(step);
  });
});
