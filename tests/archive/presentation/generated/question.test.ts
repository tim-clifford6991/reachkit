// tests/presentation/generated/question.test.ts
//
// WO-279 (supersedes WO-043) `## Test plan` — TST for criterion 3 as it
// binds `src/lib/presentation/generated/question.ts`. REQ-093 criterion 3
// quoted verbatim in the work order's own table; not re-quoted here (rule
// 2.4). The *content* of `provenance` is REQ-006 criterion 9's node's; this
// suite asserts only that the pair cannot be split, per BP-020 `## Public
// interface`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { fromStored } from "../../../src/lib/presentation/generated/text.ts";
import { renderQuestion } from "../../../src/lib/presentation/generated/question.ts";

const QUESTION_TS_PATH = path.resolve(
  __dirname,
  "../../../src/lib/presentation/generated/question.ts"
);

describe("REQ-093 c3 — a question's wording cannot be rendered without its provenance", () => {
  it("returns a two-element tuple, roles 'question' then 'provenance', in that order", () => {
    const wording = fromStored("questions.wording", "Does this business rank for anything?");
    const [first, second] = renderQuestion({
      wording,
      provenance: "derived from a search for 'plumber near me'",
    });
    expect(first.role).toBe("question");
    expect(first.text).toBe("Does this business rank for anything?");
    expect(second.role).toBe("provenance");
    expect(second.text).toBe("derived from a search for 'plumber near me'");
  });

  it("cannot be called without provenance", () => {
    const wording = fromStored("questions.wording", "Does this business rank for anything?");
    // @ts-expect-error — provenance is required.
    const pair = renderQuestion({ wording });
    expect(pair).toBeTruthy();
  });

  it("question.ts exports exactly one function, and no export returns a bare string", () => {
    const src = readFileSync(QUESTION_TS_PATH, "utf8");
    const sf = ts.createSourceFile(
      QUESTION_TS_PATH,
      src,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const exportedFunctionNames: string[] = [];
    sf.forEachChild((node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        exportedFunctionNames.push(node.name.text);
      }
    });
    // Discriminates: adding a `wordingOnly()` export (or any second export)
    // fails this assertion.
    expect(exportedFunctionNames).toEqual(["renderQuestion"]);

    // "No export returns a bare string": renderQuestion's own declared
    // return type must not be `string` — checked structurally, since the
    // interesting failure mode is a *new* export whose return type is
    // exactly `string`.
    const fn = sf.forEachChild((node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "renderQuestion" ? node : undefined
    );
    expect(fn).toBeTruthy();
    const returnTypeText = fn && ts.isFunctionDeclaration(fn) && fn.type ? fn.type.getText(sf) : "";
    expect(returnTypeText.trim()).not.toBe("string");
  });
});
