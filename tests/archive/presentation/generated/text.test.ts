// tests/presentation/generated/text.test.ts
//
// WO-279 (supersedes WO-043) `## Test plan` — TST for criteria 1, 2 and 5 as
// they bind `src/lib/presentation/generated/text.ts`. REQ-093 criteria
// quoted verbatim in the work order's own table; not re-quoted here (rule
// 2.4 — the WO's `## Test plan` is the one home for the quote).
//
// `renderGenerated`'s two labels (`generated.page.written`,
// `generated.page.proposed`) are owner-owed in the real registry (WO-041
// `keys/laws.ts`) — `copy()` throws naming the key until the owner writes
// them, and this suite does not paper over that (dispatch instruction,
// constitution §1). The label-content assertions below therefore run
// against a mocked `copy()` — synthetic test fixture data, not invented
// product copy — so `renderGenerated`'s own wiring (which key, which vars,
// in which branch) is checked without depending on a string the owner has
// not written yet. A separate describe below runs against the REAL,
// unmocked registry and asserts that `copy()`'s owner-owed throw still
// reaches the caller unchanged, naming the real key.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import {
  AWAITING_COPY,
  COPY,
} from "../../../src/lib/presentation/copy/registry.ts";

const COPY_INDEX_PATH = "../../../src/lib/presentation/copy/index.ts";
const TEXT_TS_PATH = path.resolve(__dirname, "../../../src/lib/presentation/generated/text.ts");
const QUESTION_TS_PATH = path.resolve(
  __dirname,
  "../../../src/lib/presentation/generated/question.ts"
);

describe("REQ-093 c1 — a hand-written sentence cannot be laundered into the generated arm", () => {
  it("an object literal cannot be passed through the module's one exported constructor", async () => {
    const { fromStored } = await import("../../../src/lib/presentation/generated/text.ts");
    // Rule 4.2 note (recorded once, here, not re-litigated elsewhere): TS
    // is structurally typed, so `const x: GeneratedText = { source:
    // 'model', text: 'hello' }` is *not* itself a compile error — the
    // interface has no nominal brand, and BP-020's own interface (quoted
    // verbatim in this file) declares none. What the type system *can* and
    // does enforce is that the one exported constructor, `fromStored`,
    // refuses that same object literal in its own argument position — it
    // takes `(column: GeneratedColumn, value: string)`, not a
    // `GeneratedText`-shaped object.
    //
    // Correction (TST-028 finding 2): an earlier version of this comment
    // claimed the source-text check below "actually closes the structural
    // gap in practice". That claim was false and TST-028's validator
    // disproved it directly: from an *external* file, with no cast and no
    // second constructor anywhere, `{ source: 'model', text: someString }`
    // is a valid `GeneratedText` by shape alone, and flows straight through
    // `renderGenerated`. The source-text check below closes only a
    // cast-based or second-constructor mint *inside this module's own
    // files* (`text.ts`, `question.ts`) — it says nothing about a value
    // built anywhere else. The describe below this one reproduces that
    // exact bypass, so the gap is a passing, visible test rather than a
    // claim in a comment. `GeneratedText` is BP-020's declared interface
    // (rule 2.4 — one claim, one home), so the gap's disposition is
    // recorded there, not restated as a second copy on this work order;
    // the architect has since ruled on a nominal brand to close it (a
    // follow-up work order, not this one's to implement).
    // @ts-expect-error — fromStored takes (column, value); an object
    // literal is neither.
    const fake = fromStored({ source: "model", text: "a hand-written sentence" });
    expect(fake).toBeTruthy();
  });

  it("fromStored refuses a column string that is not a GeneratedColumn", async () => {
    const { fromStored } = await import("../../../src/lib/presentation/generated/text.ts");
    // @ts-expect-error — 'not.a.column' is not a member of GeneratedColumn.
    const bad = fromStored("not.a.column", "some stored value");
    expect(bad).toBeTruthy();
  });

  it("text.ts and question.ts contain no widening cast", () => {
    const textSrc = readFileSync(TEXT_TS_PATH, "utf8");
    const questionSrc = readFileSync(QUESTION_TS_PATH, "utf8");
    for (const src of [textSrc, questionSrc]) {
      expect(src).not.toMatch(/\bas\s+GeneratedText\b/);
      expect(src).not.toMatch(/\bas\s+unknown\s+as\b/);
    }
  });

  it("fromStored is the only exported function whose declared return type is GeneratedText", () => {
    const src = readFileSync(TEXT_TS_PATH, "utf8");
    const sf = ts.createSourceFile(TEXT_TS_PATH, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const returningGeneratedText: string[] = [];
    sf.forEachChild((node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
        node.type &&
        node.type.getText(sf).includes("GeneratedText")
      ) {
        returningGeneratedText.push(node.name.text);
      }
    });
    // Discriminates: a second exported constructor, or an overload of
    // fromStored, adds a second (or duplicate) entry here.
    expect(returningGeneratedText).toEqual(["fromStored"]);
  });
});

describe("REQ-093 c1 — open hole (TST-028 finding 2): structural construction from outside this module", () => {
  it("a GeneratedText built by an external file, with no cast and no second constructor, still reaches renderGenerated", async () => {
    vi.resetModules();
    vi.doMock(COPY_INDEX_PATH, () => ({ copy: (key: string) => `[[${key}]]` }));
    const { renderGenerated, fromStored } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    type GeneratedText = import("../../../src/lib/presentation/generated/text.ts").GeneratedText;

    // No `as`, no `as unknown as`, no call to fromStored, no second
    // constructor exported by text.ts — exactly the construction TST-028's
    // validator used. This is not this test file "laundering" a value
    // through a loophole in its own logic; it is what any file anywhere in
    // the repository — including a real surface under src/app/** — can
    // write today, because GeneratedText is a plain, unbranded interface.
    const handWritten: GeneratedText = {
      source: "model",
      text: "a sentence nobody read out of storage",
    };

    const identity = {
      state: "written" as const,
      pageId: "page-1",
      title: fromStored("drafts.title", "T"),
      slug: fromStored("drafts.slug", "s"),
      body: fromStored("drafts.body", "b"),
    };

    // This assertion is expected to PASS today — it documents the gap, it
    // does not paper over it. BP-020 carries the disposition (rule 2.4 —
    // `GeneratedText` is its declared interface, not this work order's to
    // hold a second copy of); the architect has ruled yes on a nominal
    // brand to close this, as a follow-up work order this one does not
    // implement or pre-empt.
    const result = renderGenerated(handWritten, identity);
    expect(result.text).toBe("a sentence nobody read out of storage");

    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });
});

describe("REQ-093 c2 — model text cannot be rendered without its page", () => {
  it("renderGenerated cannot be called with only one argument", async () => {
    const { renderGenerated, fromStored } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const field = fromStored("drafts.body", "stored body text");
    // The @ts-expect-error below discharges the type-level half (`npm run
    // typecheck`); at runtime `page` is `undefined` and the function body
    // reads `page.state`, so the call throws rather than silently
    // returning — both halves say the same thing: this call is not valid.
    expect(() => {
      // @ts-expect-error — renderGenerated takes (field, page); page is required.
      renderGenerated(field);
    }).toThrow();
  });

  it("a proposed PageIdentity has no description arm", async () => {
    const { fromStored } = await import("../../../src/lib/presentation/generated/text.ts");
    type PageIdentity = import("../../../src/lib/presentation/generated/text.ts").PageIdentity;
    const proposed: PageIdentity = {
      state: "proposed",
      opportunityId: "opp-1",
      title: fromStored("opportunities.proposed_title", "A proposed title"),
      slug: fromStored("opportunities.proposed_slug", "a-proposed-slug"),
      // @ts-expect-error — the proposed arm has no description field at all.
      description: fromStored("drafts.description", "should not be assignable here"),
    };
    expect(proposed.state).toBe("proposed");
  });

  it("renderGenerated has arity 2 and no session/reader/persona argument", async () => {
    const { renderGenerated } = await import("../../../src/lib/presentation/generated/text.ts");
    expect(renderGenerated.length).toBe(2);
  });

  it("with copy() mocked: a written identity yields proposed:false and a label from generated.page.written", async () => {
    vi.resetModules();
    const calls: Array<[string, Record<string, string | number> | undefined]> = [];
    vi.doMock(COPY_INDEX_PATH, () => ({
      copy: (key: string, vars?: Record<string, string | number>) => {
        calls.push([key, vars]);
        return `[[${key}]]`;
      },
    }));
    const { fromStored, renderGenerated } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const identity = {
      state: "written" as const,
      pageId: "page-1",
      title: fromStored("drafts.title", "Written Title"),
      slug: fromStored("drafts.slug", "written-slug"),
      body: fromStored("drafts.body", "written body content"),
    };
    const field = fromStored("drafts.body", "written body content");
    const result = renderGenerated(field, identity);

    expect(result.proposed).toBe(false);
    expect(result.label).toBe("[[generated.page.written]]");
    expect(result.text).toBe("written body content");
    expect(calls).toEqual([["generated.page.written", { pageTitle: "Written Title" }]]);
    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });

  it("with copy() mocked: a proposed identity yields proposed:true and a label from generated.page.proposed", async () => {
    vi.resetModules();
    const calls: Array<[string, Record<string, string | number> | undefined]> = [];
    vi.doMock(COPY_INDEX_PATH, () => ({
      copy: (key: string, vars?: Record<string, string | number>) => {
        calls.push([key, vars]);
        return `[[${key}]]`;
      },
    }));
    const { fromStored, renderGenerated } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const identity = {
      state: "proposed" as const,
      opportunityId: "opp-1",
      title: fromStored("opportunities.proposed_title", "Proposed Title"),
      slug: fromStored("opportunities.proposed_slug", "proposed-slug"),
    };
    const field = fromStored("opportunities.proposed_title", "Proposed Title");
    const result = renderGenerated(field, identity);

    expect(result.proposed).toBe(true);
    expect(result.label).toBe("[[generated.page.proposed]]");
    expect(calls).toEqual([["generated.page.proposed", { pageTitle: "Proposed Title" }]]);
    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });

  it("the return is a single object carrying label and text together", async () => {
    vi.resetModules();
    vi.doMock(COPY_INDEX_PATH, () => ({ copy: () => "a label" }));
    const { fromStored, renderGenerated } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const identity = {
      state: "written" as const,
      pageId: "page-1",
      title: fromStored("drafts.title", "T"),
      slug: fromStored("drafts.slug", "s"),
      body: fromStored("drafts.body", "b"),
    };
    const field = fromStored("drafts.body", "b");
    const result = renderGenerated(field, identity);
    expect(Object.keys(result).sort()).toEqual(["label", "proposed", "text"]);
    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });

  it("the label does not vary with the reader: identical arguments yield byte-identical results", async () => {
    vi.resetModules();
    vi.doMock(COPY_INDEX_PATH, () => ({ copy: (key: string) => `label for ${key}` }));
    const { fromStored, renderGenerated } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const identity = {
      state: "written" as const,
      pageId: "page-1",
      title: fromStored("drafts.title", "T"),
      slug: fromStored("drafts.slug", "s"),
      body: fromStored("drafts.body", "b"),
    };
    const field = fromStored("drafts.body", "b");
    const a = renderGenerated(field, identity);
    const b = renderGenerated(field, identity);
    expect(a).toEqual(b);
    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });
});

describe("REQ-093 c2 / c5 — against the real, unmocked copy() registry", () => {
  it("renderGenerated on the real registry returns the key's registry value and fabricates no string", async () => {
    vi.resetModules();
    const { fromStored, renderGenerated } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const identity = {
      state: "written" as const,
      pageId: "page-1",
      title: fromStored("drafts.title", "T"),
      slug: fromStored("drafts.slug", "s"),
      body: fromStored("drafts.body", "b"),
    };
    const field = fromStored("drafts.body", "b");
    // 2026-09-06, issue #17: `generated.page.written` moved from the
    // owner-owed empty value to `TODO(copy)` (keys/laws.ts records why —
    // §4.6's draft view is the first surface to render a *written* page's
    // body, and an owner-owed throw would take that screen down instead of
    // showing the owner a label to write). 2026-09-09, issue #377: the
    // owner's approved set draws that label — `generated by ReachKit ·
    // labelled`, unbracketed on S16's card head — so ruling 11a makes it
    // approved copy and the marker is gone.
    //
    // What is asserted has not moved either time, and it is the thing the
    // throw and the marker were both standing in for: whatever comes back
    // is the registry's own value for that key, never a sentence this
    // module composed.
    const result = renderGenerated(field, identity);
    expect(result.label).toBe(COPY["generated.page.written"]);
    expect(result.label).toBe("generated by ReachKit · labelled");
    expect(AWAITING_COPY).not.toContain("generated.page.written");
    // The text is still returned untouched beside it, so a caller cannot
    // render one without the other.
    expect(result.text).toBe("b");
  });
});

describe("REQ-093 c5 — stored page content renders with every model unavailable", () => {
  it("text.ts's transitive import graph contains no path under src/lib/llm/", () => {
    // AST-scoped to actual import declarations, not to this file's own doc
    // comments (which name "src/lib/llm/" in prose, explaining why no
    // import to it exists — a plain substring match would flag its own
    // documentation).
    const src = readFileSync(TEXT_TS_PATH, "utf8");
    const sf = ts.createSourceFile(TEXT_TS_PATH, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const importSpecifiers: string[] = [];
    sf.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        importSpecifiers.push(node.moduleSpecifier.text);
      }
    });
    expect(importSpecifiers.some((s) => s.includes("lib/llm"))).toBe(false);
  });

  it("renderGenerated returns stored text unchanged regardless of model availability", async () => {
    vi.resetModules();
    vi.doMock(COPY_INDEX_PATH, () => ({ copy: () => "a label" }));
    const { fromStored, renderGenerated } = await import(
      "../../../src/lib/presentation/generated/text.ts"
    );
    const stored = "exactly what storage held, untouched";
    const identity = {
      state: "written" as const,
      pageId: "page-1",
      title: fromStored("drafts.title", "T"),
      slug: fromStored("drafts.slug", "s"),
      body: fromStored("drafts.body", stored),
    };
    const result = renderGenerated(fromStored("drafts.body", stored), identity);
    expect(result.text).toBe(stored);
    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });
});

describe("generatedLabel — BP-019's declared helper, one label producer (rule 7.1)", () => {
  it("delegates to the same copy() calls renderGenerated uses", async () => {
    vi.resetModules();
    const calls: Array<[string, Record<string, string | number> | undefined]> = [];
    vi.doMock(COPY_INDEX_PATH, () => ({
      copy: (key: string, vars?: Record<string, string | number>) => {
        calls.push([key, vars]);
        return `[[${key}]]`;
      },
    }));
    const { generatedLabel } = await import("../../../src/lib/presentation/generated/text.ts");
    expect(generatedLabel({ pageTitle: "A Title", written: true })).toEqual({
      label: "[[generated.page.written]]",
    });
    expect(generatedLabel({ pageTitle: "A Title", written: false })).toEqual({
      label: "[[generated.page.proposed]]",
    });
    expect(calls).toEqual([
      ["generated.page.written", { pageTitle: "A Title" }],
      ["generated.page.proposed", { pageTitle: "A Title" }],
    ]);
    vi.doUnmock(COPY_INDEX_PATH);
    vi.resetModules();
  });
});
