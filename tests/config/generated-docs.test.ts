// docs/MEASUREMENT.md and docs/PROCESSES.md are generated, and `audit` fails
// when either differs from its registry. Runs scripts/drift-audit.mjs as the
// audit workflow does, on this checkout and on a copy with one change seeded.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { measurementDoc, readMeasures } from "../../scripts/measurement-doc.mjs";
import { processMap } from "../../scripts/process-map.mjs";

const ROOT = path.resolve(__dirname, "../..");
const AUDIT = path.join(ROOT, "scripts/drift-audit.mjs");
const DOCS = ["docs/MEASUREMENT.md", "docs/PROCESSES.md"] as const;

/** The audit's verdict on each generated document, read from its table. */
function audit(root: string): { hard: number; rows: Record<string, string> } {
  const r = spawnSync(process.execPath, [AUDIT, "--root", root], { encoding: "utf8" });
  const rows: Record<string, string> = {};
  for (const m of r.stdout.matchAll(/^\| generated \| (\w+) \| ([^|]+) \|/gm)) rows[String(m[2]).trim()] = String(m[1]);
  return { hard: Number(r.stdout.match(/_Hard failures: (\d+)\./)?.[1]), rows };
}

let copies: string[] = [];
afterEach(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
  copies = [];
});

/** A checkout holding only what the two generators read, and their output. */
function copyRoot(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "generated-docs-"));
  copies.push(dir);
  const sources = (readMeasures(ROOT) as { source: string }[]).map((m) => m.source.split("#")[0] ?? m.source);
  for (const rel of ["src/jobs", "src/lib/config/constants.ts", "src/lib/measure/registry.ts", ...DOCS, ...sources]) {
    cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
  }
  return dir;
}

function edit(root: string, rel: string, from: string, to: string): void {
  const file = path.join(root, rel);
  const text = readFileSync(file, "utf8");
  expect(text).toContain(from);
  writeFileSync(file, text.replace(from, to));
}

describe("generated documents", () => {
  it("regenerating either document on this checkout gives no diff, and audit says so", () => {
    expect(measurementDoc(ROOT)).toBe(readFileSync(path.join(ROOT, DOCS[0]), "utf8"));
    expect(processMap(ROOT)).toBe(readFileSync(path.join(ROOT, DOCS[1]), "utf8"));
    expect(audit(ROOT)).toEqual({ hard: 0, rows: { [DOCS[0]]: "OK", [DOCS[1]]: "OK" } });
  });

  it("a copy with nothing changed passes both", () => {
    expect(audit(copyRoot()).rows).toEqual({ [DOCS[0]]: "OK", [DOCS[1]]: "OK" });
  });

  it.each([
    ["a definition", "src/lib/measure/registry.ts", "Distinct pages of the site", "Every page of the site", DOCS[0]],
    ["a constant a definition names", "src/lib/config/constants.ts", "BLOG_READS_WINDOW_D = 7 as const", "BLOG_READS_WINDOW_D = 9 as const", DOCS[0]],
    ["a job's schedule", "src/jobs/scan-rescore.ts", 'RESCORE_TICK_CRON = "7,22,37,52 * * * *"', 'RESCORE_TICK_CRON = "*/5 * * * *"', DOCS[1]],
    ["a job's key", "src/jobs/scan-run.ts", 'idempotencyKey: ["scanId"]', 'idempotencyKey: ["scanId", "tier"]', DOCS[1]],
  ])("a changed %s fails audit until the document is regenerated", (_, rel, from, to, doc) => {
    const root = copyRoot();
    const before = audit(root).hard;
    edit(root, rel, from, to);
    const seeded = audit(root);
    expect(seeded.rows[doc]).toBe("MISMATCH");
    expect(seeded.hard).toBe(before + 1);
  });

  it("a source that declares no such function fails audit", () => {
    const root = copyRoot();
    edit(root, "src/lib/measure/registry.ts", "#top20Pages", "#top20PagesGone");
    expect(audit(root).rows[DOCS[0]]).toBe("MALFORMED");
  });

  it("a job the generator cannot read fails audit rather than being left out", () => {
    const root = copyRoot();
    edit(root, "src/jobs/publish-verify.ts", "trigger: {", "trigger: makeTrigger({");
    expect(audit(root).rows[DOCS[1]]).toBe("MALFORMED");
  });
});
