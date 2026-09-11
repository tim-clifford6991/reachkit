// tests/presentation/copy/ruled-copy.test.ts
//
// WO-287's own test plan. REQ-002 c1, REQ-002 c3, REQ-003 c6, REQ-003 c7,
// REQ-004 c2, REQ-004 c6, REQ-004 c9, REQ-001 c14, REQ-001 c15, REQ-001
// c16, REQ-094 c7, REQ-001 c7, and constitution §1 with rule 1.2 (the
// eighteen values are the owner's, byte for byte), quoted verbatim in the
// work order's own `## Test plan` table.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COPY, COPY_META, copy, type CopyKey } from "../../../src/lib/presentation/copy/index.ts";
import { OWNER_OWED } from "../../../src/lib/presentation/copy/registry.ts";
import { LIMITING_LINES } from "../../../src/lib/presentation/bands.ts";
import { renderMeasured } from "../../../src/lib/presentation/measured.ts";
import { unmeasured } from "../../../src/lib/measure/measured.ts";
import type { ScoreFactorName } from "@/lib/measure/score";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULING_PATH = path.resolve(HERE, "__fixtures__/RULING-copy-2026-09-04.json");
const RULING: { strings: Record<string, string> } = JSON.parse(fs.readFileSync(RULING_PATH, "utf8"));

const AT = new Date("2026-09-04T00:00:00.000Z");

/** Every `{name}` marker present in a string, in the order it first
 *  appears, deduplicated — used both directions against a key's declared
 *  `slots` map. */
function markersOf(value: string): string[] {
  const found = [...value.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).filter((s): s is string => s !== undefined);
  return [...new Set(found)];
}

describe('REQ-002 c1 — "Given any report, when it renders, then it names in writing the address to which a request to remove the report about that domain is sent, readable by a visitor with no account, session, or payment." — ruled-copy/removal · one key, one address', () => {
  it("copy('removal.address') returns the ruled value and does not throw", () => {
    expect(() => copy("removal.address")).not.toThrow();
    expect(copy("removal.address")).toBe(RULING.strings["removal.address"]);
  });

  it("removal.line.on-report declares exactly { address: 'text' }", () => {
    expect(COPY_META["removal.line.on-report"].slots).toEqual({ address: "text" });
  });

  it("copy() throws naming 'address' when it is not supplied, and renders with no marker left when it is", () => {
    expect(() => copy("removal.line.on-report")).toThrow("address");
    const rendered = copy("removal.line.on-report", { address: copy("removal.address") });
    expect(rendered).not.toContain("{");
  });

  it("the rendered line contains copy('removal.address')", () => {
    const rendered = copy("removal.line.on-report", { address: copy("removal.address") });
    expect(rendered).toContain(copy("removal.address"));
  });
});

describe('REQ-002 c3 — "… in its place one written line says the report was removed at the domain owner\'s request and names the address criterion 1 names — until a request to that same address asks for that domain to be scannable again." — ruled-copy/removal · the removed line takes both slots and names the same address', () => {
  it("removal.line.removed declares exactly { domain: 'text', address: 'text' }", () => {
    expect(COPY_META["removal.line.removed"].slots).toEqual({ domain: "text", address: "text" });
  });

  it("copy() throws naming 'domain' when only 'address' is supplied, and naming 'address' when only 'domain' is", () => {
    expect(() => copy("removal.line.removed", { address: "remove@reachkit.app" })).toThrow("domain");
    expect(() => copy("removal.line.removed", { domain: "example.com" })).toThrow("address");
  });

  it("supplied both, the rendered line contains copy('removal.address') and no marker is left", () => {
    const rendered = copy("removal.line.removed", { domain: "example.com", address: copy("removal.address") });
    expect(rendered).toContain(copy("removal.address"));
    expect(rendered).not.toContain("{");
  });
});

describe('REQ-003 c6 — "… then it does not start, they are refused with one written line saying how long until they may scan again, and the refused scan, having never run, produces no report of its own." — ruled-copy/notice · the network-limit refusal carries exactly one wait slot', () => {
  it("notice.refused.network-limit declares exactly { wait: 'text' }", () => {
    expect(COPY_META["notice.refused.network-limit"].slots).toEqual({ wait: "text" });
  });

  it("copy() throws naming 'wait' when it is absent, and renders with no marker left when it is supplied", () => {
    expect(() => copy("notice.refused.network-limit")).toThrow("wait");
    const rendered = copy("notice.refused.network-limit", { wait: "40 minutes" });
    expect(rendered).not.toContain("{");
  });
});

describe('REQ-003 c7 — "… if the running scan is of the domain they asked for they are returned to it, and if it is not they are refused in writing, told how long until they may scan, and are never shown a scan or a report of a domain they did not ask for." — ruled-copy/notice · the scan-running refusal is its own line', () => {
  it("notice.refused.scan-running declares exactly { wait: 'text' } and renders the same way", () => {
    expect(COPY_META["notice.refused.scan-running"].slots).toEqual({ wait: "text" });
    expect(() => copy("notice.refused.scan-running")).toThrow("wait");
    const rendered = copy("notice.refused.scan-running", { wait: "2 minutes" });
    expect(rendered).not.toContain("{");
  });

  it("its value differs from notice.refused.network-limit's, so the two causes are never one line", () => {
    expect(COPY["notice.refused.scan-running"]).not.toBe(COPY["notice.refused.network-limit"]);
  });
});

describe('REQ-004 c2 — "… then one written line beside it names the one driver, of the three the score is composed of, whose measurement holds the score down the most — and names it without stating that driver\'s value, its weight, or how the score is put together." — ruled-copy/verdict · three lines, one per driver, and no value in any of them', () => {
  const KEYS = ["verdict.limiting.foundations", "verdict.limiting.answerability", "verdict.limiting.presence"] as const;

  it("each of the three resolves through copy() without throwing and declares no slots", () => {
    for (const key of KEYS) {
      expect(() => copy(key)).not.toThrow();
      expect(COPY_META[key].slots).toEqual({});
    }
  });

  it("every ScoreFactorName maps onto one of the three through LIMITING_LINES", () => {
    // Type-level: LIMITING_LINES is declared Record<ScoreFactorName, CopyKey>
    // (src/lib/presentation/bands.ts) — a key added to ScoreFactorName
    // without a matching LIMITING_LINES entry is a compile error, not
    // something this runtime assertion needs to re-derive. This checks
    // the runtime set agrees.
    const factorNames: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];
    expect(Object.keys(LIMITING_LINES).sort()).toEqual([...factorNames].sort());
    for (const name of factorNames) {
      expect(KEYS).toContain(LIMITING_LINES[name]);
    }
  });

  it("none of the three values contains a digit or a percent sign", () => {
    for (const key of KEYS) {
      expect(COPY[key]).not.toMatch(/\d/);
      expect(COPY[key]).not.toContain("%");
    }
  });
});

describe('REQ-004 c6 — "… one written line names which driver was missing or, where no driver depended on that input, names what could not be measured …" — ruled-copy/unmeasured · the undeterminable line names its subject', () => {
  it("unmeasured.undeterminable declares exactly { what: 'text' }", () => {
    expect(COPY_META["unmeasured.undeterminable"].slots).toEqual({ what: "text" });
  });

  it("renderMeasured on an unmeasured value with reason undeterminable returns a line with the subject substituted and no marker left", () => {
    const result = renderMeasured(unmeasured<number>("undeterminable", AT), {
      format: (v) => String(v),
      unmeasuredLine: "unmeasured.undeterminable",
      what: "answerability",
    });
    expect(result.line).toBe(copy("unmeasured.undeterminable", { what: "answerability" }));
    expect(result.line).not.toContain("{");
    expect(result.line).toContain("answerability");
  });

  it("documents that omitting the subject at the call site is a compile error, not a blank line", () => {
    // The @ts-expect-error fixture below is never invoked at runtime;
    // `npm run typecheck` is what discriminates (WO-277's own convention,
    // reused by measured.test.ts and bands.test.ts's own fixtures).
    function _typeLevelNegative(): void {
      // @ts-expect-error — renderMeasured's options object requires `what`; this call omits it.
      renderMeasured(unmeasured<number>("undeterminable", AT), {
        format: (v: number) => String(v),
        unmeasuredLine: "unmeasured.undeterminable",
      });
    }
    void _typeLevelNegative;
    expect(typeof _typeLevelNegative).toBe("function");
  });
});

describe('REQ-004 c9 — "… one written line states it was not measured because the scan stopped early, and it is never shown or recorded as 0." — ruled-copy/unmeasured · the not-attempted line is a different line', () => {
  it("unmeasured.not-attempted declares exactly { what: 'text' } and renders with the subject substituted, no marker left", () => {
    expect(COPY_META["unmeasured.not-attempted"].slots).toEqual({ what: "text" });
    const result = renderMeasured(unmeasured<number>("not_attempted", AT), {
      format: (v) => String(v),
      unmeasuredLine: "unmeasured.not-attempted",
      what: "presence",
    });
    expect(result.line).toBe(copy("unmeasured.not-attempted", { what: "presence" }));
    expect(result.line).not.toContain("{");
  });

  it("the two reasons are never rendered as the same sentence", () => {
    expect(COPY["unmeasured.undeterminable"]).not.toBe(COPY["unmeasured.not-attempted"]);
    const a = renderMeasured(unmeasured<number>("undeterminable", AT), {
      format: (v: number) => String(v),
      unmeasuredLine: "unmeasured.undeterminable",
      what: "presence",
    });
    const b = renderMeasured(unmeasured<number>("not_attempted", AT), {
      format: (v: number) => String(v),
      unmeasuredLine: "unmeasured.not-attempted",
      what: "presence",
    });
    expect(a.line).not.toBe(b.line);
  });
});

describe('REQ-001 c14 — "… then one written line says it is incomplete and names what was not measured, and a re-scan control is offered beside that line however new the report is." — ruled-copy/notice · the incomplete line names what is missing, and its control has its own label', () => {
  it("notice.incomplete declares exactly { what: 'text' } and renders with the subject substituted", () => {
    expect(COPY_META["notice.incomplete"].slots).toEqual({ what: "text" });
    const rendered = copy("notice.incomplete", { what: "presence" });
    expect(rendered).not.toContain("{");
    expect(rendered).toContain("presence");
  });

  it("control.rescan-incomplete resolves to a non-empty label declaring no slots", () => {
    expect(COPY_META["control.rescan-incomplete"].slots).toEqual({});
    expect(copy("control.rescan-incomplete").length).toBeGreaterThan(0);
  });

  it("the two are distinct keys with distinct values", () => {
    expect(COPY["notice.incomplete"]).not.toBe(COPY["control.rescan-incomplete"]);
  });
});

describe('REQ-001 c15 — "Given a stored report 7 days old or older, when it is opened, then a re-scan control is offered — whether it measured everything it set out to or only part of it — and the stored report stays readable until the visitor chooses to re-scan." — ruled-copy/control · age and incompleteness each have a label', () => {
  it("control.rescan-age and control.rescan-incomplete both resolve, both declare no slots, and their values differ", () => {
    expect(COPY_META["control.rescan-age"].slots).toEqual({});
    expect(COPY_META["control.rescan-incomplete"].slots).toEqual({});
    expect(() => copy("control.rescan-age")).not.toThrow();
    expect(() => copy("control.rescan-incomplete")).not.toThrow();
    expect(COPY["control.rescan-age"]).not.toBe(COPY["control.rescan-incomplete"]);
  });
});

describe('REQ-001 c16 — "… then one written line says what happened and a manual retry control is offered, and no scan starts by itself." — ruled-copy/notice · the failed measurement is one line and one retry label', () => {
  it("notice.measurement-failed and control.retry both resolve and declare no slots", () => {
    expect(COPY_META["notice.measurement-failed"].slots).toEqual({});
    expect(COPY_META["control.retry"].slots).toEqual({});
    expect(() => copy("notice.measurement-failed")).not.toThrow();
    expect(() => copy("control.retry")).not.toThrow();
  });

  it("the registry holds exactly seven notice.* keys and exactly four control.* keys", () => {
    const allKeys = Object.keys(COPY) as CopyKey[];
    const noticeKeys = allKeys.filter((k) => k.startsWith("notice."));
    const controlKeys = allKeys.filter((k) => k.startsWith("control."));
    expect(noticeKeys.sort()).toEqual(
      [
        "notice.correction-failed",
        "notice.incomplete",
        "notice.measurement-failed",
        "notice.refused.network-limit",
        "notice.refused.scan-running",
        // #104: the third `AddressRefusal` reason — ReachKit's own stop.
        // It is its own line because it borrows neither of the other two:
        // both of those say "your network", and this one is not about the
        // visitor at all (ADR-011).
        "notice.refused.stopped",
        // #479: a pass that could not read the site's own home document.
        // Owner-owed (`TODO(copy)`); no approved line exists.
        "notice.site-unreadable",
      ].sort()
    );
    expect(controlKeys.sort()).toEqual(
      ["control.correction-retry", "control.rescan-age", "control.rescan-incomplete", "control.retry"].sort()
    );
  });
});

describe('REQ-094 c7 — "… the reader is told in writing that the correction did not complete — in the one written line REQ-001 criterion 16 shows while it shows one, never a second line beside it — and the correction may be submitted once more on criterion 1\'s terms, that retry being the one control REQ-001 criterion 16 admits there." — ruled-copy/notice · the correction\'s failure is its own line and its own retry', () => {
  it("notice.correction-failed and control.correction-retry both resolve, declare no slots, and differ from notice.measurement-failed and control.retry respectively", () => {
    expect(COPY_META["notice.correction-failed"].slots).toEqual({});
    expect(COPY_META["control.correction-retry"].slots).toEqual({});
    expect(() => copy("notice.correction-failed")).not.toThrow();
    expect(() => copy("control.correction-retry")).not.toThrow();
    expect(COPY["notice.correction-failed"]).not.toBe(COPY["notice.measurement-failed"]);
    expect(COPY["control.correction-retry"]).not.toBe(COPY["control.retry"]);
  });
});

describe('REQ-001 c7 — "Given a visitor on a completed report, when they use the copy-link control, then the copied address renders the same report, with the same measurements and the same measurement date, for a different person on a different device." — ruled-copy/copy-link · the label is a label', () => {
  it("copy-link.label resolves and declares no slots, so no address is ever substituted into it", () => {
    expect(COPY_META["copy-link.label"].slots).toEqual({});
    expect(() => copy("copy-link.label")).not.toThrow();
    expect(copy("copy-link.label")).not.toContain("{");
  });
});

describe("Constitution §1 (decision-rights table, \"Customer-visible strings\" — owner) with rule 1.2 — ruled-copy/fidelity · the eighteen values are the owner's, byte for byte", () => {
  const KEYS = Object.keys(RULING.strings) as CopyKey[];

  it("the ruling names exactly eighteen keys", () => {
    expect(KEYS.length).toBe(18);
  });

  it("every one of the eighteen is asserted identical to its value in the ruling file", () => {
    for (const key of KEYS) {
      expect(COPY[key]).toBe(RULING.strings[key]);
    }
  });

  it("the eighteen carry 8 U+2019, 8 U+2014, and zero U+0027 between them", () => {
    const joined = KEYS.map((key) => COPY[key]).join("");
    const apostrophes = [...joined].filter((ch) => ch === "’").length;
    const dashes = [...joined].filter((ch) => ch === "—").length;
    const straight = [...joined].filter((ch) => ch === "'").length;
    expect(apostrophes).toBe(8);
    expect(dashes).toBe(8);
    expect(straight).toBe(0);
  });

  it("each key's declared slots map is exactly the set of {…} markers in its own value, in both directions", () => {
    for (const key of KEYS) {
      const declared = Object.keys(COPY_META[key].slots).sort();
      const markers = markersOf(COPY[key]).sort();
      expect(declared).toEqual(markers);
    }
  });

  it("none of the eighteen is owner-owed any longer", () => {
    for (const key of KEYS) {
      expect(OWNER_OWED).not.toContain(key);
    }
  });
});
