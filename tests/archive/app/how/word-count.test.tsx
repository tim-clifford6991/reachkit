// How it works reads in at most R14's 1,200 words (owner, #2299): the
// server-rendered <main>, counted as the parity sweep counts a board.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { applyEnvFixture } from "../../mail/env-fixture";
import { segments, words } from "../../../scripts/design/parity.mjs";

applyEnvFixture();

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");

const CAP = 1200;

describe("How it works' length", () => {
  it(`says at most ${CAP} words in <main>`, () => {
    const main = parse(renderToStaticMarkup(HowItWorksPage())).querySelector("main");
    const n = segments(main?.outerHTML ?? "").flatMap((s: string) => words(s)).length;
    console.log(`how-it-works <main>: ${n} words`);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(CAP);
  });
});
