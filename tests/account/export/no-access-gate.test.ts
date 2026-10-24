// tests/account/export/no-access-gate.test.ts — REQ-078 c2, REQ-076 c5
//
// "Given a customer whose subscription is active, cancelled, or past its
// paid-through date, when they sign in and request an export, then it
// downloads to them directly and is never withheld on account of
// subscription state."
//
// The export path cannot ask: `exportEverything` takes a site id and nothing
// else. That it imports nothing from billing is the lint fence
// `local/no-export-importing-billing`, and that it names no gate column is
// `tests/account/billing/single-gate.test.ts`'s sweep over `src/`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { exportEverything, setExportStore } = await import("@/lib/account/export");
const { memoryExportStore, newMemoryExport, page } = await import("./memory-store");
const { drain, unzip } = await import("./unzip");

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
    expect(exportEverything.length).toBe(1);
  });
});
