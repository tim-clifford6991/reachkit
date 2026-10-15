// Issue 1458 — the answer for an address of an earlier ReachKit that has
// nothing in its place: `410 Gone`, which tells a crawler to stop asking.
//
// The middleware rewrites each such address here (`_seo/moved.ts`), and
// `/gone` answers the same itself, as it did in v2.
//
// A plain document, like the removed report's (`removedDocument`): only a
// route can set the status, and a route cannot render a component. It says
// what happened and gives one way on.
import { copy } from "@/lib/presentation/copy";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function goneDocument(): string {
  const head = copy("gone.head");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(head)}</title>`,
    "</head>",
    "<body><main>",
    `<h1>${escapeHtml(head)}</h1>`,
    `<p>${escapeHtml(copy("gone.line"))}</p>`,
    `<p><a href="/">${escapeHtml(copy("landing.start.cta"))}</a></p>`,
    "</main></body>",
    "</html>",
  ].join("");
}

export function GET(): Response {
  return new Response(goneDocument(), {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
