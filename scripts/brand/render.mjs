// Render the committed brand files from the one drawing.
// scripts/brand/render.mjs — issues #982, #1121
//
// The mark is `src/lib/brand/mark.ts`. The screens draw it as SVG; a tab,
// a home screen, a mail client, Stripe and BIMI want files at fixed
// addresses. This writes all of them from that one module, so no committed
// file can show a mark the product does not. Nothing here is drawn by hand.
//
// **sharp, not a browser** (#1121). sharp is already installed (Next's
// image optimiser), and its librsvg renders the fade as a real gradient.
// The wordmark is Pango text in Plus Jakarta Sans 800 — the self-hosted
// `@fontsource` face. That package ships only WOFF, which the bundled
// fontconfig cannot read, so `woffToSfnt` unpacks it to a plain font file
// in a temporary directory first.
//
// Two places:
// - `src/app/` — `icon.svg`, `icon.ico`, `apple-icon.png`. Next's own icon
//   convention at the root, so every route's head names them, `/app`
//   included. The `(hosted)` layout clears them again, so a customer's
//   domain carries no ReachKit mark (BUILD §9).
// - `public/brand/` — stable addresses for third parties: the manifest,
//   the mail head, Stripe, BIMI. On a customer's host `src/middleware.ts`
//   rewrites every path into the hosted group, so these are not served
//   there either.
//
// `node scripts/brand/render.mjs` writes both; `--check` re-renders to a
// temporary directory and compares, and exits 1 on a stale file.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_DIR = "src/app";
const BRAND_DIR = "public/brand";
const WORDMARK_FONT = path.join(
  ROOT,
  "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff"
);
/** The family name the WOFF declares for its 800 weight (`fc-query`). */
const WORDMARK_FAMILY = "Plus Jakarta Sans ExtraBold";

/** The drawing, the wordmark and the theme's colours, loaded from the
 *  TypeScript modules themselves through Vite's SSR loader (vitest's), so
 *  this script re-implements none of them. */
async function loadSources() {
  const { createServer } = await import("vite");
  const server = await createServer({
    root: ROOT,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  try {
    const mark = await server.ssrLoadModule("/src/lib/brand/mark.ts");
    const { token } = await server.ssrLoadModule("/src/lib/mail/shell/tokens.ts");
    const { copy } = await server.ssrLoadModule("/src/lib/presentation/copy/index.ts");
    return { mark, token, wordmark: copy("chrome.wordmark") };
  } finally {
    await server.close();
  }
}

/** The dark theme's ink, which `tokens.ts` (light only — a mail is light)
 *  does not hold: read from the explicit dark block of `theme.css`. */
async function darkInk() {
  const css = await fs.readFile(path.join(ROOT, "src/ui/theme.css"), "utf8");
  const block = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const found = /--color-base-content:\s*(#[0-9a-fA-F]{6})/.exec(block);
  if (!found) throw new Error("theme.css: no dark --color-base-content");
  return found[1];
}

/** WOFF 1.0 → the SFNT it wraps: the same tables, inflated, with a plain
 *  table directory in front. */
function woffToSfnt(woff) {
  const flavor = woff.readUInt32BE(4);
  const count = woff.readUInt16BE(12);
  const tables = Array.from({ length: count }, (_, i) => {
    const at = 44 + i * 20;
    const offset = woff.readUInt32BE(at + 4);
    const packed = woff.readUInt32BE(at + 8);
    const length = woff.readUInt32BE(at + 12);
    const raw = woff.subarray(offset, offset + packed);
    return {
      tag: woff.readUInt32BE(at),
      checksum: woff.readUInt32BE(at + 16),
      data: packed < length ? zlib.inflateSync(raw) : raw,
    };
  });
  const selector = Math.floor(Math.log2(count));
  const range = 2 ** selector * 16;
  const head = Buffer.alloc(12 + count * 16);
  head.writeUInt32BE(flavor, 0);
  head.writeUInt16BE(count, 4);
  head.writeUInt16BE(range, 6);
  head.writeUInt16BE(selector, 8);
  head.writeUInt16BE(count * 16 - range, 10);
  let offset = head.length;
  const bodies = tables.map((table, i) => {
    const at = 12 + i * 16;
    head.writeUInt32BE(table.tag, at);
    head.writeUInt32BE(table.checksum, at + 4);
    head.writeUInt32BE(offset, at + 8);
    head.writeUInt32BE(table.data.length, at + 12);
    const padded = Buffer.alloc((table.data.length + 3) & ~3);
    table.data.copy(padded);
    offset += padded.length;
    return padded;
  });
  return Buffer.concat([head, ...bodies]);
}

/** An `.ico` holding PNGs — the modern form every supported browser reads. */
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
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(entry.png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/**
 * The mark as SVG Tiny PS, the profile BIMI requires: `baseProfile=
 * "tiny-ps"`, a `<title>`, a square with a solid ground, and no script,
 * clip path or external reference. The chip's corner is left to the inbox,
 * which crops a BIMI logo itself; everything else is the drawing's own.
 */
function bimiSvg(mark, title) {
  const { MARK_BOX: box, MARK_FADE: fade } = mark;
  const id = mark.MARK_FADE_ID;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 ${box} ${box}">`,
    `<title>${title}</title>`,
    `<linearGradient id="${id}" x1="${fade.x1}" y1="${fade.y1}" x2="${fade.x2}" y2="${fade.y2}">`,
    `<stop offset="${fade.from}" stop-color="${mark.MARK_INK}"/>`,
    `<stop offset="1" stop-color="${mark.MARK_INK}" stop-opacity="${fade.toOpacity}"/>`,
    "</linearGradient>",
    `<rect width="${box}" height="${box}" fill="${mark.MARK_CHIP}"/>`,
    `<path d="${mark.MARK_DOME}" fill="url(#${id})"/>`,
    "</svg>",
  ].join("");
}

/** A PNG must be byte-stable across runs for `--check` to mean anything. */
const png = (image) => image.png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();

/** The mark at `size` pixels, corners transparent, as the screens draw it. */
function markAt(mark, size) {
  return sharp(Buffer.from(mark.brandMarkSvg({ size })), { density: 72 });
}

/** The chip's violet to the edge: the corners filled, for the surfaces that
 *  crop an icon to their own shape (iOS, Android's maskable icons). */
function fullBleed(mark, size, scale) {
  const inner = Math.round(size * scale);
  const inset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: mark.MARK_CHIP },
  }).composite([{ input: Buffer.from(mark.brandMarkSvg({ size: inner })), top: inset, left: inset }]);
}

/**
 * The lockup the screens draw (`Brand.tsx`): the chip, a gap, the wordmark
 * in Plus Jakarta Sans 800 at tight tracking — `size-7`, `gap-2`,
 * `text-lg` — scaled by `unit`, on a transparent ground.
 */
async function logo(mark, fontFile, word, ink, unit) {
  const chip = 28 * unit;
  const gap = 8 * unit;
  const fontPx = 18 * unit;
  // Pango's letter spacing is in 1024ths of a point; at 72dpi a point is a
  // pixel. Tailwind's `tracking-tight` is -0.025em.
  const spacing = Math.round(-0.025 * fontPx * 1024);
  const text = await sharp({
    text: {
      text: `<span foreground="${ink}" letter_spacing="${spacing}">${word}</span>`,
      font: `${WORDMARK_FAMILY}, ${fontPx}px`,
      fontfile: fontFile,
      rgba: true,
      dpi: 72,
    },
  })
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = text.info;
  return sharp({
    create: {
      width: chip + gap + width,
      height: chip,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: Buffer.from(mark.brandMarkSvg({ size: chip })), top: 0, left: 0 },
    // Centred on the chip by its ink: the word has no descender, so its ink
    // box is its cap height, which is what `items-center` reads as.
    { input: text.data, top: Math.round((chip - height) / 2), left: chip + gap },
  ]);
}

/** A rendered icon that drew nothing — a gradient that did not resolve, a
 *  viewBox that missed — shows as a centre that is not the chip lightened
 *  by the dome. */
async function assertDrawn(buffer, file, chip) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const i = ((info.height >> 1) * info.width + (info.width >> 1)) * info.channels;
  const want = [1, 3, 5].map((k) => parseInt(chip.slice(k, k + 2), 16));
  if (info.channels === 4 && data[i + 3] !== 255) throw new Error(`${file}: the centre is transparent`);
  if (!want.every((v, k) => data[i + k] >= v)) throw new Error(`${file}: the centre is not the chip`);
}

async function render(outRoot) {
  const { mark, token, wordmark } = await loadSources();
  const chip = mark.MARK_CHIP;
  const fontDir = await fs.mkdtemp(path.join(os.tmpdir(), "rk-font-"));
  const fontFile = path.join(fontDir, "plus-jakarta-sans-800.ttf");
  await fs.writeFile(fontFile, woffToSfnt(await fs.readFile(WORDMARK_FONT)));

  const svg = `${mark.brandMarkSvg()}\n`;
  const at = async (size) => png(markAt(mark, size));
  const files = {
    [`${APP_DIR}/icon.svg`]: svg,
    [`${APP_DIR}/icon.ico`]: ico([
      { size: 16, png: await at(16) },
      { size: 32, png: await at(32) },
    ]),
    // iOS rounds a home-screen icon itself and paints a transparent corner
    // black, so this one is the chip to the edge.
    [`${APP_DIR}/apple-icon.png`]: await png(fullBleed(mark, 180, 1)),
    [`${BRAND_DIR}/mark.svg`]: svg,
    [`${BRAND_DIR}/mark-bimi.svg`]: `${bimiSvg(mark, wordmark)}\n`,
    // Android's safe zone is the centre circle of 80%; at 80% the dome's
    // lower corners sit at 75% of that radius.
    [`${BRAND_DIR}/mark-maskable-512.png`]: await png(fullBleed(mark, 512, 0.8)),
    [`${BRAND_DIR}/logo.png`]: await png(await logo(mark, fontFile, wordmark, token("--color-base-content"), 2)),
    [`${BRAND_DIR}/logo@2x.png`]: await png(await logo(mark, fontFile, wordmark, token("--color-base-content"), 4)),
    [`${BRAND_DIR}/logo-dark.png`]: await png(await logo(mark, fontFile, wordmark, await darkInk(), 2)),
  };
  for (const size of [32, 96, 192, 512, 1024]) files[`${BRAND_DIR}/mark-${size}.png`] = await at(size);
  await fs.rm(fontDir, { recursive: true, force: true });

  for (const [file, bytes] of Object.entries(files)) {
    if (file.endsWith(".png") && !file.includes("logo")) await assertDrawn(bytes, file, chip);
    await fs.mkdir(path.dirname(path.join(outRoot, file)), { recursive: true });
    await fs.writeFile(path.join(outRoot, file), bytes);
  }
  return Object.keys(files).sort();
}

if (process.argv.includes("--check")) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "rk-brand-"));
  const files = await render(tmp);
  const stale = [];
  for (const file of files) {
    const [fresh, committed] = await Promise.all([
      fs.readFile(path.join(tmp, file)),
      fs.readFile(path.join(ROOT, file)).catch(() => null),
    ]);
    if (committed === null || !fresh.equals(committed)) stale.push(file);
  }
  await fs.rm(tmp, { recursive: true, force: true });
  if (stale.length > 0) {
    console.error(`brand files are stale: ${stale.join(", ")} — run node scripts/brand/render.mjs`);
    process.exit(1);
  }
  console.log("brand files match the drawing");
} else {
  const files = await render(ROOT);
  console.log(`wrote ${files.join(", ")}`);
}
