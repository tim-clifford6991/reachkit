// The hosted document's stylesheet at a stable address on the customer's own host, so a page
// served as a string can link it. Compiled once, during `next build`, from the same sheets and
// the same Tailwind plugin `(hosted)/document.tsx` and `postcss.config.mjs` use.
import path from "node:path";
import { hostedFontFaces } from "../font/faces";

export const dynamic = "force-static";

/** The five sheets `(hosted)/document.tsx` imports, in its order. */
const SHEETS: readonly string[] = ["theme.css", "tailwind.css", "type.css", "layout/layout.css", "layout/surface.css"];

export async function GET(): Promise<Response> {
  const [{ default: postcss }, { default: tailwind }] = await Promise.all([
    import("postcss"),
    import("@tailwindcss/postcss"),
  ]);
  const entry = SHEETS.map((sheet) => `@import "./${sheet}";`).join("\n");
  const [sheet, faces] = await Promise.all([
    postcss([tailwind()]).process(entry, { from: path.join(process.cwd(), "src", "ui", "hosted.css") }),
    hostedFontFaces(),
  ]);
  return new Response(`${sheet.css}\n${faces.css}`, {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
}
