// tests/scan/deep/notice.test.ts — BUILD §4.3, issue #36
//
// The release notice: one sentence projected from the current report,
// never a stored flag.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";

// `src/lib/config/env.ts` parses `process.env` at module load and throws
// on a missing binding, so the bindings go in before the dynamic imports
// below — the same order every suite that reaches the engine uses.
applyEnvFixture();

let stored: unknown = null;

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: () => {
      const self = {
        select: () => self,
        eq: () => self,
        is: () => self,
        limit: () => self,
        then: (resolve: (v: { data: { report: unknown }[]; error: null }) => unknown) =>
          Promise.resolve({ data: stored === null ? [] : [{ report: stored }], error: null }).then(
            resolve
          ),
      };
      return self;
    },
  }),
  db: () => ({ from: () => ({}) }),
}));

const { releaseNotice, unmeasuredParts } = await import("../../../src/lib/scan/deep/notice");
const { assembleReport } = await import("../../../src/lib/scan/store");
const { measuredZero, unmeasured } = await import("../../../src/lib/measure/measured");
const { fullSections, unreachedSections, AT } = await import("../report/fixtures");
const { COPY } = await import("../../../src/lib/presentation/copy/registry");

const NOTICE_CODE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/deep/notice.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

function asStored(sections: Parameters<typeof assembleReport>[0]): unknown {
  return JSON.parse(JSON.stringify(assembleReport(sections)));
}

beforeEach(() => {
  stored = null;
});

describe("REQ-029 c3 — a degraded pass yields one key naming what could not be measured", () => {
  it("a report that stopped at a ceiling yields the unmeasured key, with the parts it missed", async () => {
    stored = asStored(
      unreachedSections({
        market: unmeasured("not_attempted", AT),
        rivals: unmeasured("not_attempted", AT),
      })
    );
    const notice = await releaseNotice({ domain: "example.com" });
    expect(notice?.key).toBe("setup.release.unmeasured");
    expect(notice?.parts).toContain("market");
    expect(notice?.parts).toContain("rivals");
  });

  it("a section measured as zero is not reported as missing — a cold start is a measurement", () => {
    const report = assembleReport(
      unreachedSections({ questions: measuredZero([], AT), rivals: measuredZero([], AT) })
    );
    const parts = unmeasuredParts(report);
    expect(parts).not.toContain("questions");
    expect(parts).not.toContain("rivals");
    // The discriminating half: a genuinely unmeasured section beside them
    // still reports.
    expect(parts).toContain("market");
  });
});

describe("REQ-029 c5 — a failed pass yields the measurement-did-not-complete key", () => {
  it("a report whose stoppedReason is 'failed'", async () => {
    stored = asStored(unreachedSections({ stoppedReason: "failed" }));
    expect((await releaseNotice({ domain: "example.com" }))?.key).toBe("setup.release.incomplete");
  });

  it("no current report at all — the pass produced nothing", async () => {
    stored = null;
    expect((await releaseNotice({ domain: "example.com" }))?.key).toBe("setup.release.incomplete");
  });
});

describe("REQ-029 c4 — the emptiness is stated plainly, and this function invents nothing", () => {
  it("a complete report yields null however empty its findings are", async () => {
    stored = asStored(fullSections());
    expect(await releaseNotice({ domain: "example.com" })).toBeNull();
  });

  it("neither key composes a sentence — both are registry keys, and the parts stay internal handles", async () => {
    stored = asStored(unreachedSections());
    const notice = await releaseNotice({ domain: "example.com" });
    expect(Object.keys(notice?.vars ?? {})).toEqual([]);
    for (const part of notice?.parts ?? []) expect(part).toMatch(/^[a-z]+$/);
  });
});

describe("REQ-029 c6 — a projection, not a stored flag", () => {
  it("the notice is returned on every later read while the report is degraded, not only at release", async () => {
    stored = asStored(unreachedSections());
    const first = await releaseNotice({ domain: "example.com" });
    const second = await releaseNotice({ domain: "example.com" });
    expect(second).toEqual(first);
  });

  it("moving the current pointer to a complete report makes it null, with nothing cleared anywhere", async () => {
    stored = asStored(unreachedSections());
    expect(await releaseNotice({ domain: "example.com" })).not.toBeNull();

    stored = asStored(fullSections());
    expect(await releaseNotice({ domain: "example.com" })).toBeNull();
  });

  it("mutation check — a module-level cache would break the disappearance above; this module holds no mutable state and writes nothing", () => {
    expect(NOTICE_CODE).not.toMatch(/\blet\b|\bvar\b/);
    expect(NOTICE_CODE).not.toMatch(/\.update\(|\.insert\(|\.rpc\(/);
  });
});

describe("both keys exist in the registry", () => {
  it.each(["setup.release.unmeasured", "setup.release.incomplete"] as const)(
    "%s is a registered key",
    (key) => {
      expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true);
    }
  );
});
