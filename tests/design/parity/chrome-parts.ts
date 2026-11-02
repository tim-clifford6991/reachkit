// The board's shared chrome as text segments, read the way the parity audit reads a page.
import { segments } from "../../../scripts/design/parity.mjs";

/** The text of a board's first `<tag>` before or after its `<main>`, so a header inside the screen is not the bar. */
export function partOf(html: string, tag: "header" | "footer"): string[] {
  const from = tag === "header" ? html.indexOf("<header") : html.indexOf("<footer", html.indexOf("</main>"));
  const to = html.indexOf(`</${tag}>`, from);
  return from === -1 || to === -1 ? [] : segments(html.slice(from, to), { board: true });
}
