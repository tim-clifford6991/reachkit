// Issue 1481 — the deployment's derivation: a fingerprint of the files under
// `src/lib` the re-score reaches. A change to one of them is a new derivation,
// which the `scan/rescore` tick re-scores every stored scan for; a change
// anywhere else is not.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { derivation, derivationFiles } from "../../scripts/derivation.mjs";

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

const FILES = {
  "src/lib/scan/rescore-run.ts": 'import { rescoreScan } from "./rescore";\nimport type { Drivers } from "@/lib/measure/score";\nexport const lazy = () => import("@/lib/db");\n',
  "src/lib/scan/rescore.ts": 'export { band } from "../measure/bands";\nexport function rescoreScan() {}\n',
  "src/lib/measure/score.ts": "export type Drivers = { score: number };\n",
  "src/lib/measure/bands.ts": "export const band = 25;\n",
  "src/lib/db/index.ts": "export const dbAdmin = () => null;\n",
  "src/lib/generate/page.ts": "export const page = 1;\n",
  "src/app/report.tsx": 'import { band } from "@/lib/measure/bands";\n',
};

describe("the re-score's derivation", () => {
  it("reaches the scoring files through static and type imports, and not the database's lazy one or an unreached file", () => {
    expect(derivationFiles(tree(FILES))).toEqual([
      "src/lib/measure/bands.ts",
      "src/lib/measure/score.ts",
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

  it("reaches the repository's own scoring, rivals and reading", () => {
    const files = derivationFiles();
    for (const file of ["src/lib/scan/rescore.ts", "src/lib/measure/score.ts", "src/lib/business/retrofit.ts", "src/lib/config/constants.ts"]) {
      expect(files).toContain(file);
    }
    expect(files.every((file: string) => file.startsWith("src/lib/"))).toBe(true);
  });
});
