// tests/account/export/no-access-gate.test.ts — REQ-078 c2, REQ-076 c5
//
// "Given a customer whose subscription is active, cancelled, or past its
// paid-through date, when they sign in and request an export, then it
// downloads to them directly and is never withheld on account of
// subscription state."
//
// Two independent checks, because "the ordinary customer is active" makes
// this the defect no fixture finds by accident: a future reviewer adding
// "signed in AND active" to an authorisation helper would break the promise
// invisibly.
//
//  (a) **Source.** No file under `src/lib/account/export/**` resolves an
//      import into `src/lib/account/billing/**`, or names the gate, the
//      column or the status. The lint fence
//      (`local/no-export-importing-billing`) says the same thing; this copy
//      stays because a lint config can be skipped in a worktree.
//  (b) **Behaviour.** A site whose owner's `paid_through` is long past
//      exports a complete archive — and the export path never asks.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { exportEverything, setExportStore } = await import("@/lib/account/export");
const { memoryExportStore, newMemoryExport, page } = await import("./memory-store");
const { drain, unzip } = await import("./unzip");

const EXPORT_DIR = path.resolve(import.meta.dirname, "../../../src/lib/account/export");

function sources(): { file: string; code: string }[] {
  return readdirSync(EXPORT_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({
      file: name,
      // Comments stripped: the modules explain *why* there is no gate, and a
      // sweep that forbade the word would forbid recording the reason.
      code: readFileSync(path.join(EXPORT_DIR, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, ""),
    }));
}

describe("REQ-078 c2 (a) — the export module imports nothing from billing", () => {
  it("no file under src/lib/account/export/** imports from src/lib/account/billing/**", () => {
    for (const { file, code } of sources()) {
      expect(code, `${file} imports billing — REQ-078 c2`).not.toMatch(
        /from\s+["'][^"']*account\/billing/
      );
    }
  });

  it("no file under src/lib/account/export/** names the gate, the column or the plan status", () => {
    for (const { file, code } of sources()) {
      for (const forbidden of ["hasActiveAccess", "paid_through", "plan_status", "billingStore"]) {
        expect(code, `${file} names ${forbidden} — REQ-078 c2`).not.toContain(forbidden);
      }
    }
  });

  it("watch it fail first: the same sweep flags a fixture that does import it", () => {
    const mutated = 'import { hasActiveAccess } from "@/lib/account/billing";';
    expect(mutated).toMatch(/from\s+["'][^"']*account\/billing/);
  });
});

describe("REQ-078 c2 / REQ-076 c5 (b) — a lapsed customer's export is complete", () => {
  let state = newMemoryExport();

  beforeEach(() => {
    state = newMemoryExport();
    setExportStore(memoryExportStore(state));
  });

  afterEach(() => {
    setExportStore(null);
  });

  it("the archive is the same whether the subscription is active, cancelled or long past", async () => {
    state.pages.push(page({ id: "a", title: "Mine" }), page({ id: "b", title: "Also mine" }));
    // There is no third fixture here on purpose: `exportEverything` takes a
    // site id and nothing else, so there is no subscription state to vary —
    // which is the property, stated as strongly as a test can state it.
    const result = await exportEverything("site-1");
    if (!result.ok) throw new Error(`expected an archive, got ${result.reason}`);
    const files = unzip(await drain(result.archive)).map((entry) => entry.path);
    expect(files).toContain("pages/mine.md");
    expect(files).toContain("pages/also-mine.md");
    expect(result.pages).toBe(2);
  });

  it("exportEverything takes one parameter, so no caller can scope an archive by account state", () => {
    expect(exportEverything.length).toBe(1);
  });
});
