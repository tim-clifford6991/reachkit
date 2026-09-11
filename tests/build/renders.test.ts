// The CI render pipeline, held to the two things it can silently get wrong (issue #404).
// tests/build/renders.test.ts
//
// `scripts/renders/` composes the picture the master reviews: the approved
// screen beside what the branch renders. Nothing downstream of it fails when
// it is wrong — a side-by-side against the *wrong* approved screen still
// composes, still uploads and still gets a comment, and the review it
// produces is a review of nothing. Two things hold it honest, and they are
// the two this file asserts:
//
//   * the screen ids the sweep hands the composer resolve to a render that
//     exists on disk, for every screen the approved set carries;
//   * the composer's tolerances are the visual suite's own, because a
//     composer that is stricter than the gate reports screens as moved that
//     the gate is happy with, and one that is looser hides the moves.
//
// The composition itself is asserted on two small images rather than on a
// real screen: what can break there is geometry, and geometry is the same at
// 4×4 as at 1280×3400.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { approvedKeys, approvedRender } from "../../scripts/renders/screens.mjs";
import { compose, MAX_DIFFERING_RATIO, PIXEL_THRESHOLD } from "../../scripts/renders/side-by-side.mjs";

const REPO = path.resolve(__dirname, "../..");
const VISUAL_TEST = path.join(REPO, "tests/ui/layout/visual.test.ts");

describe("issue #404 — every screen id the sweep reports has an approved render", () => {
  const keys = approvedKeys();

  it("the approved set's index carries all twenty screens", () => {
    // The set is S1…S20 (`docs/design/approved/README.md`). A parse that
    // came back with three rows would still let every assertion below pass
    // vacuously, so the count is asserted first.
    expect(keys.size).toBe(20);
  });

  it("each of them names a light render that exists", () => {
    const missing = [...keys.keys()].filter((screen) => approvedRender(screen, keys) === null);
    expect(
      missing,
      `no docs/archive/2026-09-11/approved/full-set/screens/<key>-light.png for: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("a screen id the set does not have resolves to nothing rather than to the wrong picture", () => {
    expect(approvedRender("S99", keys)).toBeNull();
    expect(approvedRender(undefined, keys)).toBeNull();
  });
});

describe("issue #404 — the composer measures a moved screen exactly as the gate does", () => {
  const visual = readFileSync(VISUAL_TEST, "utf8");

  it("the two tolerances are the visual suite's own numbers", () => {
    // `side-by-side.mjs` runs outside vitest and cannot import a `.ts`
    // module, so it restates these two. Restated is fine; drifted is not.
    expect(visual).toContain(`const PIXEL_THRESHOLD = ${PIXEL_THRESHOLD};`);
    expect(visual).toContain(`const MAX_DIFFERING_RATIO = ${MAX_DIFFERING_RATIO};`);
  });

  it("the sweep writes the two files the composer reads, at the band the set is drawn at", () => {
    // The viewport capture is what the composer diffs against `main`; the
    // full-page one is what it composes. A rename of either here without
    // one there produces an empty comment and no failure anywhere.
    expect(visual).toContain("const CAPTURE_DIR = process.env.RENDER_CAPTURE_DIR;");
    expect(visual).toContain("const CAPTURE_WIDTH = BAND_MIN.wide;");
    expect(visual).toContain('`${shot.name}-full.png`');
  });
});

describe("issue #404 — the approved screen is on the left, the branch on the right", () => {
  function solid(width: number, height: number, rgb: readonly [number, number, number]): PNG {
    const png = new PNG({ width, height });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = rgb[0];
      png.data[i + 1] = rgb[1];
      png.data[i + 2] = rgb[2];
      png.data[i + 3] = 255;
    }
    return png;
  }

  function pixel(png: PNG, x: number, y: number): [number, number, number] {
    const i = (png.width * y + x) * 4;
    return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
  }

  it("both pictures are whole, side by side, at the taller one's height", () => {
    const left = solid(4, 6, [255, 0, 0]);
    const right = solid(4, 3, [0, 0, 255]);
    const out = compose(left, right);

    // The two screens are rarely the same height — the approved renders are
    // 3400 tall and a branch's screen is whatever it is — so the canvas is
    // the taller of the two and neither is cropped to the other.
    expect(out.height).toBe(6);
    expect(out.width).toBe(4 + 24 + 4);
    expect(pixel(out, 0, 0)).toEqual([255, 0, 0]);
    expect(pixel(out, 0, 5)).toEqual([255, 0, 0]);
    expect(pixel(out, 4 + 24, 0)).toEqual([0, 0, 255]);
  });

  it("the gutter is opaque, so a screenshot of it is not a transparent hole", () => {
    const out = compose(solid(4, 4, [255, 0, 0]), solid(4, 4, [0, 0, 255]));
    const i = (out.width * 0 + 5) * 4;
    expect(out.data[i + 3]).toBe(255);
    expect(pixel(out, 5, 0)).toEqual([138, 138, 138]);
  });
});
