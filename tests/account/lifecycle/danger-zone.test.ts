// tests/account/lifecycle/danger-zone.test.ts — REQ-079 c1
//
// "Given a customer on Settings, when they open the danger zone, then
// exactly two actions are offered — unpublish every page, and delete the
// account — each with one written sentence saying what it removes, what it
// keeps, and whether the account survives it."
//
// The closed set and its metadata. The card is the Settings screen's and the
// sentences are the owner's; what is asserted here is that there are two,
// which two, in which order, and that the file mints no sentence of its own.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { COPY } from "@/lib/presentation/copy/registry";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { DANGER_ZONE, isDangerAction } = await import("@/lib/account/lifecycle");

describe("REQ-079 c1 — exactly two actions, with the declared sentence keys and accountSurvives values", () => {
  it("has exactly two members, in order", () => {
    expect(DANGER_ZONE.map((entry) => entry.action)).toEqual(["unpublish_all", "delete_account"]);
  });

  it("each names the key of the sentence that states its consequence", () => {
    expect(DANGER_ZONE.map((entry) => entry.sentenceKey)).toEqual([
      "danger.unpublish-all.consequence",
      "danger.delete-account.consequence",
    ]);
  });

  it("unpublish everything keeps the account; delete account does not", () => {
    expect(DANGER_ZONE.map((entry) => entry.accountSurvives)).toEqual([true, false]);
  });

  it("both sentence keys are real registry keys, so a rename cannot leave a step wordless", () => {
    for (const entry of DANGER_ZONE) {
      expect(Object.hasOwn(COPY, entry.sentenceKey), `${entry.sentenceKey} is not a copy key`).toBe(
        true
      );
    }
  });

  it("the constant is frozen: a third action cannot be pushed onto it at runtime", () => {
    expect(Object.isFrozen(DANGER_ZONE)).toBe(true);
    expect(() => {
      (DANGER_ZONE as unknown as { push(entry: unknown): void }).push({ action: "third" });
    }).toThrow(TypeError);
  });

  it("isDangerAction admits the two and nothing else", () => {
    expect(isDangerAction("unpublish_all")).toBe(true);
    expect(isDangerAction("delete_account")).toBe(true);
    expect(isDangerAction("delete_everything")).toBe(false);
  });
});

describe("the file names keys, never sentences", () => {
  it("danger-zone.ts contains no string literal that is a sentence", () => {
    const code = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/account/lifecycle/danger-zone.ts"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const literal of code.match(/"[^"]*"/g) ?? []) {
      // Every literal in this file is a copy key, an action name or an
      // import specifier: none of them carries a space, and a sentence
      // cannot avoid one.
      expect(literal, `${literal} reads as a sentence`).not.toMatch(/\s/);
    }
  });
});
