// Render the committed brand assets from the one drawing.
// scripts/brand/render.mjs — issue #982
//
// The mark is `src/lib/brand/mark.ts`. The screens and the two generated
// share cards draw it as SVG; a browser tab, an iOS home screen and a
// timeline preview want raster. This writes those, from that same module,
// so a committed PNG can never show a mark the product does not.
//
// **Playwright, not a new dependency.** It is already here for the layout
// suite, and it is a real renderer — the fade is an SVG gradient, and an
// approximation of one is exactly the drift this script exists to prevent.
//
// `node scripts/brand/render.mjs` — writes into `public/`, and `--check`
// re-renders to a temporary directory and compares, which is how CI can
// ask "is what is committed still what the drawing makes?".
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Where the set is written: the `(public)` route group, not `public/`.
 *
 * Next reads `favicon.ico` only from the top level of `app/`, and a mark
 * there — like one in `public/` — is served on **every** host this
 * deployment answers, including the `content.` host a customer's own page
 * is served from. BUILD §9 and §14's guardrail 6 forbid ReachKit's chrome
 * appearing on a customer's domain, which is why `icon.tsx` was scoped to
 * this group in the first place (#326).
 *
 * `icon` and `apple-icon` are valid in any segment and take `.ico`, `.png`
 * and `.svg`, so the whole set lands here and stays off a customer's
 * pages. The committed bytes are the same; only the address changes.
 */
const OUT_DIR = path.join(ROOT, "src/app/(public)");

/**
 * The drawing, loaded from the TypeScript module itself.
 *
 * Vite's SSR loader is already a dependency (vitest's), and it reads the
 * real module — so this script cannot drift from the source by
 * re-implementing it, and a change to the mark reaches the committed
 * assets by running this and nothing else.
 */
async function loadMark() {
  const { createServer } = await import("vite");
  const server = await createServer({
    root: ROOT,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  try {
    return await server.ssrLoadModule("/src/lib/brand/mark.ts");
  } finally {
    await server.close();
  }
}

/** The sizes the set is asked for, and what each one is for. */
const RASTERS = [
  { file: "icon-16.png", size: 16, keep: false },
  { file: "icon-32.png", size: 32, keep: false },
  /** iOS home screen. `apple-icon` takes no `.svg`, so this one is raster
   *  by the format's own rule rather than by choice. */
  { file: "apple-icon.png", size: 180, keep: true },
];

/** An `.ico` holding the 16 and the 32 as embedded PNGs — the modern form,
 *  which every browser this product supports reads. */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((entry, i) => {
    const at = i * 16;
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    dir.writeUInt8(0, at + 2);
    dir.writeUInt8(0, at + 3);
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(entry.png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/**
 * What a rendered icon has to be true of.
 *
 * Not "every pixel is opaque": the chip is a rounded square, so its four
 * corners are transparent by design and an assertion that forbade that
 * would forbid the drawing. What would actually ship broken is an icon
 * that rendered *nothing* — a gradient that failed to resolve, a viewBox
 * that missed, a screenshot taken before paint — and every one of those
 * shows up the same way: a centre that is not the chip's violet.
 */
function assertDrawn(buffer, file, chip) {
  const png = PNG.sync.read(buffer);
  const at = (x, y) => {
    const i = (png.width * y + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
  };
  const [r, g, b, a] = at(png.width >> 1, png.height >> 1);
  const want = [1, 3, 5].map((i) => parseInt(chip.slice(i, i + 2), 16));
  if (a !== 255) throw new Error(`${file}: the centre is transparent — the chip did not draw`);
  // The dome's fade sits over the centre, so the pixel there is the chip
  // lightened, never darker and never a different hue. A tolerance rather
  // than an equality, because that is the drawing.
  const lightened = r >= want[0] && g >= want[1] && b >= want[2];
  if (!lightened) throw new Error(`${file}: the centre is ${[r, g, b]}, not the chip lightened by the dome`);
}

async function render(outDir) {
  const { brandMarkSvg, MARK_CHIP: chip } = await loadMark();
  await fs.mkdir(outDir, { recursive: true });

  // The SVG itself, which is both a committed asset and the source every
  // raster below is rendered from.
  const svg = brandMarkSvg();
  await fs.writeFile(path.join(outDir, "icon.svg"), `${svg}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    const written = [];
    for (const { file, size, keep } of RASTERS) {
      const context = await browser.newContext({ viewport: { width: size, height: size } });
      const page = await context.newPage();
      await page.setContent(
        `<!doctype html><html><body style="margin:0">${brandMarkSvg({ size })}</body></html>`
      );
      const png = await page.screenshot({ omitBackground: true });
      assertDrawn(png, file, chip);
      await fs.writeFile(path.join(outDir, file), png);
      written.push({ file, size, png, keep });
      await context.close();
    }
    await fs.writeFile(
      path.join(outDir, "icon.ico"),
      ico(written.filter((w) => w.size <= 32).map(({ size, png }) => ({ size, png })))
    );
    // The two small PNGs exist to be packed into the `.ico` and are not
    // themselves served — a browser asks for one icon, not three.
    for (const w of written.filter((w) => !w.keep)) {
      await fs.rm(path.join(outDir, w.file), { force: true });
    }
    return [...written.filter((w) => w.keep).map((w) => w.file), "icon.svg", "icon.ico"];
  } finally {
    await browser.close();
  }
}

const check = process.argv.includes("--check");
if (check) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "rk-brand-"));
  const files = await render(tmp);
  const stale = [];
  for (const file of files) {
    const [fresh, committed] = await Promise.all([
      fs.readFile(path.join(tmp, file)),
      fs.readFile(path.join(OUT_DIR, file)).catch(() => null),
    ]);
    if (committed === null || !fresh.equals(committed)) stale.push(file);
  }
  await fs.rm(tmp, { recursive: true, force: true });
  if (stale.length > 0) {
    console.error(`brand assets are stale: ${stale.join(", ")} — run node scripts/brand/render.mjs`);
    process.exit(1);
  }
  console.log("brand assets match the drawing");
} else {
  const files = await render(OUT_DIR);
  console.log(`wrote ${files.sort().join(", ")} into src/app/(public)/`);
}
