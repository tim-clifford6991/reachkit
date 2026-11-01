import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apply } from "../../scripts/copy/apply.mjs";

const SPLIT = "We read every page of your site and then we score each thing we found on it for you.";
const FILES = {
  "src/lib/presentation/copy/keys/report.ts": `export const REPORT_COPY = Object.freeze({
  "report.read.where.local": ["In and around {place}", { slots: { place: "text" }, fixedBy: "SPEC §2" }],
  "report.split": [
    "${SPLIT}",
    { slots: {}, fixedBy: "owner 2026-10-20" },
  ],
  "report.stale": ["Old words", { slots: {}, fixedBy: "x" }],
  "report.slot": ["Hi {name}", { slots: { name: "text" }, fixedBy: "x" }],
  "report.conflict": ["One thing", { slots: {}, fixedBy: "x" }],
  "offer.start": ["Order now", { slots: {}, fixedBy: "x" }],
  "report.failed": ["Failed", { slots: {}, fixedBy: "x" }],
  "report.gone": ["Said twice", { slots: {}, fixedBy: "x" }],
});
`,
  "src/lib/presentation/copy/keys/chrome.ts": `export const CHROME_COPY = Object.freeze({
  "chrome.other": ["Other lane", { slots: {}, fixedBy: "x" }],
});
`,
  "docs/design/boards/canvas/PubReport.dc.html": `<html><body><ul><li class="badge"><svg></svg>In and around Austin</li></ul><p>Old words</p><p>Your draft</p></body></html>\n`,
  "docs/design/parity/baseline.json": `{\n  "PubReport": { "sha256": "0", "missing": 0, "components": 3 }\n}\n`,
  "tests/report/pin.test.ts": `expect(copy("report.split")).toBe("${SPLIT}");\nexpect(where).toBe('In and around {place}');\nexpect(run.state).toBe("Failed");\n`,
};

const rows = [
  { key: "report.read.where.local", current: "In and around {place}", proposed: "Near {place}", board: "PubReport · PubScan (not in repo)" },
  { key: "report.split", current: SPLIT, proposed: "We read your site and score it.", needsRuling: "no (O6 rewording)" },
  { key: "report.stale", current: "Older words", proposed: "New words" },
  { key: "report.slot", current: "Hi {name}", proposed: "Hi there" },
  { key: "offer.start", current: "Order now", proposed: "Buy" },
  { key: "report.conflict", current: "One thing", proposed: "A thing" },
  { key: "chrome.other", current: "Other lane", proposed: "Another lane" },
  { key: "report.failed", current: "Failed", proposed: "Did not finish" },
  { key: "report.gone", current: "Said twice", proposed: "(delete)" },
];
const second = {
  keys: [{ key: "report.conflict", current: "One thing", proposed: "The thing" }],
  cuts: [{ key: "report.cut", why: "said twice" }],
  jsx: [{ file: "src/app/x.tsx", from: "a", to: "b" }],
};

let root = "";
let result: ReturnType<typeof apply>;
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "copy-apply-"));
  for (const [rel, text] of Object.entries(FILES)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  result = apply({ root, lane: "L2", inputs: [{ name: "a.json", json: rows }, { name: "b.json", json: second }] });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("scripts/copy/apply.mjs", () => {
  it("applies only a key that passes every check, and lists each refusal as manual", () => {
    expect(result.applied.map((r) => r.key)).toEqual(["report.read.where.local", "report.split", "report.failed"]);
    expect(result.applied.find((r) => r.key === "report.split")?.ownerRuled).toBe(true);
    expect(Object.fromEntries(result.manual.map((m) => [m.what, m.why]))).toEqual({
      "report.stale": "stale: current no longer matches",
      "report.slot": "slots differ",
      "offer.start": "exempt or locked",
      "report.conflict": "conflict: another proposal differs",
      "chrome.other": "chrome.ts is not lane L2",
      "report.gone": "delete: a hand edit (key and its call sites)",
      "report.cut": "cut: a hand edit",
      "src/app/x.tsx": "jsx: a hand edit",
    });
    const keys = read("src/lib/presentation/copy/keys/report.ts");
    for (const kept of ['"Old words"', '"Hi {name}"', '"One thing"', '"Order now"', '"report.gone": ["Said twice"']) expect(keys).toContain(kept);
  });

  it("never writes a delete sentinel as text, and lists it as manual", () => {
    for (const proposed of ["(delete)", "(Cut)", "(remove)", "(drop)", "DELETE", "", "  "]) {
      const dry = apply({ root, lane: "L2", inputs: [{ name: "d.json", json: [{ key: "report.gone", current: "Said twice", proposed }] }], write: false });
      expect(dry.applied, JSON.stringify(proposed)).toEqual([]);
      expect(dry.manual).toEqual([{ what: "report.gone", why: "delete: a hand edit (key and its call sites)", source: "d.json" }]);
      expect(dry.written).toEqual([]);
    }
  });

  it("lists every cut and jsx entry as manual and applies none", () => {
    expect(result.manual.filter((m) => /^(cut|jsx):/.test(m.why))).toEqual([
      { what: "report.cut", why: "cut: a hand edit" },
      { what: "src/app/x.tsx", why: "jsx: a hand edit" },
    ]);
    expect(read("src/lib/presentation/copy/keys/report.ts").split("\n")).toHaveLength(FILES["src/lib/presentation/copy/keys/report.ts"].split("\n").length);
  });

  it("keeps a split entry split", () => {
    expect(read("src/lib/presentation/copy/keys/report.ts")).toContain(`"report.split": [\n    "We read your site and score it.",\n    { slots: {}`);
  });

  it("rewrites the board with its sample value and refreshes the board's baseline row", () => {
    const board = read("docs/design/boards/canvas/PubReport.dc.html");
    expect(board).toContain("<svg></svg>Near Austin</li>");
    const sha = createHash("sha256").update(board).digest("hex");
    expect(JSON.parse(read("docs/design/parity/baseline.json")).PubReport).toEqual({ sha256: sha, missing: 0, components: 3 });
  });

  it("swaps exact test pins and writes nothing else, never a budget", () => {
    expect(read("tests/report/pin.test.ts")).toBe(`expect(copy("report.split")).toBe("We read your site and score it.");\nexpect(where).toBe('Near {place}');\nexpect(run.state).toBe("Failed");\n`);
    expect(result.written).toEqual([
      "docs/design/boards/canvas/PubReport.dc.html",
      "docs/design/parity/baseline.json",
      "src/lib/presentation/copy/keys/report.ts",
      "tests/report/pin.test.ts",
    ]);
  });
});
