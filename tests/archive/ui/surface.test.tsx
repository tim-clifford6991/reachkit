// tests/ui/surface.test.tsx
//
// BP-018 `## Public interface`, quoted in WO-269 `## Test plan`:
//   - "`arms` is required and has no default, so a screen that declares no
//     band behaviour fails to compile — not a test."
//   - "`Surface` renders no chrome and is not a widget: BUILD.md §2.2's
//     closed set of five custom components is untouched by it."
//
// The two `@ts-expect-error` fixtures below are discharged by `npm run
// typecheck` (`tsconfig.json` includes `tests/**/*.tsx`), not by Vitest
// itself: widening `arms` to optional, or giving it a default, makes the
// following line compile, which turns the directive into a reported error
// ("Unused '@ts-expect-error' directive") — the mutation `npm run
// typecheck` must catch for this file to keep discharging the criterion.
// This file runs under the jsdom `ui` project; no layout engine is needed
// for either half of it.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Surface } from "@/ui/layout/Surface";

describe("BP-018 — `arms` is required and has no default", () => {
  it("a Surface with no arms prop is a type error", () => {
    // @ts-expect-error — `arms` has no default; omitting it must not compile.
    const el = <Surface>child</Surface>;
    expect(el).toBeTruthy();
  });

  it("a Surface whose arms object is missing one band is a type error", () => {
    const incompleteArms = { compact: { kind: "same-as-below" }, medium: { kind: "same-as-below" } };
    // @ts-expect-error — `arms` requires all three bands; `wide` is missing.
    const el = <Surface arms={incompleteArms}>child</Surface>;
    expect(el).toBeTruthy();
  });
});

describe("BP-018 — Surface renders no chrome and is not a widget", () => {
  it("renders one root carrying data-surface and one data-arm-<band> per band, no class, no style", () => {
    const html = renderToStaticMarkup(
      <Surface
        arms={{
          compact: { kind: "columns", count: 1 },
          medium: { kind: "columns", count: 2 },
          wide: { kind: "declared", note: "three columns, ADR-093 decision 1" },
        }}
      >
        only child text
      </Surface>
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root!.tagName.toLowerCase()).toBe("div");
    expect(root!.getAttribute("class")).toBeNull();
    expect(root!.getAttribute("style")).toBeNull();
    expect(root!.getAttribute("data-surface")).toBe("");
    expect(root!.getAttribute("data-arm-compact")).toBe("columns:1");
    expect(root!.getAttribute("data-arm-medium")).toBe("columns:2");
    expect(root!.getAttribute("data-arm-wide")).toBe(
      "declared:three columns, ADR-093 decision 1"
    );
    // The child is the only text — no chrome string of Surface's own.
    expect(root!.textContent).toBe("only child text");
    expect(root!.children.length).toBe(0);
  });
});
