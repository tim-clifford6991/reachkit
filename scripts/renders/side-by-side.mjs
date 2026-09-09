// scripts/renders/side-by-side.mjs — the review render, composed in CI (issue #404)
//
// **Why this exists.** The only reason an implementer still ran `next build`
// and a Chromium on the box was the side-by-side the master reviews: the
// approved screen beside what the branch actually renders. Four agents share
// four cores, three of them were doing that at once, and GitHub was running
// the identical suite in parallel the whole time. The layout job already
// photographs every screen, so the picture is free there and nowhere else.
//
// **What it does.** Reads the captures `tests/ui/layout/visual.test.ts` left
// behind (`RENDER_CAPTURE_DIR`), decides which routes this branch *moved* by
// comparing each 1280-light viewport capture against `main`'s committed
// baseline of the same name, and composes the approved screen (left) beside
// the branch's own full-page render (right) for each one.
//
// **What "changed" means.** Three things, and only these:
//   * `main` has no baseline of that name — a surface this branch adds;
//   * the capture is a different size than the baseline — a screen that grew;
//   * more than `MAX_DIFFERING_RATIO` of the pixels differ — the same
//     tolerance the visual suite checks with, for the same reason (a CI
//     runner and this box antialias differently and neither is wrong).
// Plus whatever `--also` names, which is how a PR body's `Renders:` line asks
// for a screen it did not move.
//
//     node scripts/renders/side-by-side.mjs \
//       --captures <dir> --baselines <dir> --out <dir> [--also "/app,/app/settings"]
//
// Exit status is 0 whenever the composition itself succeeded, including when
// nothing changed: this is a reviewer's convenience, not a gate, and a PR
// that touches no screen must not go red for having no render.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { approvedKeys, approvedRender } from "./screens.mjs";

/** The visual suite's own tolerances, restated here because this script runs
 *  outside vitest and cannot import a `.ts` module. They are one number each
 *  and they are documented at length in `tests/ui/layout/visual.test.ts`;
 *  the test below (`tests/build/renders.test.ts`) holds the two equal. */
const PIXEL_THRESHOLD = 0.2;
const MAX_DIFFERING_RATIO = 0.001;

/** The gutter between the two pictures, and what fills it. Mid-grey so the
 *  seam reads against a light screen and a dark one alike. */
const GUTTER_PX = 24;
const GUTTER_RGB = [138, 138, 138];

function parseArgs(argv) {
  const args = { also: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (!key || value === undefined) throw new Error(`usage: --captures <dir> --baselines <dir> --out <dir> [--also <list>]`);
    if (key === "also") args.also = value.split(/[,\s]+/).filter(Boolean);
    else args[key] = value;
  }
  for (const required of ["captures", "baselines", "out"]) {
    if (!args[required]) throw new Error(`scripts/renders/side-by-side.mjs: --${required} is required`);
  }
  return args;
}

/**
 * How a capture differs from the baseline of the same name, in the words the
 * comment on the PR uses.
 */
function verdictFor(baselineFile, captureFile) {
  if (!existsSync(baselineFile)) return { changed: true, why: "new — `main` has no baseline" };
  const before = PNG.sync.read(readFileSync(baselineFile));
  const after = PNG.sync.read(readFileSync(captureFile));
  if (before.width !== after.width || before.height !== after.height) {
    return {
      changed: true,
      why: `size ${before.width}×${before.height} → ${after.width}×${after.height}`,
    };
  }
  const differing = pixelmatch(before.data, after.data, null, before.width, before.height, {
    threshold: PIXEL_THRESHOLD,
  });
  const total = before.width * before.height;
  const ratio = differing / total;
  return {
    changed: ratio > MAX_DIFFERING_RATIO,
    why: `${differing} of ${total} pixels differ (${(ratio * 100).toFixed(3)}%)`,
  };
}

/** The approved screen on the left, this branch's own render on the right,
 *  each at its own full height against a mid-grey ground. */
export function compose(leftPng, rightPng) {
  const width = leftPng.width + GUTTER_PX + rightPng.width;
  const height = Math.max(leftPng.height, rightPng.height);
  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = GUTTER_RGB[0];
    out.data[i + 1] = GUTTER_RGB[1];
    out.data[i + 2] = GUTTER_RGB[2];
    out.data[i + 3] = 255;
  }
  PNG.bitblt(leftPng, out, 0, 0, leftPng.width, leftPng.height, 0, 0);
  PNG.bitblt(rightPng, out, 0, 0, rightPng.width, rightPng.height, leftPng.width + GUTTER_PX, 0);
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestFile = path.join(args.captures, "manifest.json");
  if (!existsSync(manifestFile)) {
    // The layout job died before Chromium opened — a real failure, and one
    // the job itself already reports. Say so and leave.
    console.log(`scripts/renders/side-by-side.mjs: no captures at ${manifestFile} — nothing to compose`);
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const also = new Set(args.also);
  const keys = approvedKeys();

  rmSync(args.out, { recursive: true, force: true });
  mkdirSync(args.out, { recursive: true });

  const rendered = [];
  const skipped = [];
  for (const shot of manifest.shots) {
    const captureFile = path.join(args.captures, shot.full);
    const viewportFile = path.join(args.captures, shot.viewport);
    if (!existsSync(captureFile) || !existsSync(viewportFile)) {
      // The suite never got to this surface — it timed out, or the run was
      // cancelled. Not a composition failure.
      skipped.push({ ...shot, reason: "not captured (the suite did not reach it)" });
      continue;
    }
    const asked = also.has(shot.route) || also.has(shot.name);
    const verdict = verdictFor(path.join(args.baselines, shot.viewport), viewportFile);
    if (!verdict.changed && !asked) continue;

    const approved = approvedRender(shot.screen, keys);
    if (!approved) {
      skipped.push({ ...shot, reason: `no approved render for ${shot.screen ?? "an unreferenced route"}` });
      continue;
    }
    const composed = compose(
      PNG.sync.read(readFileSync(approved.file)),
      PNG.sync.read(readFileSync(captureFile))
    );
    const file = `side-${shot.name}.png`;
    writeFileSync(path.join(args.out, file), PNG.sync.write(composed));
    rendered.push({
      ...shot,
      file,
      approved: path.relative(process.cwd(), approved.file),
      // Whether this screen is here because it moved or because the PR body
      // asked for it. The comment says which, and the two are not the same
      // news: one is a change to review, the other is a look you requested.
      moved: verdict.changed,
      why: verdict.changed ? verdict.why : "named under `Renders:`",
    });
  }

  writeFileSync(
    path.join(args.out, "renders.json"),
    JSON.stringify({ rendered, skipped }, null, 2)
  );
  console.log(
    `scripts/renders/side-by-side.mjs: composed ${rendered.length} of ${manifest.shots.length} surface(s)` +
      `${skipped.length > 0 ? `, skipped ${skipped.length}` : ""}`
  );
  for (const row of rendered) console.log(`  ${row.file}  ${row.route}  ${row.screen}  ${row.why}`);
  for (const row of skipped) console.log(`  (skipped) ${row.name}  ${row.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}

export { MAX_DIFFERING_RATIO, PIXEL_THRESHOLD, verdictFor };
