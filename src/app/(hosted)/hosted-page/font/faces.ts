import { readFile } from "node:fs/promises";
import path from "node:path";

/** Where a customer's host serves the hosted sheet and its faces. */
export const STYLE_PATH = "/style.css";
export const FONT_PATH = "/font/";

/** The two faces every hosted page preloads (SPEC §7, 2026-10-18, issue 1514): Jakarta 400 and 800. */
export const PRELOADED_FACES: readonly string[] = [
  "plus-jakarta-sans-latin-400-normal.woff2",
  "plus-jakarta-sans-latin-800-normal.woff2",
];

/** @fontsource's own sheets for the weights `src/ui/fonts.ts` loads. */
const FACE_SHEETS: readonly string[] = [
  "plus-jakarta-sans/400.css",
  "plus-jakarta-sans/500.css",
  "plus-jakarta-sans/600.css",
  "plus-jakarta-sans/700.css",
  "plus-jakarta-sans/800.css",
  "jetbrains-mono/400.css",
];

const WOFF_FALLBACK = /,\s*url\(\.\/files\/[^)]+\.woff\)\s*format\('woff'\)/g;
const WOFF2 = /url\(\.\/files\/([^)]+\.woff2)\)/g;

/** The `@font-face` rules addressed on the customer's host, and each file they name with where it is read from.
 *  Only the woff2 source is kept: every browser that reads the sheet's custom properties reads woff2. */
export async function hostedFontFaces(): Promise<{ css: string; files: ReadonlyMap<string, string> }> {
  const root = path.join(process.cwd(), "node_modules", "@fontsource");
  const files = new Map<string, string>();
  const sheets = await Promise.all(
    FACE_SHEETS.map(async (sheet) => {
      const dir = path.join(root, path.dirname(sheet), "files");
      const css = await readFile(path.join(root, sheet), "utf8");
      return css.replace(WOFF_FALLBACK, "").replace(WOFF2, (_, file: string) => {
        files.set(file, path.join(dir, file));
        return `url(${FONT_PATH}${file})`;
      });
    })
  );
  return { css: sheets.join("\n"), files };
}
