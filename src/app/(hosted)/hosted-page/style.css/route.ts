// The hosted document's stylesheet at a stable address on the customer's own host, so a page
// served as a string can link it. Compiled once, during `next build`, from the same sheets and
// the same Tailwind plugin `(hosted)/document.tsx` and `postcss.config.mjs` use.
import path from "node:path";
import { hostedFontFaces } from "../font/faces";

export const dynamic = "force-static";

/** The five sheets `(hosted)/document.tsx` imports, in its order. */
const SHEETS: readonly string[] = ["theme.css", "tailwind.css", "type.css", "layout/layout.css", "layout/surface.css"];

/** The hosted graph's class strings only: an excluded folder is never walked, so the hosted group stays in by
 *  excluding its siblings, and the shared files it renders are named one by one. */
const HOSTED_SOURCES: readonly string[] = [
  '@source not "../app/{(account),(public),_*,api}/**";',
  '@source not "../app/*.{ts,tsx}";',
  '@source not "../ui/**";',
  '@source "../ui/layout/Surface.tsx";',
  '@source "../ui/SiteMark.tsx";',
  '@source "../app/(account)/app/draft/[draftId]/present.ts";',
  // The renderer builds a table column's alignment class at runtime, so no scanned file spells it.
  '@source inline("text-left text-center text-right");',
];

export async function GET(): Promise<Response> {
  const [{ default: postcss }, { default: tailwind }] = await Promise.all([
    import("postcss"),
    import("@tailwindcss/postcss"),
  ]);
  const entry = [...SHEETS.map((sheet) => `@import "./${sheet}";`), ...HOSTED_SOURCES].join("\n");
  const [sheet, faces] = await Promise.all([
    postcss([tailwind()]).process(entry, { from: path.join(process.cwd(), "src", "ui", "hosted.css") }),
    hostedFontFaces(),
  ]);
  return new Response(`${sheet.css}\n${faces.css}`, {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
}
