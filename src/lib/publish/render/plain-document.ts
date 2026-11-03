import { escapeHtml } from "./markdown";

/** An unstyled noindex page with a heading, one line and one link home, for a route that must answer at its own status
 *  and so cannot render a component. */
export function plainDocument(p: { head: string; line: string; onward: string }): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(p.head)}</title>`,
    "</head>",
    "<body><main>",
    `<h1>${escapeHtml(p.head)}</h1>`,
    `<p>${escapeHtml(p.line)}</p>`,
    `<p><a href="/">${escapeHtml(p.onward)}</a></p>`,
    "</main></body>",
    "</html>",
  ].join("");
}
